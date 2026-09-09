// Food and supplement search — the ranking and status logic the Swift client
// must reproduce exactly, or search behaves differently on iOS. Moved out of
// App.jsx unchanged (2026-09-08). No JSX, no state.
//
// Sources, in the order searchFood merges them:
//   1. custom foods (the user's own rows — always first, never filtered)
//   2. LOCAL_FOOD_DB (the shipped catalogue)
//   3. Open Food Facts v2 — filtered by nameMatchesQuery (#18): OFF returns
//      unrelated products for a non-matching query, so a result must contain
//      every query token in its name/brand. A BARCODE lookup is exempt (the
//      product's name does not contain the digits).
//   4. USDA FoodData Central — behind USDA_ENABLED, OFF by design (2026-09-07):
//      its Branded ranking was not worth the dependency. The proxy
//      (api/usda.js, key server-side) and this client are kept intact; flip the
//      flag to re-enable, or point the proxy at another provider.
//
// The status ladder — searchStatus({results, failed}) — is what the UI shows
// and the client must not collapse it:
//   ok       results, every source answered
//   partial  results, but a source failed → show them AND name the source
//   none     no results, every source answered → the reachable empty state
//            (offer to create a custom food)
//   failed   no results AND a source failed → "search failed, retry", which
//            must never be rendered as "no results"
//
// Serving sizes: usdaServingGrams trusts servingSize only when the unit says
// grams/oz (see DECISIONS "USDA servingSize is trusted only when the unit says
// so"); otherwise the user supplies grams.
import { coachHeaders } from "./coach.js";
import { LOCAL_FOOD_DB, SUPP_DB } from "./constants.js";

// Paste your free USDA FoodData Central key here:
// Get one free at: https://fdc.nal.usda.gov/api-guide.html
// The USDA key lives on the server (api/usda.js, env USDA_API_KEY). This used
// to be the literal "DEMO_KEY": 30 requests per IP per hour, shared by every
// user behind the same NAT, and a 429 rendered as "No results" — search died
// silently for anyone on a carrier IP. Launch blocker, fixed 2026-09-07.
// USDA is OFF by design (2026-09-07), not broken. FoodData Central's Branded
// dataset ranks results badly enough that it was not worth the dependency. The
// proxy (api/usda.js), this client, and the honest failed-search UI are kept
// intact: flip this flag to re-enable, or point the same proxy at another
// provider. When off, the proxy is never called and search reports only the
// sources that actually ran, so an empty result reads as empty, not failed.
export const USDA_ENABLED = false;
async function usdaSearch(q, { dataType, pageSize } = {}) {
  const qs = "q=" + encodeURIComponent(q) + (dataType ? "&dataType=" + encodeURIComponent(dataType) : "") + (pageSize ? "&pageSize=" + pageSize : "");
  const res = await fetch("/api/usda?" + qs, { headers: coachHeaders() });
  if (!res.ok) throw new Error("USDA " + res.status);
  return res.json();
}



export function searchLocalFood(query){
  const q=query.toLowerCase().trim();
  const words=q.split(/\s+/).filter(w=>w.length>2);
  return LOCAL_FOOD_DB
    .map(f=>{
      const n=f.name.toLowerCase();
      const b=(f.brand||"").toLowerCase();
      // Score: full match scores higher than partial keyword match
      let score=0;
      if(n.includes(q)||b.includes(q))score+=10;
      words.forEach(w=>{if(n.includes(w)||b.includes(w))score+=1;});
      return{...f,_score:score};
    })
    .filter(f=>f._score>0)
    .sort((a,b)=>b._score-a._score)
    .slice(0,8)
    .map(({_score,...f})=>f);
}

export function searchLocalSupp(query){
  const q=query.toLowerCase().trim();
  const words=q.split(/\s+/).filter(w=>w.length>2);
  return SUPP_DB
    .map(s=>{
      const n=s.name.toLowerCase();
      const b=(s.brand||"").toLowerCase();
      const c=(s.category||"").toLowerCase();
      let score=0;
      if(n.includes(q)||b.includes(q)||c.includes(q))score+=10;
      words.forEach(w=>{if(n.includes(w)||b.includes(w)||c.includes(w))score+=1;});
      return{...s,_score:score};
    })
    .filter(s=>s._score>0)
    .sort((a,b)=>b._score-a._score)
    .slice(0,8)
    .map(({_score,...s})=>s);
}

// USDA reports servingSize with a UNIT, and it is not always grams: "ml" and
// "MLT" for drinks, "IU" for vitamins, "oz" for some branded packs. The number
// used to be taken regardless, so a 414 ml shake became 414 g and a 5000 IU
// vitamin D became 5000 g/serving in the supplement list.
//
// Grams pass through and ounces convert, because 1 oz IS 28.3495 g — that is a
// unit conversion, not a guess. Millilitres do NOT convert: ml→g needs a
// density, which is a property of the food, and the custom-food form already
// refuses to guess exactly this (it makes the user supply grams for
// food-dependent units). Two parts of the app disagreeing about what a
// millilitre weighs is how known issue #3 happened; this side does not add a
// third position.
//
// null means "unknown", which the food UI already handles honestly — it falls
// back to 100 g and SAYS SO ("1 serving = 100g"). A disclosed default beats a
// silent wrong number.
const USDA_GRAM_UNITS={g:1,grm:1,gram:1,grams:1,oz:28.3495};
export function usdaServingGrams(f){
  const qty=parseFloat(f&&f.servingSize);
  if(!qty||qty<=0)return null;
  const factor=USDA_GRAM_UNITS[String((f&&f.servingSizeUnit)||"").trim().toLowerCase()];
  if(!factor)return null;
  return Math.round(qty*factor*10)/10;
}

// Returns {ok, results}. ok:false means the SEARCH FAILED (network, 429, 5xx,
// proxy not configured) and must never be rendered as "no results".
async function searchUSDA(query){
  try{
    const data=await usdaSearch(query,{dataType:"Branded,Foundation,SR Legacy",pageSize:10});
    const results=(data.foods||[])
      .filter(f=>f.description&&f.foodNutrients&&f.foodNutrients.length>0)
      .map(f=>{
        // USDA returns nutrient IDs — map common ones
        const byId={};
        const byName={};
        (f.foodNutrients||[]).forEach(n=>{
          if(n.nutrientId)byId[n.nutrientId]=n.value||0;
          if(n.nutrientName)byName[n.nutrientName.toLowerCase()]=n.value||0;
        });
        // Energy: 1008=kcal, 1062=kcal
        const cal=byId[1008]||byId[1062]||byName["energy"]||0;
        if(!cal)return null;
        return{
          name:f.description,
          brand:f.brandOwner||f.brandName||f.publishedDate||"",
          servingG:usdaServingGrams(f),
          per100:{
            cal:Math.round(cal),
            protein:Math.round((byId[1003]||byName["protein"]||0)*10)/10,
            carbs:Math.round((byId[1005]||byName["carbohydrate, by difference"]||byName["carbohydrate"]||0)*10)/10,
            fat:Math.round((byId[1004]||byName["total lipid (fat)"]||byName["fat"]||0)*10)/10,
            fiber:Math.round((byId[1079]||byName["fiber, total dietary"]||byName["fiber"]||0)*10)/10,
            sugar:Math.round((byId[2000]||byName["total sugars"]||byName["sugars, total including nlea"]||0)*10)/10,
            sodium:Math.round((byId[1093]||byName["sodium, na"]||byName["sodium"]||0)),
          }
        };
      })
      .filter(Boolean)
      .slice(0,6);
    return {ok:true,results};
  }catch(e){
    console.warn("USDA search failed:",e.message);
    return {ok:false,results:[]};
  }
}

// Open Food Facts' v2 search returns unrelated products for a query that
// matches nothing (known issue #18) — the same three for any nonsense string —
// which made the "No results" state unreachable once USDA was gated off. Keep
// only products whose name contains a query token. Barcode lookup is exempt:
// that is an exact-id fetch in BarcodeScanner, not a search.
const foldText=(t)=>String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
export function nameMatchesQuery(name,query){
  const n=foldText(name); if(!n)return false;
  const tokens=foldText(query).split(" ").filter(t=>t.length>=2);
  if(!tokens.length)return false;
  return tokens.some(t=>n.includes(t));
}
async function searchOFF(query){
  // Free-text OFF search is CORS-blocked in the browser, so this goes through
  // api/off.js — our JWT-gated edge proxy over search-a-licious — which
  // normalises to the products[] shape mapped below. A non-2xx or a network
  // failure is a FAILED search (ok:false), NEVER laundered into "no results":
  // searchStatus's failed-vs-none distinction depends on it. Barcode lookup is
  // a separate path (api/v0/product, direct) and is unchanged.
  try{
    const res=await fetch("/api/off?q="+encodeURIComponent(query),{headers:coachHeaders(),cache:"no-store"});
    if(!res.ok)return {ok:false,results:[]};
    const data=await res.json();
    const products=data.products||[];
    const results=products
      .filter(p=>p.product_name&&p.nutriments&&(p.nutriments["energy-kcal_100g"]>0||p.nutriments["energy_100g"]>0))
      .filter(p=>nameMatchesQuery(p.product_name,query))
      .slice(0,6)
      .map(p=>({
        name:p.product_name.trim(),
        brand:(p.brands||"").split(",")[0].trim(),
        servingG:parseFloat(p.serving_quantity)||null,
        per100:{
          cal:Math.round(p.nutriments["energy-kcal_100g"]||p.nutriments["energy_100g"]/4.184||0),
          protein:Math.round((p.nutriments["proteins_100g"]||0)*10)/10,
          carbs:Math.round((p.nutriments["carbohydrates_100g"]||0)*10)/10,
          fat:Math.round((p.nutriments["fat_100g"]||0)*10)/10,
          fiber:Math.round((p.nutriments["fiber_100g"]||0)*10)/10,
          sugar:Math.round((p.nutriments["sugars_100g"]||0)*10)/10,
          sodium:Math.round((p.nutriments["sodium_100g"]||0)*1000),
        }
      }));
    return {ok:true,results};
  }catch(e){
    console.warn("OFF search failed:",e.message);
    return {ok:false,results:[]};
  }
}

// Deduplicate by normalised name prefix
function dedup(arr){
  const seen=new Set();
  return arr.filter(r=>{
    const key=r.name.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,18);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

// Main food search — always runs ALL sources in parallel, merges results
export async function searchFood(query,customFoods=[]){
  if(!query||!query.trim())return[];
  const q=query.toLowerCase().trim();
  const custom=(customFoods||[]).filter(f=>
    f.name.toLowerCase().includes(q)||(f.brand||"").toLowerCase().includes(q)
  ).map(f=>({...f,isCustom:true}));
  const local=searchLocalFood(query);
  // Always fire external APIs in parallel — don't short-circuit on local hits
  const [usdaR,offR]=await Promise.allSettled([USDA_ENABLED?searchUSDA(query):Promise.resolve({ok:true,results:[],skipped:true}),searchOFF(query)]);
  const usda=usdaR.status==="fulfilled"?usdaR.value:{ok:false,results:[]};
  const off=offR.status==="fulfilled"?offR.value:{ok:false,results:[]};
  // A source that did not run cannot fail; only sources that ran are reported.
  const failed=[USDA_ENABLED&&!usda.ok&&"USDA",!off.ok&&"Open Food Facts"].filter(Boolean);
  // Priority: custom → local → USDA → OFF
  return {results:dedup([...custom,...local,...usda.results,...off.results]).slice(0,10),failed};
}

// What the search UI should say. "No results" is only honest when every source
// answered; a failed source with nothing else to show is "search failed".
export function searchStatus({results,failed}){
  if(results.length>0)return failed.length?"partial":"ok";
  return failed.length?"failed":"none";
}

// Supplement search — always runs local + USDA in parallel
export async function searchSupp(query){
  if(!query||!query.trim())return[];
  const local=searchLocalSupp(query).map(s=>({...s,isSupp:true}));
  if(!USDA_ENABLED)return local;
  try{
    const data=await usdaSearch(query,{dataType:"Branded",pageSize:8});
    const usdaSupps=(data.foods||[])
      .filter(f=>f.description&&f.foodNutrients)
      .map(f=>{
        const byId={};(f.foodNutrients||[]).forEach(n=>{if(n.nutrientId)byId[n.nutrientId]=n.value||0;});
        const cal=byId[1008]||byId[1062]||0;
        return{
          name:f.description,brand:f.brandOwner||"",
          category:"Supplement",servingG:usdaServingGrams(f),isSupp:true,
          per100:{
            cal:Math.round(cal),
            protein:Math.round((byId[1003]||0)*10)/10,
            carbs:Math.round((byId[1005]||0)*10)/10,
            fat:Math.round((byId[1004]||0)*10)/10,
            fiber:Math.round((byId[1079]||0)*10)/10,
            sodium:Math.round(byId[1093]||0),
          }
        };
      })
      .filter(f=>f.name)
      .slice(0,5);
    return dedup([...local,...usdaSupps]).slice(0,10);
  }catch{
    return local;
  }
}
