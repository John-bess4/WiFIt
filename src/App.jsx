
import React, { useState, useRef, useEffect, useMemo } from "react";
import { THEME_META, THEME_ORDER, DEFAULT_THEME, KEYFRAMES } from "./themes.js";
import HomeTab from "./HomeTab.jsx";
import TabBar from "./TabBar.jsx";
import TabErrorBoundary from "./TabErrorBoundary.jsx";
import { weekDays, reduceWeekRows, todayPlanFor } from "./lib/weekSummary.js";

import { THEMES, LOCKED_FAMILIES, DEFAULT_THEME_KEY, resolveTheme, resolveDark, ThemeCtx, useTheme } from "./lib/theme.js";
import { localDate } from "./lib/dates.js";
import { computePRs, setsDataOf, setLabel, normalizeExercises, editSet, sessionFromRow, bestsFromView, prEventsBySession } from "./lib/workouts.js";
import { calc, totals, per100From, customFoodFromRow, CF_UNIT_G, CF_AUTO_UNITS, cfGramsFor } from "./lib/nutrition.js";
import { COLORS, SEED, LOCAL_FOOD_DB, SUPP_DB, SUPP_CATEGORY_DOTS, isSuppCategory, toSuppCategory, GOAL_OZ, CF_MAX_SERVING_G, MAX_FOOD_GRAMS, EXERCISE_LIBRARY, INITIAL_WORKOUTS, GOAL_RATES, calcCalFromRate, ACTIVITY, ACTIVITY_MULTS_BY_ID } from "./lib/constants.js";

const GOALS={cal:2200,protein:140,carbs:180,fat:78,fiber:25,sodium:2300};

// Inject global responsive styles once
const GLOBAL_CSS=`
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  input,button{font-family:-apple-system,sans-serif;}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
  body{margin:0;overflow-x:hidden;}
  .glow-card{transition:box-shadow 0.25s,border-color 0.25s,background 0.25s;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}
  @media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none !important;}}
`+KEYFRAMES;
function GlobalStyle(){
  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=GLOBAL_CSS;
    document.head.appendChild(el);
    return()=>document.head.removeChild(el);
  },[]);
  return null;
}

const dayData={
  14:{food:1,workout:0,supp:1,cal:1820},15:{food:1,workout:1,supp:1,cal:2100},
  16:{food:1,workout:1,supp:0,cal:1950},17:{food:0,workout:0,supp:0,cal:0},
  18:{food:1,workout:0,supp:1,cal:2050},19:{food:1,workout:1,supp:1,cal:1890},
  20:{food:1,workout:1,supp:1,cal:2200},21:{food:1,workout:0,supp:0,cal:720},
};



// ── LONG-PRESS HOOK ───────────────────────────────────────────────
function useLongPress(onLongPress, ms=500){
  const timer=useRef(null);
  const fired=useRef(false);
  const start=(e)=>{
    fired.current=false;
    timer.current=setTimeout(()=>{fired.current=true;onLongPress(e);},ms);
  };
  const cancel=()=>clearTimeout(timer.current);
  const click=(e)=>{if(fired.current)e.stopPropagation();};
  return{onTouchStart:start,onTouchEnd:cancel,onTouchMove:cancel,onMouseDown:start,onMouseUp:cancel,onMouseLeave:cancel,onClick:click};
}


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



function searchLocalFood(query){
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

function searchLocalSupp(query){
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
  let anyOk=false;
  // Try two OFF endpoints — v2 search is more reliable for CORS
  const urls=[
    "https://world.openfoodfacts.org/cgi/search.pl?search_terms="+encodeURIComponent(query)+"&search_simple=1&action=process&json=1&page_size=10&fields=product_name,nutriments,brands,serving_quantity",
    "https://world.openfoodfacts.net/api/v2/search?q="+encodeURIComponent(query)+"&page_size=8&fields=product_name,nutriments,brands,serving_quantity",
  ];
  for(const url of urls){
    try{
      const res=await fetch(url,{mode:"cors",headers:{Accept:"application/json"}});
      if(!res.ok)continue;
      const data=await res.json();
      const products=data.products||data.foods||[];
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
      if(results.length>0)return {ok:true,results};
      anyOk=true; // answered, just no matches
    }catch(e){
      console.warn("OFF search failed:",e.message);
    }
  }
  return {ok:anyOk,results:[]};
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
async function searchFood(query,customFoods=[]){
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
async function searchSupp(query){
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


function CheckIcon({done,size=12}){
  const T=useTheme();
  return done
    ?<svg width={size} height={size} viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
    :<svg width={size} height={size} viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

// Derived from SUPP_DB, not hand-maintained. The browse filter used its own
// hardcoded list of 8 while SUPP_DB carries 12 distinct categories, so BCAAs,
// Multivitamin, Collagen, Probiotic and Greens/Multi were unreachable: products
// existed that no filter could show. This constant had drifted out of use
// entirely — three different lists, none of them agreeing. Deriving it means
// adding a product with a new category can never strand it again.
//
// Ordered by how many products carry each category so the busiest filters come
// first; ties break alphabetically to keep the chip order stable.
const SUPP_CATS=["All",...Object.entries(
  SUPP_DB.reduce((m,s)=>{if(s.category)m[s.category]=(m[s.category]||0)+1;return m;},{})
).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([c])=>c)];
const DOT_COLORS={"Protein":"#FF6B4A","Creatine":"#5B8DEF","Pre-Workout":"#E24B4A","BCAAs":"#9B6DFF","Vitamins":"#F5A623","Omega-3":"#2ECC8F","Electrolytes":"#5B8DEF","Sleep":"#9B6DFF","Collagen":"#FF6B4A","Probiotic":"#2ECC8F","Multivitamin":"#F5A623","Greens/Multi":"#2ECC8F","Supplement":"#888"};

// What the model is shown of the conversation so far. Applied-action cards
// (water_logged, multi_food_logged, …) used to be filtered out entirely, so
// from the model's side nothing it had done ever happened — and it re-emitted
// the previous turn's water action alongside the next request (2026-09-07,
// known issue #17). They are now replayed as short assistant lines. Consecutive
// same-role entries are merged so the transcript alternates cleanly.
export function summarizeActionCard(m){
  if(m.type==="water_logged")return "[Logged "+m.oz+" oz water]"+(m.text?" "+m.text:"");
  if(m.type==="multi_food_logged")return "[Logged: "+(m.items||[]).map(i=>i.name+" "+i.grams+" g").join(", ")+"]"+(m.text?" "+m.text:"");
  if(m.type==="supp_added")return "[Proposed supplements: "+(m.items||[]).map(i=>i.name).join(", ")+"]"+(m.text?" "+m.text:"");
  if(m.type==="meal_suggestion")return "[Suggested meals]"+(m.text?" "+m.text:"");
  if(m.type==="recipe")return "[Gave a recipe]"+(m.text?" "+m.text:"");
  if(m.type==="workout_plan")return "[Proposed a workout plan]"+(m.text?" "+m.text:"");
  return m.text||"";
}
// The full messages array for one request: context, then the new user turn
// exactly once. If the caller already put the new message at the end of
// history, it is not appended a second time — that duplication is what made
// the model act on every request twice.
export function buildRequestMessages(userMsg,history){
  const ctx=buildContextMessages(history);
  const last=ctx[ctx.length-1];
  if(last&&last.role==="user"&&last.content===userMsg)return ctx;
  return [...ctx,{role:"user",content:userMsg}];
}
export function buildContextMessages(history){
  // isError bubbles are our own failure text; check-ins are unprompted. Neither
  // is something the model said in reply to the user.
  const turns=history.filter(m=>!m.isCheckin&&!m.isError).map(m=>({role:m.bot?"assistant":"user",content:m.type?summarizeActionCard(m):(m.text||"")})).filter(t=>t.content);
  const merged=[];
  turns.forEach(t=>{const last=merged[merged.length-1]; if(last&&last.role===t.role)last.content+="\n"+t.content; else merged.push({...t});});
  // The API requires the first message to be from the user.
  while(merged.length&&merged[0].role!=="user")merged.shift();
  return merged.slice(-10);
}

// ── SIDE RAIL AI PANEL ──────────────────────────────────────────
// ── ACTIONS contract ────────────────────────────────────────────
// One block per reply, multiplicity inside the array rather than across blocks:
// ACTIONS:[{...},{...}]|message. The old contract could express only one intent
// per reply, so "log 8oz of water and add creatine" had no representation.
//
// Module scope, not inside AISidePanel: parseActions closes over nothing, and at
// component scope it was unreachable from a test.
export const MAX_ACTIONS=10;


// Required fields per type. Optional fields are never checked — a missing
// `timing` degrades the card, a missing `name` makes it meaningless.
export const ACTION_VALID={
  water:a=>Number.isFinite(Number(a.oz))&&Number(a.oz)>0,
  // grams>0 is load-bearing: per100 divides by it, and 0 would write Infinity.
  food:a=>Array.isArray(a.items)&&a.items.length>0&&a.items.every(i=>i&&i.name&&Number(i.grams)>0&&Number.isFinite(Number(i.cal))),
  meal_suggestion:a=>Array.isArray(a.items)&&a.items.length>0&&a.items.every(i=>i&&i.name),
  recipe:a=>!!a.name&&Array.isArray(a.ingredients)&&a.ingredients.length>0,
  workout_plan:a=>!!a.name&&Array.isArray(a.exercises)&&a.exercises.length>0,
  // category is checked against the enum, not merely for presence. A category
  // outside the eight used to pass, get written, and render as an anonymous
  // grey dot — a bad value stored as though it were real. It is now a drop, and
  // the footer names it like any other failed action.
  supplement:a=>Array.isArray(a.items)&&a.items.length>0&&a.items.every(i=>i&&i.name&&isSuppCategory(i.category)),
};

// Returns null when this is not an ACTIONS reply OR when the JSON is corrupt.
// Corrupt fails CLOSED — a half-parsed array must never be half-executed.
// Individual actions inside a well-formed array fail OPEN: valid siblings commit
// and the dropped ones are named, because the multi-intent case is the whole
// point and an all-or-nothing drop is the silent-swallow pattern again.
export const parseActions=(reply)=>{
  if(!reply.startsWith("ACTIONS:"))return null;
  const rest=reply.slice("ACTIONS:".length);
  const pipeIdx=rest.indexOf("|");
  const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
  const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"";
  let raw;
  try{raw=JSON.parse(jsonStr);}catch{return null;}
  if(!Array.isArray(raw))return null;
  const capped=raw.slice(0,MAX_ACTIONS);
  const overflow=raw.length-capped.length;
  const valid=[],dropped=[];
  capped.forEach(a=>{
    const rule=a&&ACTION_VALID[a.type];
    if(rule&&rule(a))valid.push(a);
    else dropped.push(a&&a.type?String(a.type):"unknown");
  });
  return{valid,dropped,overflow,msg,total:raw.length};
};

// Prefixes of the pre-ACTIONS contract. Still parsed (see send) so a model that
// regresses mid-rollout keeps working; the warn is the countable signal that
// says when removing the six parsers is safe.
export const LEGACY_PREFIXES=["MULTI_FOOD:","MEAL_SUGGESTION:","RECIPE:","WATER_LOG:","ADD_SUPP:","WORKOUT_PLAN:"];
export const legacyFormatOf=(reply)=>LEGACY_PREFIXES.find(p=>reply.startsWith(p))||null;


// A component, not a branch of renderMsg, because it owns collapsible state.
// renderMsg runs inside a .map, so a useState there made the panel's hook count
// depend on how many recipe messages existed: the first recipe card took it
// from 14 hooks to 15 and React threw "Rendered more hooks than during the
// previous render". With no error boundary above it the whole app went blank,
// which means RECIPE — one of the six shipped coach formats — had never once
// rendered. A component instance owns its own hooks, so the count is stable no
// matter how many recipe cards a conversation accumulates.
function RecipeCard({m,idx,onAddFood,setMessages}){
  const T=useTheme();
  const r=m.recipe;
  const [showSteps,setShowSteps]=useState(false);
  const logRecipe=()=>{
    if(!onAddFood||m.logged)return;
    (r.ingredients||[]).forEach(ing=>{
      onAddFood(r.slot||"snacks",{
        id:Date.now()+Math.random(),
        name:ing.name,grams:ing.grams,
        color:COLORS[Math.floor(Math.random()*COLORS.length)],
        per100:per100From(ing),
      });
    });
    setMessages(prev=>prev.map((x,xi)=>xi===idx?{...x,logged:true}:x));
  };
  return(
    <div style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:7}}>
      <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
      <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:16,overflow:"hidden",boxShadow:T.glowShadow}}>
        {/* Header */}
        <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),padding:"12px 14px"}}>
          <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{r.name}</div>
          <div style={{display:"flex",gap:14,marginTop:6}}>
            {[["🔥",r.totalCal+" kcal"],["💪",r.totalProtein+"g P"],["🌾",r.totalCarbs+"g C"],["🫐",r.totalFat+"g F"]].map(([ic,val])=>(
              <div key={val} style={{fontSize:11,color:"rgba(255,255,255,0.65)"}}>{ic} {val}</div>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div style={{padding:"10px 14px",borderBottom:("1px solid "+T.border)}}>
          <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Ingredients</div>
          {(r.ingredients||[]).map((ing,ii)=>(
            <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:ii<r.ingredients.length-1?("1px solid "+T.border+"33"):"none"}}>
              <div style={{fontSize:13,color:T.text}}>{ing.name} <span style={{fontSize:11,color:T.muted}}>{ing.grams}g</span></div>
              <div style={{fontSize:11,color:T.muted}}>{ing.cal} kcal</div>
            </div>
          ))}
        </div>

        {/* Steps — collapsible */}
        <div onClick={()=>setShowSteps(s=>!s)} style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:("1px solid "+T.border)}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text}}>📋 Instructions ({(r.steps||[]).length} steps)</div>
          <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:showSteps?"rotate(180deg)":"none",transition:"transform 0.2s"}}><polyline points="1,3 6,9 11,3" stroke={T.muted} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
        {showSteps&&(
          <div style={{padding:"8px 14px 10px"}}>
            {(r.steps||[]).map((step,si)=>(
              <div key={si} style={{display:"flex",gap:10,padding:"5px 0",borderBottom:si<r.steps.length-1?("1px solid "+T.border+"22"):"none"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.accent,flexShrink:0}}>{si+1}</div>
                <div style={{fontSize:12,color:T.text,lineHeight:1.5}}>{step}</div>
              </div>
            ))}
          </div>
        )}

        {/* Log button */}
        {m.logged
          ?<div style={{padding:"11px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.green}}>✓ All ingredients logged to {r.slot||"snacks"}</div>
          :<div onClick={logRecipe} style={{padding:"11px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.accent,cursor:"pointer",background:T.accentPill}}>
            + Log all ingredients
          </div>
        }
      </div>
    </div>
  );
}

function AISidePanel({open,onClose,onAddFood,onAddSupp,onAddWorkout,onAddWater,liveContext={},userName="",userId=""}){
  const T=useTheme();
  const STORAGE_KEY="wifit_chat_"+(userId||"demo");

  // ── Feature 7: Persistent chat — load from localStorage ───────
  const [messages,setMessages]=useState(()=>{
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved){const parsed=JSON.parse(saved);if(parsed?.length>0)return parsed;}
    }catch{}
    return[{bot:true,text:"Hey"+(userName?" "+userName.split(" ")[0]:"")+"! I'm your AI Coach. Tell me what you ate and I'll log it, ask for meal ideas based on your remaining macros, or say make me a workout 💪"}];
  });

  // Persist messages to localStorage whenever they change (keep last 30)
  useEffect(()=>{
    // Never persist error bubbles — a transient failure shouldn't outlive the session.
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(messages.filter(m=>!m.isError).slice(-30)));}catch{}
  },[messages]);

  // Two-step so a mis-tap next to the ✕ can't wipe the history. Reverts on its own.
  const [confirmClear,setConfirmClear]=useState(false);
  const clearChat=()=>{
    setConfirmClear(false);
    setSuggestions([]);
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
    setMessages([{bot:true,text:"Hey"+(userName?" "+userName.split(" ")[0]:"")+"! I'm your AI Coach. Tell me what you ate and I'll log it, ask for meal ideas based on your remaining macros, or say make me a workout 💪"}]);
  };

  const [input,setInput]=useState("");
  const [thinking,setThinking]=useState(false);
  const [suggestions,setSuggestions]=useState([]); // Feature 8
  const [photoLoading,setPhotoLoading]=useState(false); // Feature 9
  const photoInputRef=useRef();
  const bottomRef=useRef();
  const checkinDoneRef=useRef(false);

  const buildContextBlock=()=>{
    const c=liveContext;
    if(!c.calGoal)return "";
    const pctCal=c.calGoal>0?Math.round((c.calConsumed/c.calGoal)*100):0;
    const remaining=Math.max(0,(c.calGoal||2200)-(c.calConsumed||0));
    const protRemain=Math.max(0,(c.protGoal||140)-(c.protConsumed||0));
    const carbRemain=Math.max(0,(c.carbGoal||180)-(c.carbConsumed||0));
    const fatRemain=Math.max(0,(c.fatGoal||78)-(c.fatConsumed||0));
    const waterPct=Math.round(((c.waterOz||0)/128)*100);
    const now=new Date();
    const hour=now.getHours();
    const timeOfDay=hour<12?"morning":hour<17?"afternoon":"evening";
    const mealSlot=hour<10?"breakfast":hour<14?"lunch":hour<18?"dinner":"snacks";
    const timeStr=now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
    // Pre-compute supplement stack string to avoid nested template literals
    const suppStackStr=c.suppList&&c.suppList.length>0
      ?c.suppList.map(s=>{
        const taken=c.suppTakenMap&&c.suppTakenMap[s.k]?" ✅":" ⬜";
        const sub=s.sub?" ("+s.sub+")":"";
        return s.name+sub+taken;
      }).join(", ")
      :"No supplements added yet";
    // Pre-compute weight trend string
    const weightStr=(()=>{
      if(!c.weightLog||c.weightLog.length<2)return "No weight data logged yet.";
      const recent=c.weightLog.slice(-7);
      const diff=recent[recent.length-1].lbs-recent[0].lbs;
      const trend=diff<0?"down "+Math.abs(diff).toFixed(1)+"lbs":diff>0?"up "+diff.toFixed(1)+"lbs":"stable";
      return "User's recent weights: "+recent.map(w=>w.date+": "+w.lbs+"lbs").join(", ")+"\nTrend: "+trend+"\nIf user asks about progress, reference this trend specifically.";
    })();

    return "\n"+
"══════════════════════════════════════\n"+
"USER'S LIVE DATA RIGHT NOW\n"+
"══════════════════════════════════════\n"+
"Name: "+(userName||"the user")+"\n"+
"Time: "+timeOfDay+" ("+timeStr+") — default meal slot: "+mealSlot+"\n\n"+
"TODAY'S CALORIES:\n"+
"  Consumed: "+(c.calConsumed||0)+" kcal ("+pctCal+"% of goal)\n"+
"  Remaining: "+remaining+" kcal\n"+
"  Goal: "+(c.calGoal||2200)+" kcal\n\n"+
"TODAY'S MACROS REMAINING:\n"+
"  Protein: "+protRemain+"g left (consumed "+(c.protConsumed||0)+"g / goal "+(c.protGoal||140)+"g)\n"+
"  Carbs: "+carbRemain+"g left (consumed "+(c.carbConsumed||0)+"g / goal "+(c.carbGoal||180)+"g)\n"+
"  Fat: "+fatRemain+"g left (consumed "+(c.fatConsumed||0)+"g / goal "+(c.fatGoal||78)+"g)\n\n"+
"WATER: "+(c.waterOz||0)+" oz logged today ("+waterPct+"% of 128oz goal)\n"+
"WORKOUT TODAY: "+(c.workoutDone?"✅ Completed":"❌ Not done yet")+"\n"+
"SUPPLEMENT STACK: "+suppStackStr+"\n"+
"SUPPLEMENTS TAKEN: "+(c.suppTaken||0)+"/"+(c.suppTotal||0)+" today\n\n"+
"WEIGHT DATA: "+weightStr+"\n\n"+
"ALWAYS use this live data when giving advice. Reference actual numbers. If they ask what to eat, use their remaining macros.";
  };

  const buildSystem=()=>`You are an expert fitness and nutrition AI coach built into a personal fitness tracking app.

Keep responses concise — mobile chat panel, 3-4 sentences max unless asked for detail. Be direct, specific, and reference the user's actual data when relevant.

CRITICAL — OUTPUT CONTRACT: Output EXACTLY ONE block per response, and it is always an ACTIONS block:

ACTIONS:[{"type":"...", ...}, {"type":"...", ...}]|Your coaching message here.

One block, one pipe, done. Never emit two blocks. When a message contains more than one intent ("log 8oz of water and add creatine to my stack"), that is TWO ENTRIES IN THE ONE ARRAY — not two blocks, and not a choice between them. If a request has no actionable intent, reply in plain text with no ACTIONS block at all.

The sections below say WHEN each action applies and WHAT fields it needs. Their field names are unchanged; only the wrapper differs. Map them to these type values:

- {"type":"food","items":[{name,grams,slot,cal,protein,carbs,fat,fiber,sugar,sodium}]}     — the FOOD LOGGING section (fiber/sugar in g, sodium in mg, totals for the grams given; 0 if unknown)
- {"type":"meal_suggestion","items":[{...,description}]}                — the MEAL SUGGESTIONS section
- {"type":"water","oz":16}                                              — the WATER LOGGING section
- {"type":"supplement","items":[{name,dose,timing,category,note}]}      — the SUPPLEMENT section
- {"type":"recipe","name":...,"ingredients":[...],"steps":[...],...}    — the RECIPE section
- {"type":"workout_plan","name":...,"exercises":[...],...}              — the WORKOUT PLAN section

Ignore the literal MULTI_FOOD:/WATER_LOG:/ADD_SUPP:/RECIPE:/WORKOUT_PLAN:/MEAL_SUGGESTION: prefixes shown in the examples below — those are the previous contract. Emit the same data as ACTIONS entries. Maximum 10 actions per response.

ACTION HYGIENE — these are hard rules, each one has produced a duplicate database row:
- ONE action per intent, and its quantity is the amount in THIS MESSAGE ONLY: "16 oz of water" is [{"type":"water","oz":16}] — never two entries of 16, never 16 plus a bare confirmation, and NEVER the day's running total from the live data (the app adds it to today's total itself).
- Every action must do something the user asked for IN THIS MESSAGE. Never emit an action to confirm, restate, or summarise — the message after the pipe is where you talk.
- Never re-emit an action from an earlier turn. Your earlier actions appear in the conversation as "[Logged …]" lines; those already happened. Only what THIS message asks for goes in the array.
- If the message asks for nothing to be logged, the array is empty: ACTIONS:[]|message.
${buildContextBlock()}

══════════════════════════════════════
FOOD LOGGING — MANDATORY FORMAT
══════════════════════════════════════
When the user mentions eating or logging food (single OR multiple items), respond ONLY in this format:

MULTI_FOOD:[{"name":"Grilled Chicken Breast","grams":200,"slot":"lunch","cal":330,"protein":62,"carbs":0,"fat":7},{"name":"White Rice","grams":150,"slot":"lunch","cal":195,"protein":4,"carbs":42,"fat":1}]|Your coaching message here.

STRICT RULES:
- Always use MULTI_FOOD format even for a single food item
- Use the current meal slot from live data unless user specifies otherwise
- Use realistic per-100g macros scaled to the actual grams mentioned
- Round all numbers to integers
- The message after | must be 1-2 sentences referencing their remaining macros
- Do NOT add code blocks or extra text

══════════════════════════════════════
MEAL SUGGESTIONS — MANDATORY FORMAT
══════════════════════════════════════
When the user asks what to eat, asks for meal ideas, or asks what fits their macros:

MEAL_SUGGESTION:[{"name":"Grilled Salmon","grams":180,"slot":"dinner","cal":372,"protein":54,"carbs":0,"fat":18,"description":"High protein, fits your fat remaining"},{"name":"Roasted Sweet Potato","grams":150,"slot":"dinner","cal":129,"protein":2,"carbs":30,"fat":0,"description":"Good carb source to hit your target"}]|Explanation of why this fits their goals.

RULES:
- Suggest 2-4 foods that together fit within REMAINING calories and macros
- description field explains why each food was chosen

══════════════════════════════════════
WATER LOGGING — MANDATORY FORMAT  
══════════════════════════════════════
When the user mentions drinking water: WATER_LOG:{"oz":16}|Tip here.
- Convert any unit to oz: 1 glass=8oz, 1 bottle=16oz, 1L=33.8oz

══════════════════════════════════════
SUPPLEMENT LOGGING — MANDATORY FORMAT
══════════════════════════════════════
When the user explicitly asks to add or recommend a supplement — respond ONLY in this format:

ADD_SUPP:[{"name":"Creatine Monohydrate","dose":"5g","timing":"Post-workout","category":"performance","note":"Take with water or juice for better absorption"},{"name":"Vitamin D3","dose":"2000 IU","timing":"Morning with food","category":"vitamin","note":"Pair with K2 for best absorption"}]|Your 1-2 sentence coaching note.

STRICT RULES:
- Use ADD_SUPP format when the user asks to add or get supplement recommendations — not for one-line coaching tips or general advice
- category must be one of: protein, vitamin, mineral, performance, health, sleep, fat_burner, probiotic
- Include realistic dose and optimal timing
- If user already has the supplement in their stack (check SUPPLEMENT STACK above), say so in the message after | instead of adding a duplicate
- Do NOT add code blocks or extra text

══════════════════════════════════════
RECIPE MODE
══════════════════════════════════════
When user asks for a recipe, asks "how do I make X", or says "give me a recipe for X":

RECIPE:{"name":"High Protein Chicken Bowl","totalCal":520,"totalProtein":58,"totalCarbs":42,"totalFat":12,"servings":1,"ingredients":[{"name":"Grilled Chicken Breast","grams":200,"cal":330,"protein":62,"carbs":0,"fat":7},{"name":"Brown Rice","grams":100,"cal":111,"protein":3,"carbs":23,"fat":1},{"name":"Broccoli","grams":80,"cal":27,"protein":3,"carbs":5,"fat":0}],"steps":["Season chicken with salt, pepper, garlic powder","Grill 6-7 mins each side until 165°F","Cook rice per package","Steam broccoli 5 mins","Assemble and serve"],"slot":"lunch"}|Brief coaching note.

RULES: ingredients must have accurate macros, max 6 steps, slot matches time of day.

══════════════════════════════════════
WORKOUT PLAN CREATION — MANDATORY FORMAT
══════════════════════════════════════
When user asks to create, build, or add a workout — respond ONLY in this format:

WORKOUT_PLAN:{"name":"Push Day","tag":"Push","level":"Intermediate","estMin":45,"scheduledDay":"Monday","exercises":[{"name":"Bench Press","sets":4,"reps":8,"weight":135},{"name":"Overhead Press","sets":3,"reps":10,"weight":75},{"name":"Tricep Pushdown","sets":3,"reps":12,"weight":50}]}|One coaching tip about this workout.

RULES:
- scheduledDay must be a day of the week or null
- weight is in lbs, use 0 if bodyweight
- Always include at least 4 exercises
- level: Beginner / Intermediate / Advanced`;
  const callClaude=async(userMsg,history)=>{
    // isError bubbles are our own failure text, not something the coach said.
    // Replayed as assistant turns they poison every later request — and if one
    // lands first in the window, messages[0].role is "assistant" and Anthropic
    // 400s, so a single failure breaks the conversation permanently.
    const res=await fetch("/api/coach",{
      method:"POST",
      headers:coachHeaders(),
      body:JSON.stringify({max_tokens:1200,system:buildSystem(),messages:buildRequestMessages(userMsg,history)}),
    });
    if(!res.ok){
      const errBody=await res.json().catch(()=>({}));
      if(errBody.error)console.error("[WiFit/coach]",errBody.error);
      // Carry the status so callers can tell "signed out" from "network down".
      const err=new Error("API error "+res.status);
      err.status=res.status;
      err.userMessage=errBody.error||"";
      throw err;
    }
    const data=await res.json();
    return data.content?.[0]?.text||"Sorry, I couldn't get a response. Try again!";
  };

  // ── Feature 3: Weekly check-in on Monday ──────────────────────
  useEffect(()=>{
    if(!open||checkinDoneRef.current)return;
    const now=new Date();
    if(now.getDay()!==1)return; // Only Monday
    const lastKey="wifit_checkin_"+now.getFullYear()+"_"+now.getMonth()+"_w"+Math.floor(now.getDate()/7);
    if(localStorage.getItem(lastKey))return;
    checkinDoneRef.current=true;
    localStorage.setItem(lastKey,"1");

    const c=liveContext;
    const generateCheckin=async()=>{
      setThinking(true);
      try{
        const prompt="Generate a Monday weekly check-in summary for "+(userName||"the user")+".\n"+
"Their current stats: "+(c.calConsumed||0)+" kcal consumed today, "+(c.waterOz||0)+"oz water, workout "+(c.workoutDone?"done":"not done")+", "+(c.suppTaken||0)+"/"+(c.suppTotal||0)+" supplements taken.\n"+
"Goal: "+(c.calGoal||2200)+" kcal/day.\n\n"+
"Write a warm, motivating 2-3 sentence Monday check-in message that:\n"+
"1. Acknowledges it's the start of a new week\n"+
"2. Gives 1 specific actionable goal for the week based on their stats\n"+
"3. Ends with encouragement\n\n"+
"Keep it personal and concise. Do NOT use any logging format — just plain text.";
        const reply=await callClaude(prompt,[]);
        setMessages(prev=>[...prev,{bot:true,text:reply,isCheckin:true}]);
      }catch{
        setMessages(prev=>[...prev,{bot:true,text:"Happy Monday"+(userName?" "+userName.split(" ")[0]:"")+"! 🌟 New week, fresh start. What are we tackling today?",isCheckin:true}]);
      }
      setThinking(false);
    };
    setTimeout(generateCheckin,800);
  },[open]);

  const parseMultiFoodReply=(reply)=>{
    if(!reply.startsWith("MULTI_FOOD:"))return null;
    try{
      const rest=reply.slice("MULTI_FOOD:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Logged!";
      const items=JSON.parse(jsonStr);
      return{items,msg};
    }catch{return null;}
  };

  const parseWaterReply=(reply)=>{
    if(!reply.startsWith("WATER_LOG:"))return null;
    try{
      const rest=reply.slice("WATER_LOG:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Water logged!";
      const data=JSON.parse(jsonStr);
      return{oz:data.oz||8,msg};
    }catch{return null;}
  };

  const parseMealSuggestion=(reply)=>{
    if(!reply.startsWith("MEAL_SUGGESTION:"))return null;
    try{
      const rest=reply.slice("MEAL_SUGGESTION:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Here's what fits your goals!";
      const items=JSON.parse(jsonStr);
      return{items,msg};
    }catch{return null;}
  };

  const parseWorkoutReply=(reply)=>{
    if(!reply.startsWith("WORKOUT_PLAN:"))return null;
    try{
      const rest=reply.slice("WORKOUT_PLAN:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Here's your workout!";
      const plan=JSON.parse(jsonStr);
      return{plan,msg};
    }catch{return null;}
  };

  const parseRecipe=(reply)=>{
    if(!reply.startsWith("RECIPE:"))return null;
    try{
      const rest=reply.slice("RECIPE:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Here's your recipe!";
      const recipe=JSON.parse(jsonStr);
      return{recipe,msg};
    }catch{return null;}
  };

  const parseAddSupp=(reply)=>{
    if(!reply.startsWith("ADD_SUPP:"))return null;
    try{
      const rest=reply.slice("ADD_SUPP:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Supplement added!";
      const items=JSON.parse(jsonStr);
      return{items,msg};
    }catch{return null;}
  };

  // Emits exactly the message objects the six card renderers already consume —
  // no renderer changes. Auto-commit is limited to water and food, both of which
  // have a one-tap undo elsewhere in the app; supplement, workout_plan, recipe
  // and meal_suggestion all render as proposals.
  // recipe and workout_plan carry their payload flat on the action; the card
  // renderers want it nested under .recipe / .plan without the discriminator.
  const withoutType=(a)=>{const o={...a};delete o.type;return o;};

  const applyActions=({valid,dropped,overflow,msg,total})=>{
    const out=[];
    let hasSupp=false;
    valid.forEach(a=>{
      const text=out.length===0?msg:"";
      if(a.type==="water"&&onAddWater){
        const oz=Number(a.oz);
        onAddWater(oz);
        out.push({bot:true,type:"water_logged",oz,text:text||"Water logged!"});
      }else if(a.type==="food"&&onAddFood){
        const logged=[];
        a.items.forEach(item=>{
          onAddFood(item.slot||"snacks",{
            id:Date.now()+Math.random(),
            name:item.name,
            grams:item.grams,
            color:COLORS[Math.floor(Math.random()*COLORS.length)],
            per100:per100From(item),
          });
          logged.push(item);
        });
        out.push({bot:true,type:"multi_food_logged",items:logged,text});
      }else if(a.type==="meal_suggestion"){
        out.push({bot:true,type:"meal_suggestion",items:a.items,text,logged:false});
      }else if(a.type==="recipe"){
        out.push({bot:true,type:"recipe",recipe:withoutType(a),text,logged:false});
      }else if(a.type==="workout_plan"){
        out.push({bot:true,type:"workout_plan",plan:withoutType(a),text,added:false});
      }else if(a.type==="supplement"&&onAddSupp){
        hasSupp=true;
        out.push({bot:true,type:"supp_added",items:a.items,text,added:false});
      }
    });
    // Nothing rendered a card, but the model still said something.
    if(out.length===0&&msg)out.push({bot:true,text:msg});
    // Name what was dropped. Silence here would recreate the failure mode this
    // whole contract exists to avoid.
    const skipped=dropped.length+overflow;
    if(skipped>0){
      const names=dropped.length?dropped.join(", "):"";
      out.push({bot:true,text:"Couldn't apply "+skipped+" of "+total+" actions"+(names?" ("+names+")":"")+(overflow>0?" — over the "+MAX_ACTIONS+"-action limit":"")+"."});
    }
    setMessages(prev=>[...prev,...out]);
    if(hasSupp&&msg)generateSuggestions(msg);
  };

  const send=async(text)=>{
    const msg=text||input.trim();
    if(!msg||thinking)return;
    setInput("");setSuggestions([]);
    const userMsg={bot:false,text:msg};
    setMessages(prev=>[...prev,userMsg]);

    // Every message goes to the model. There is no local pre-classification:
    // the old parseIntent matched substrings against 81 hardcoded product names
    // and committed a write before the model was ever asked. "ate" is a
    // substring of "water", so "how much water should I drink" logged 8 oz; and
    // "protein" in the supplement word list meant "I had 30g of protein" added a
    // whey product to the stack instead of logging food. The model already
    // returns a format prefix — it is the only thing that should choose.
    setThinking(true);
    try{
      // Prior turns only. Passing [...messages,userMsg] here while callClaude
      // appended userMsg again sent every request with the user's message TWICE —
      // the model logged "both 16oz entries" and two chicken rows landed 6 ms
      // apart (known issue #17). buildRequestMessages also guards against it.
      const reply=await callClaude(msg,messages);

      // ── Current contract ──
      const actions=parseActions(reply);
      if(actions){
        applyActions(actions);
        setThinking(false);return;
      }

      // ── Legacy contract, still honoured (C1) ──
      // Both contracts are live so a mid-rollout regression to a single-format
      // reply routes correctly instead of falling through to raw text. Removing
      // the six parsers is safe only once this warn stops appearing in real use.
      const legacy=LEGACY_PREFIXES.find(p=>reply.startsWith(p));
      if(legacy)console.warn("[coach] legacy format:",legacy,"— still in use; parser removal (C2) not yet safe.");

      // Multi-food
      const foodParsed=parseMultiFoodReply(reply);
      if(foodParsed&&onAddFood){
        const loggedItems=[];
        foodParsed.items.forEach(item=>{
          const foodObj={
            id:Date.now()+Math.random(),
            name:item.name,
            grams:item.grams,
            color:COLORS[Math.floor(Math.random()*COLORS.length)],
            per100:per100From(item),
          };
          onAddFood(item.slot||"snacks",foodObj);
          loggedItems.push(item);
        });
        setMessages(prev=>[...prev,{bot:true,type:"multi_food_logged",items:loggedItems,text:foodParsed.msg}]);
        setThinking(false);return;
      }

      // Meal suggestion
      const mealParsed=parseMealSuggestion(reply);
      if(mealParsed){
        setMessages(prev=>[...prev,{bot:true,type:"meal_suggestion",items:mealParsed.items,text:mealParsed.msg,logged:false}]);
        setThinking(false);return;
      }

      // Recipe
      const recipeParsed=parseRecipe(reply);
      if(recipeParsed){
        setMessages(prev=>[...prev,{bot:true,type:"recipe",recipe:recipeParsed.recipe,text:recipeParsed.msg,logged:false}]);
        setThinking(false);return;
      }
      // Water
      const waterParsed=parseWaterReply(reply);
      if(waterParsed&&onAddWater){
        onAddWater(waterParsed.oz);
        setMessages(prev=>[...prev,{bot:true,type:"water_logged",oz:waterParsed.oz,text:waterParsed.msg}]);
        setThinking(false);return;
      }

      // Supplement add (from Claude structured response)
      const suppParsed=parseAddSupp(reply);
      // Proposed, not committed. The stack is persistent and there is no undo
      // in the chat, so a supplement gets the same confirmation card
      // WORKOUT_PLAN and RECIPE already use. This is what turns a misrouted
      // reply — "please remove my push day workout" answered with a B12 block —
      // into a card the user can ignore instead of a write they have to undo.
      if(suppParsed&&onAddSupp){
        setMessages(prev=>[...prev,{bot:true,type:"supp_added",items:suppParsed.items,text:suppParsed.msg,added:false}]);
        generateSuggestions(suppParsed.msg);
        setThinking(false);return;
      }
      const workoutParsed=parseWorkoutReply(reply);
      if(workoutParsed){
        setMessages(prev=>[...prev,{bot:true,type:"workout_plan",plan:workoutParsed.plan,text:workoutParsed.msg,added:false}]);
        setThinking(false);return;
      }

      // Plain text
      setMessages(prev=>[...prev,{bot:true,text:reply}]);
      generateSuggestions(reply);
    }catch(e){
      setMessages(prev=>[...prev,{bot:true,isError:true,
        text:coachErrorText(e,"I'm having trouble connecting right now. Try again!")}]);
    }
    setThinking(false);
  };

  const addPlanToWorkouts=(msgIdx,plan)=>{
    onAddWorkout&&onAddWorkout(plan);
    setMessages(prev=>prev.map((m,i)=>i===msgIdx?{...m,added:true}:m));
  };

  // Commits the supplements a reply proposed. Mirrors addPlanToWorkouts: the
  // write happens here, on an explicit tap, not on the reply arriving.
  const addSuppsToStack=(msgIdx,items)=>{
    (items||[]).forEach(s=>{
      const dot=SUPP_CATEGORY_DOTS[s.category]||"#888";
      onAddSupp&&onAddSupp({k:"ai"+Date.now()+Math.random(),name:s.name,sub:(s.dose||"")+(s.timing?" · "+s.timing:""),dot,category:s.category,note:s.note});
    });
    setMessages(prev=>prev.map((m,i)=>i===msgIdx?{...m,added:true}:m));
  };

  // ── Feature 4: Voice input ────────────────────────────────────
  const [listening,setListening]=useState(false);
  const recognitionRef=useRef(null);
  const hasVoice=typeof window!=="undefined"&&("SpeechRecognition" in window||"webkitSpeechRecognition" in window);

  const startListening=()=>{
    if(!hasVoice||listening)return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const rec=new SR();
    rec.continuous=false;rec.interimResults=false;rec.lang="en-US";
    rec.onstart=()=>setListening(true);
    rec.onresult=(e)=>{
      const transcript=e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    rec.onerror=()=>setListening(false);
    rec.onend=()=>setListening(false);
    recognitionRef.current=rec;
    rec.start();
  };

  const stopListening=()=>{
    recognitionRef.current?.stop();
    setListening(false);
  };

  // ── Feature 8: Contextual suggested replies ───────────────────
  const generateSuggestions=async(lastBotMsg)=>{
    if(!lastBotMsg||lastBotMsg.length<10)return;
    try{
      const res=await fetch("/api/coach",{
        method:"POST",headers:coachHeaders(),
        body:JSON.stringify({
          max_tokens:120,
          system:"You are a fitness AI. Given the assistant's last response, output EXACTLY 3 short follow-up questions/actions the user might want next, as a JSON array of strings. Max 6 words each. No punctuation. Output ONLY the JSON array, nothing else.",
          messages:[{role:"user",content:"Assistant just said: \""+lastBotMsg.slice(0,200)+"\"\nGenerate 3 follow-ups:"}],
        }),
      });
      const d=await res.json();
      const rawText=d.content?.[0]?.text||"[]";
      const bt=String.fromCharCode(96);
      const cleanText=rawText.split(bt+bt+bt+"json").join("").split(bt+bt+bt).join("").trim();
      const arr=JSON.parse(cleanText);
      if(Array.isArray(arr))setSuggestions(arr.slice(0,3));
    }catch{setSuggestions([]);}
  };

  // ── Feature 9: Photo food logging ────────────────────────────
  const analyzePhoto=async(file)=>{
    setPhotoLoading(true);setSuggestions([]);
    setMessages(prev=>[...prev,{bot:false,text:"📷 Analyzing photo…"}]);
    try{
      const base64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(",")[1]);
        r.onerror=rej;r.readAsDataURL(file);
      });
      const hour=new Date().getHours();
      const slotHint=hour<12?"breakfast":hour<17?"lunch":"dinner";
      const resp=await fetch("/api/coach",{
        method:"POST",headers:coachHeaders(),
        body:JSON.stringify({
          max_tokens:600,
          system:"You are a nutrition AI analyzing a food photo. Respond ONLY in this exact format:\n"+
"MULTI_FOOD:[{\"name\":\"Food Name\",\"grams\":150,\"slot\":\""+slotHint+"\",\"cal\":247,\"protein\":46,\"carbs\":0,\"fat\":6}]|One sentence about the meal.\n"+
"Rules: estimate grams from visual cues, include ALL visible foods, use slot \""+slotHint+"\". If no food visible: PHOTO_ERROR:Cannot identify food in this image.|",
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}},
            {type:"text",text:"Log the food in this photo."},
          ]}],
        }),
      });
      if(!resp.ok){
        // Without this a 401 fell through as an empty reply and reported
        // "couldn't parse the meal" — blaming the photo for an auth failure.
        const eb=await resp.json().catch(()=>({}));
        if(eb.error)console.error("[WiFit/coach]",eb.error);
        const err=new Error("API error "+resp.status);
        err.status=resp.status;
        err.userMessage=eb.error||"";
        throw err;
      }
      const d=await resp.json();
      const reply=d.content?.[0]?.text||"";
      if(reply.startsWith("PHOTO_ERROR:")){
        setMessages(prev=>[...prev,{bot:true,text:reply.slice(12).split("|")[0]||"Could not identify food. Try a clearer photo."}]);
      }else{
        const parsed=parseMultiFoodReply(reply);
        if(parsed&&onAddFood){
          const items=[];
          parsed.items.forEach(item=>{
            onAddFood(item.slot||slotHint,{id:Date.now()+Math.random(),name:item.name,grams:item.grams,color:COLORS[Math.floor(Math.random()*COLORS.length)],
              per100:per100From(item)});
            items.push(item);
          });
          const msg={bot:true,type:"multi_food_logged",items,text:parsed.msg};
          setMessages(prev=>[...prev,msg]);
          generateSuggestions(parsed.msg);
        }else{
          setMessages(prev=>[...prev,{bot:true,text:"Couldn't parse the meal from that photo. Try again with better lighting."}]);
        }
      }
    }catch(e){setMessages(prev=>[...prev,{bot:true,isError:true,
      text:coachErrorText(e,"Photo analysis failed. Check your connection and try again.")}]);}
    setPhotoLoading(false);
  };

  const renderMsg=(m,i)=>{

    // ── Recipe card ─────────────────────────────────────────────
    // Its own component: it owns collapsible state, and a hook cannot live in
    // renderMsg (see RecipeCard).
    if(m.type==="recipe")return <RecipeCard key={i} m={m} idx={i} onAddFood={onAddFood} setMessages={setMessages}/>;

    // ── Meal suggestion card ────────────────────────────────────
    if(m.type==="meal_suggestion"){
      const totalCal=m.items.reduce((s,it)=>s+(it.cal||0),0);
      const totalProt=m.items.reduce((s,it)=>s+(it.protein||0),0);
      const totalCarbs=m.items.reduce((s,it)=>s+(it.carbs||0),0);
      const totalFat=m.items.reduce((s,it)=>s+(it.fat||0),0);
      const logAll=()=>{
        if(!onAddFood)return;
        m.items.forEach(item=>{
          onAddFood(item.slot||"snacks",{
            id:Date.now()+Math.random(),
            name:item.name,grams:item.grams,
            color:COLORS[Math.floor(Math.random()*COLORS.length)],
            per100:per100From(item),
          });
        });
        setMessages(prev=>prev.map((x,xi)=>xi===i?{...x,logged:true}:x));
      };
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,overflow:"hidden",boxShadow:T.glowShadow}}>
            <div style={{padding:"10px 14px 8px",borderBottom:("1px solid "+T.border)}}>
              <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Suggested meal</div>
              {m.items.map((it,ii)=>(
                <div key={ii} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{it.name} <span style={{fontSize:11,color:T.muted,fontWeight:400}}>{it.grams}g</span></div>
                    <div style={{fontSize:12,fontWeight:700,color:T.accent}}>{it.cal} kcal</div>
                  </div>
                  {it.description&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{it.description}</div>}
                </div>
              ))}
            </div>
            {/* Totals row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,borderBottom:("1px solid "+T.border)}}>
              {[["Cal",totalCal,T.macro[0]],["Prot",totalProt+"g",T.macro[1]],["Carbs",totalCarbs+"g",T.macro[2]],["Fat",totalFat+"g",T.macro[3]]].map(([l,v,c],ti)=>(
                <div key={l} style={{padding:"7px 4px",textAlign:"center",borderRight:ti<3?"1px solid "+T.border:"none"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:9,color:T.muted,marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
            {/* Log button */}
            {m.logged
              ?<div style={{padding:"10px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.green}}>✓ Logged to your food diary</div>
              :<div onClick={logAll} style={{padding:"11px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.accent,cursor:"pointer",background:T.accentPill}}>
                + Log this meal
              </div>
            }
          </div>
        </div>
      );
    }

    // ── Multi-food logged card ──────────────────────────────────
    if(m.type==="multi_food_logged"){
      const totalCal=m.items.reduce((s,it)=>s+(it.cal||0),0);
      const totalProt=m.items.reduce((s,it)=>s+(it.protein||0),0);
      const totalCarbs=m.items.reduce((s,it)=>s+(it.carbs||0),0);
      const totalFat=m.items.reduce((s,it)=>s+(it.fat||0),0);
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"98%",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:14,padding:"12px 14px",color:"#fff"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Logged to {m.items[0]?.slot||"snacks"}</div>
            {m.items.map((it,ii)=>(
              <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:ii<m.items.length-1?"1px solid rgba(255,255,255,0.08)":"none"}}>
                <div style={{fontSize:13,fontWeight:500}}>{it.name} <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{it.grams}g</span></div>
                <div style={{fontSize:12,fontWeight:700,color:T.accentSoft}}>{it.cal} kcal</div>
              </div>
            ))}
            <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.12)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
              {[["Cal",totalCal,"#A855F7"],["Prot",totalProt+"g","#EC4899"],["Carbs",totalCarbs+"g","#06B6D4"],["Fat",totalFat+"g","#10B981"]].map(([l,v,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,0.07)",borderRadius:7,padding:"5px 3px",textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ── Water logged card ───────────────────────────────────────
    if(m.type==="water_logged"){
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"95%",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:"linear-gradient(135deg,rgba(6,182,212,0.18),rgba(6,182,212,0.06))",border:("1px solid "+T.accent+"44"),borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:24}}>💧</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:T.accent}}>{m.oz} oz logged</div>
              <div style={{fontSize:11,color:T.muted,marginTop:1}}>Added to your daily water intake</div>
            </div>
          </div>
        </div>
      );
    }

    // ── Supplements added card ──────────────────────────────────
    if(m.type==="supp_added"){
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,overflow:"hidden",boxShadow:T.glowShadow}}>
            <div style={{padding:"8px 14px",borderBottom:("1px solid "+T.border),display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:14}}>💊</div>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>{m.added?"Added to your stack":"Suggested supplements"}</div>
            </div>
            {m.items.map((s,si)=>{
              const dot=SUPP_CATEGORY_DOTS[s.category]||"#888";
              return(
                <div key={si} style={{padding:"10px 14px",borderBottom:si<m.items.length-1?"1px solid "+T.border:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:dot,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{s.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>{s.dose}{s.timing?" · "+s.timing:""}</div>
                    </div>
                    {m.added&&<div style={{background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,color:"#22C55E"}}>✓ Added</div>}
                  </div>
                  {s.note&&<div style={{fontSize:11,color:T.muted,marginTop:6,paddingLeft:20,lineHeight:1.5,fontStyle:"italic"}}>{s.note}</div>}
                </div>
              );
            })}
            <div style={{padding:"10px 14px",borderTop:("1px solid "+T.border)}}>
              {m.added
                ?<div style={{background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:10,padding:"10px",textAlign:"center",color:"#22C55E",fontSize:13,fontWeight:700}}>✓ Added to your stack</div>
                :<button onClick={()=>addSuppsToStack(i,m.items)} style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>💊 Add to my stack</button>
              }
            </div>
          </div>
        </div>
      );
    }

    // ── Workout plan card ───────────────────────────────────────
    if(m.type==="workout_plan"){
      const p=m.plan;
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:14,padding:14,border:("1px solid "+T.border)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{p.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>{p.tag} · {p.level} · ~{p.estMin}min{p.scheduledDay?" · "+p.scheduledDay:""}</div>
              </div>
              <div style={{background:"rgba(6,182,212,0.2)",borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:700,color:T.accent}}>{p.exercises?.length} exercises</div>
            </div>
            {(p.exercises||[]).map((ex,ei)=>(
              <div key={ei} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"7px 10px",marginBottom:5}}>
                <div style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.9)"}}>{ex.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{ex.sets}×{ex.reps}{ex.weight>0?" · "+ex.weight+"lbs":""}</div>
              </div>
            ))}
            {m.added
              ?<div style={{marginTop:8,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:10,padding:"10px",textAlign:"center",color:"#22C55E",fontSize:13,fontWeight:700}}>✓ Added to your workout plans</div>
              :<button onClick={()=>addPlanToWorkouts(i,p)} style={{marginTop:8,width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>💪 Add to my workout plans</button>
            }
          </div>
        </div>
      );
    }

    // ── Plain message ───────────────────────────────────────────
    return(
      <div key={i} style={{maxWidth:"90%",padding:"9px 12px",borderRadius:m.bot?"14px 14px 14px 3px":"14px 14px 3px 14px",fontSize:13,lineHeight:1.5,background:m.bot?T.surface:T.accent,color:m.bot?T.text:"#fff",alignSelf:m.bot?"flex-start":"flex-end"}}>{m.text}</div>
    );
  };

  return(
    <>
      {open&&<div onClick={onClose} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.15)",zIndex:150}}/>}
      <div style={{position:"fixed",top:0,right:0,height:"100%",width:open?"min(300px,82vw)":0,background:T.card,borderLeft:open?"1px solid "+T.border:"none",zIndex:160,transition:"width 0.3s cubic-bezier(.4,0,.2,1)",overflow:"hidden",display:"flex",flexDirection:"column",maxWidth:"80%"}}>
        <div style={{width:"100%",display:"flex",flexDirection:"column",height:"100%"}}>
          <div style={{padding:"16px 14px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,background:thinking?"#F59E0B":T.accent,borderRadius:"50%",transition:"background 0.3s",boxShadow:thinking?"0 0 8px #F59E0B":""}}/>
              <div style={{fontSize:15,fontWeight:600,color:T.text}}>AI Coach</div>
              {thinking&&<div style={{fontSize:11,color:"#F59E0B",fontWeight:500}}>thinking…</div>}
            </div>
            {/* Text, not an icon: this is destructive and sits next to the ✕.
                The only escape from a broken chat, so it lives in the header —
                the message list scrolls away and the composer needs a working
                round trip. */}
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div onClick={()=>{
                if(confirmClear){clearChat();return;}
                setConfirmClear(true);
                setTimeout(()=>setConfirmClear(false),3000);
              }} style={{fontSize:12,fontWeight:confirmClear?700:500,color:confirmClear?"#E24B4A":T.muted,cursor:"pointer",padding:"4px 6px",userSelect:"none"}}>
                {confirmClear?"Clear?":"Clear"}
              </div>
              <div onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 12px 8px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m,i)=>renderMsg(m,i))}
            {thinking&&(
              <div style={{alignSelf:"flex-start",background:T.surface,borderRadius:"14px 14px 14px 3px",padding:"10px 14px",display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.accent,opacity:0.8,animation:("bounce 1.2s ease-in-out "+i*0.2+"s infinite")}}/>)}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          {/* Suggested replies — Feature 8 */}
          {suggestions.length>0&&!thinking&&(
            <div style={{padding:"0 10px 6px",display:"flex",gap:5,flexWrap:"wrap"}}>
              {suggestions.map((s,i)=>(
                <div key={i} onClick={()=>send(s)}
                  style={{background:T.accentPill,border:("1px solid "+T.accent+"44"),borderRadius:16,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",color:T.accent,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  {s}
                </div>
              ))}
            </div>
          )}
          <div style={{padding:"0 10px 8px",display:"flex",gap:6,flexWrap:"wrap"}}>
            {["Log my lunch","Add creatine to my stack","Make me a leg day","What should I eat now?"].map(c=>(
              <div key={c} onClick={()=>!thinking&&send(c)} style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:500,cursor:thinking?"not-allowed":"pointer",whiteSpace:"nowrap",color:thinking?T.muted:T.text,opacity:thinking?0.5:1}}>{c}</div>
            ))}
          </div>
          <div style={{padding:"8px 10px 20px",borderTop:("1px solid "+T.border),display:"flex",gap:6,flexShrink:0}}>
            {/* Photo button — Feature 9 */}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
              onChange={e=>{const f=e.target.files?.[0];if(f)analyzePhoto(f);e.target.value="";}}/>
            <button onClick={()=>!thinking&&!photoLoading&&photoInputRef.current?.click()} disabled={thinking||photoLoading}
              title="Log food from photo"
              style={{width:34,height:34,borderRadius:"50%",background:photoLoading?"#F59E0B":T.surface,border:"1px solid "+(photoLoading?"#F59E0B":T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:(thinking||photoLoading)?"not-allowed":"pointer",flexShrink:0,transition:"all 0.2s"}}>
              {photoLoading
                ?<div style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                :<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.muted} strokeWidth="1.4" strokeLinecap="round">
                  <rect x="1" y="3" width="12" height="9" rx="1.5"/>
                  <circle cx="7" cy="7.5" r="2.5"/>
                  <path d="M5 3V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V3"/>
                </svg>
              }
            </button>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!thinking&&send()}
              placeholder={listening?"Listening…":thinking?"Claude is thinking…":"Log food, water, or ask anything…"}
              disabled={thinking}
              style={{flex:1,background:T.surface,color:T.text,border:("1px solid "+listening?T.accent:T.border),boxShadow:listening?T.glowShadow:"none",borderRadius:20,padding:"8px 12px",fontSize:13,outline:"none",opacity:thinking?0.6:1,transition:"border-color 0.2s"}}/>
            {/* Mic button */}
            {hasVoice&&(
              <button onClick={listening?stopListening:startListening} disabled={thinking}
                title={listening?"Stop listening":"Voice input"}
                style={{width:34,height:34,borderRadius:"50%",background:listening?"#EF4444":T.surface,border:"1px solid "+(listening?"#EF4444":T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:thinking?"not-allowed":"pointer",flexShrink:0,transition:"all 0.2s",boxShadow:listening?"0 0 8px rgba(239,68,68,0.4)":"none"}}>
                <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
                  <rect x="3.5" y="1" width="6" height="9" rx="3" fill={listening?"#fff":T.muted}/>
                  <path d="M1 8c0 3 2.5 5 5.5 5s5.5-2 5.5-5" stroke={listening?"#fff":T.muted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  <line x1="6.5" y1="13" x2="6.5" y2="15.5" stroke={listening?"#fff":T.muted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <button onClick={()=>!thinking&&send()} disabled={thinking}
              style={{width:34,height:34,borderRadius:"50%",background:thinking?T.muted:T.accent,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:thinking?"not-allowed":"pointer",flexShrink:0,transition:"background 0.2s"}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L12 2L9 7L12 12L2 7Z" fill="white"/></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── SUPPLEMENT SEARCH PANEL ──────────────────────────────────────

function SuppSearchPanel({suppList,suppTaken,setSuppTaken,addSuppToList}){
  const T=useTheme();
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [cat,setCat]=useState("All");
  const [showCreate,setShowCreate]=useState(false);
  const [newName,setNewName]=useState("");
  const [newDose,setNewDose]=useState("");
  const [newCat,setNewCat]=useState("Supplement");
  const [createSaved,setCreateSaved]=useState(false);

  const taken=suppList.filter(s=>suppTaken[s.k]).length;
  const total=suppList.length;
  const browsing=!query.trim()&&!searched;
  const displayed=browsing
    ?(cat==="All"?SUPP_DB:SUPP_DB.filter(s=>s.category===cat)).slice(0,12)
    :results;

  const doSearch=async()=>{
    if(!query.trim())return;
    setLoading(true);setResults([]);setSearched(false);setShowCreate(false);
    try{
      const r=await searchSupp(query);
      setResults(r);
      setSearched(true);
      if(r.length===0)setShowCreate(true);
    }catch{
      const fallback=searchLocalSupp(query).map(s=>({...s,isSupp:true}));
      setResults(fallback);
      setSearched(true);
      if(fallback.length===0)setShowCreate(true);
    }
    setLoading(false);
  };

  const clearSearch=()=>{setQuery("");setResults([]);setSearched(false);setShowCreate(false);};

  const addFromSearch=(s)=>{
    // s.category is SUPP_DB's product type; the column stores purpose. The dot
    // still comes from DOT_COLORS by type, so nothing changes visually.
    addSuppToList({k:"s"+Date.now(),name:s.name,sub:(s.servingG?s.servingG+"g · ":"")+(s.brand||s.category||"Supplement"),dot:DOT_COLORS[s.category]||"#888",category:toSuppCategory(s.category)});
    clearSearch();
  };

  const saveCustom=()=>{
    if(!newName.trim())return;
    addSuppToList({k:"m"+Date.now(),name:newName.trim(),sub:newDose.trim()||newCat,dot:DOT_COLORS[newCat]||"#888",category:toSuppCategory(newCat)});
    setCreateSaved(true);
    setTimeout(()=>{
      setCreateSaved(false);setNewName("");setNewDose("");setNewCat("Supplement");
      setShowCreate(false);clearSearch();
    },900);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Stats */}
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1,background:T.greenBg,borderRadius:12,padding:"12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:600,color:T.green}}>{taken}/{total}</div>
          <div style={{fontSize:12,color:T.green,marginTop:2}}>taken today</div>
        </div>
        <div style={{flex:1,background:"rgba(249,115,22,0.1)",borderRadius:12,padding:"12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:600,color:"#F97316"}}>{total-taken}</div>
          <div style={{fontSize:12,color:"#F97316",marginTop:2}}>remaining</div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{display:"flex",gap:8,width:"100%"}}>
        <input
          value={query}
          onChange={e=>{setQuery(e.target.value);if(!e.target.value.trim()){setResults([]);setSearched(false);setShowCreate(false);}}}
          onKeyDown={e=>e.key==="Enter"&&doSearch()}
          placeholder="Search supplements (e.g. Creatine, AG1...)"
          style={{flex:1,minWidth:0,background:T.inputBg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none"}}
        />
        <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,flexShrink:0,minWidth:64}}>
          {loading?"…":"Search"}
        </button>
      </div>

      {/* Category chips — browsing only */}
      {browsing&&(
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {SUPP_CATS.map(c=>(
            <div key={c} onClick={()=>setCat(c)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),background:cat===c?T.accent:T.card,color:cat===c?"#fff":T.muted,whiteSpace:"nowrap",flexShrink:0}}>{c}</div>
          ))}
        </div>
      )}

      {/* Results */}
      {displayed.length>0&&(
        <div>
          <div style={{fontSize:12,color:T.muted,marginBottom:8}}>{browsing?"Browse & add to your stack":"Tap to add to your stack"}</div>
          {displayed.map((s,i)=>(
            <div key={i} onClick={()=>addFromSearch(s)} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",marginBottom:7,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:DOT_COLORS[s.category]||"#888",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,lineHeight:1.3}}>{s.name}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:1}}>{s.brand||""}{s.category?" · "+s.category:""}{s.servingG?" · "+s.servingG+"g/serving":""}</div>
              </div>
              <div style={{width:26,height:26,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round"/><line x1="2" y1="6" x2="10" y2="6" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results state — show create option */}
      {searched&&results.length===0&&!showCreate&&(
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:14,color:T.muted}}>No results for "{query}"</div>
          <div onClick={()=>setShowCreate(true)} style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:6,background:T.accentPill,border:("1px solid "+T.border),borderRadius:20,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}>
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
            Create "{query}"
          </div>
        </div>
      )}

      {/* Create supplement form */}
      {showCreate&&(
        <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:T.accentPill,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="8.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.8" fill={T.accent}/></svg>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.accent}}>No results found</div>
              <div style={{fontSize:11,color:T.muted,marginTop:1}}>Create a custom supplement and it'll be saved to your stack.</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>Create supplement</div>
            <div onClick={()=>{setShowCreate(false);}} style={{fontSize:12,color:T.muted,cursor:"pointer"}}>Cancel</div>
          </div>
          <input
            value={newName} onChange={e=>setNewName(e.target.value)}
            placeholder="Name (e.g. Ashwagandha 600mg)"
            style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}
          />
          <input
            value={newDose} onChange={e=>setNewDose(e.target.value)}
            placeholder="Dose & timing (e.g. 600mg · Morning)"
            style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}
          />
          <div>
            <div style={{fontSize:12,color:T.muted,marginBottom:7}}>Category</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Protein","Vitamins","Creatine","Omega-3","Pre-Workout","Sleep","Supplement"].map(c=>(
                <div key={c} onClick={()=>setNewCat(c)} style={{padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),background:newCat===c?T.accent:T.card,color:newCat===c?"#fff":T.muted}}>{c}</div>
              ))}
            </div>
          </div>
          <button
            onClick={saveCustom}
            disabled={!newName.trim()}
            style={{background:createSaved?"#22C55E":(!newName.trim()?T.muted:T.accent),border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:600,cursor:newName.trim()?"pointer":"not-allowed",transition:"background 0.2s"}}
          >
            {createSaved?"Added to stack ✓":"Add to my stack"}
          </button>
        </div>
      )}

      {/* Stack divider */}
      {!showCreate&&(
      <div>
        <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}}>Your stack</div>
        <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,overflow:"hidden"}}>
          {suppList.map(({k,name,sub,dot},i)=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:i<suppList.length-1?"1px solid "+T.border:"none"}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:dot,flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:T.text}}>{name}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{sub}</div></div>
              <div onClick={()=>setSuppTaken(k,!suppTaken[k])} style={{width:44,height:26,borderRadius:13,background:suppTaken[k]?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:suppTaken[k]?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
          ))}
        </div>
        {/* Add custom shortcut */}
        <div onClick={()=>{setShowCreate(true);setNewName("");}} style={{marginTop:10,border:("1.5px dashed "+T.border),borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.muted} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{fontSize:13,color:T.muted,fontWeight:500}}>Add custom supplement</div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── QUICK-ADD PANEL ─────────────────────────────────────────────
// ── BARCODE SCANNER ──────────────────────────────────────────────
function BarcodeScanner({onResult,onClose}){
  const T=useTheme();
  const videoRef=useRef();
  const streamRef=useRef();
  const detectorRef=useRef();
  const rafRef=useRef();
  const [status,setStatus]=useState("starting"); // starting | scanning | error | manual
  const [manualCode,setManualCode]=useState("");
  const [looking,setLooking]=useState(false);

  const lookupBarcode=async(code)=>{
    setLooking(true);
    setStatus("looking");
    try{
      const r=await fetch("https://world.openfoodfacts.org/api/v0/product/"+code+".json");
      const d=await r.json();
      if(d.status===1&&d.product){
        const p=d.product;
        const n=p.nutriments;
        const food={
          name:p.product_name||(p.brands?p.brands+" product":"Unknown product"),
          brand:p.brands||"",
          servingG:parseFloat(p.serving_quantity)||100,
          isCustom:false,
          per100:{
            cal:Math.round(n["energy-kcal_100g"]||n["energy_100g"]/4.184||0),
            protein:Math.round((n.proteins_100g||0)*10)/10,
            carbs:Math.round((n.carbohydrates_100g||0)*10)/10,
            fat:Math.round((n.fat_100g||0)*10)/10,
            fiber:Math.round((n.fiber_100g||0)*10)/10,
            sugar:Math.round((n.sugars_100g||0)*10)/10,
            sodium:Math.round((n.sodium_100g||0)*1000),
          }
        };
        stopCamera();
        onResult(food);
      }else{
        setStatus("notfound");
        setLooking(false);
      }
    }catch{
      setStatus("error");
      setLooking(false);
    }
  };

  const stopCamera=()=>{
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t=>t.stop());
  };

  useEffect(()=>{
    let active=true;
    const start=async()=>{
      // Check BarcodeDetector support
      if(!("BarcodeDetector" in window)){setStatus("manual");return;}
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
        if(!active){stream.getTracks().forEach(t=>t.stop());return;}
        streamRef.current=stream;
        if(videoRef.current){
          videoRef.current.srcObject=stream;
          await videoRef.current.play();
        }
        detectorRef.current=new window.BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39"]});
        setStatus("scanning");
        const scan=async()=>{
          if(!active)return;
          try{
            const codes=await detectorRef.current.detect(videoRef.current);
            if(codes.length>0){
              stopCamera();
              await lookupBarcode(codes[0].rawValue);
              return;
            }
          }catch{}
          rafRef.current=requestAnimationFrame(scan);
        };
        scan();
      }catch{
        setStatus("manual");
      }
    };
    start();
    return()=>{active=false;stopCamera();};
  },[]);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:300,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:420,padding:"0 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
        {/* Header */}
        <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>Scan barcode</div>
          <div onClick={()=>{stopCamera();onClose();}} style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/><line x1="11" y1="1" x2="1" y2="11" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Camera viewport */}
        {(status==="scanning"||status==="starting")&&(
          <div style={{position:"relative",width:"100%",aspectRatio:"1",borderRadius:20,overflow:"hidden",background:"#000"}}>
            <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover"}} playsInline muted/>
            {/* Scan frame overlay */}
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:200,height:120,border:"2px solid rgba(6,182,212,0.8)",borderRadius:12,boxShadow:"0 0 0 9999px rgba(0,0,0,0.4)",position:"relative"}}>
                {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h])=>(
                  <div key={v+h} style={{position:"absolute",[v]:-2,[h]:-2,width:20,height:20,borderTop:v==="top"?"2px solid #06B6D4":"none",borderBottom:v==="bottom"?"2px solid #06B6D4":"none",borderLeft:h==="left"?"2px solid #06B6D4":"none",borderRight:h==="right"?"2px solid #06B6D4":"none",borderRadius:v==="top"&&h==="left"?"4px 0 0 0":v==="top"&&h==="right"?"0 4px 0 0":v==="bottom"&&h==="left"?"0 0 0 4px":"0 0 4px 0"}}/>
                ))}
                <div style={{position:"absolute",top:"50%",left:0,right:0,height:2,background:"rgba(6,182,212,0.6)",animation:"scanLine 2s ease-in-out infinite"}}/>
              </div>
            </div>
            <div style={{position:"absolute",bottom:16,left:0,right:0,textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.7)"}}>Point at a food barcode</div>
          </div>
        )}

        {status==="looking"&&(
          <div style={{textAlign:"center",padding:"40px 0",color:"#fff"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔍</div>
            <div style={{fontSize:15,fontWeight:600}}>Looking up product…</div>
          </div>
        )}

        {status==="notfound"&&(
          <div style={{textAlign:"center",padding:"20px 0",color:"#fff"}}>
            <div style={{fontSize:32,marginBottom:8}}>😕</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Product not found</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:16}}>This product isn't in the Open Food Facts database.</div>
            <button onClick={()=>setStatus("manual")} style={{background:T.accent,border:"none",borderRadius:10,padding:"10px 20px",color:"#fff",fontWeight:600,cursor:"pointer"}}>Enter barcode manually</button>
          </div>
        )}

        {/* Manual fallback */}
        {(status==="manual"||!("BarcodeDetector" in window))&&(
          <div style={{width:"100%",background:"rgba(255,255,255,0.08)",borderRadius:16,padding:20,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>
              {!("BarcodeDetector" in window)?"Camera scanning isn't supported in this browser.":"Enter the barcode number manually:"}
            </div>
            <input value={manualCode} onChange={e=>setManualCode(e.target.value.replace(/\D/g,""))}
              placeholder="e.g. 0737628064502"
              style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"#fff",outline:"none",textAlign:"center",letterSpacing:2}}/>
            <button onClick={()=>manualCode.length>=8&&lookupBarcode(manualCode)} disabled={manualCode.length<8||looking}
              style={{background:manualCode.length>=8?T.accent:"rgba(255,255,255,0.1)",border:"none",borderRadius:10,padding:"12px",color:"#fff",fontWeight:700,cursor:manualCode.length>=8?"pointer":"default",fontSize:14}}>
              {looking?"Looking up…":"Look up barcode"}
            </button>
          </div>
        )}

        <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",textAlign:"center"}}>Powered by Open Food Facts</div>
      </div>
      <style>{`@keyframes scanLine{0%,100%{top:10%}50%{top:85%}}`}</style>
    </div>
  );
}






// Numeric fields here are pre-filled, so typing without selecting first appends
// to the default — "100" + "100" = 100100. Select the value on focus instead.
const selectOnFocus=e=>e.target.select();

function QuickAddPanel({open,onClose,onAddItem,suppList,suppTaken,setSuppTaken,addSuppToList,customFoods,addCustomFood,waterOz=0,setWaterOz,initialMode="food",initialAction=null}){
  const T=useTheme();
  // initialMode is applied each time the panel opens (see the open effect), so
  // Home's quick-add fan can land on Water or Supplements directly.
  const [mode,setMode]=useState(initialMode);
  const [foodView,setFoodView]=useState("search");
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState(null);
  const [servingMode,setServingMode]=useState("g");
  const [grams,setGrams]=useState("100");
  const [servings,setServings]=useState("1");
  const [targetSlot,setTargetSlot]=useState("snacks");
  const [added,setAdded]=useState(false);
  const [scannerOpen,setScannerOpen]=useState(false);
  const searchRef=useRef();

  // Create food form state
  const [cf,setCf]=useState({name:"",brand:"",servingSize:"100",servingUnit:"g",servingGrams:"100",cal:"",protein:"",carbs:"",fat:"",fiber:"",sugar:"",sodium:""});
  const [cfSaved,setCfSaved]=useState(false);

  const cfChange=(k,v)=>setCf(p=>({...p,[k]:v}));
  const cfSetServing=v=>setCf(p=>({...p,servingSize:v,servingGrams:CF_UNIT_G[p.servingUnit]?cfGramsFor(v,p.servingUnit):p.servingGrams}));
  const cfSetUnit=u=>setCf(p=>({...p,servingUnit:u,servingGrams:cfGramsFor(p.servingSize,u)}));
  // The gram weight of one serving is the only thing per-100g macros may be
  // divided by — per100_* means "per 100 grams" everywhere else in the app.
  const cfGrams=parseFloat(cf.servingGrams);
  const cfGramsOver=Number.isFinite(cfGrams)&&cfGrams>CF_MAX_SERVING_G;
  const cfGramsOk=Number.isFinite(cfGrams)&&cfGrams>0&&!cfGramsOver;

  const cfPreview=cf.cal&&cfGramsOk?(()=>{
    const s=cfGrams;
    const per100={
      cal:Math.round((parseFloat(cf.cal)||0)/s*100),
      protein:Math.round((parseFloat(cf.protein)||0)/s*100*10)/10,
      carbs:Math.round((parseFloat(cf.carbs)||0)/s*100*10)/10,
      fat:Math.round((parseFloat(cf.fat)||0)/s*100*10)/10,
      fiber:Math.round((parseFloat(cf.fiber)||0)/s*100*10)/10,
      sugar:Math.round((parseFloat(cf.sugar)||0)/s*100*10)/10,
      sodium:Math.round((parseFloat(cf.sodium)||0)/s*100),
    };
    return{per100,servingCal:parseFloat(cf.cal)||0};
  })():null;

  const saveCustomFood=async()=>{
    if(!cf.name.trim()||!cf.cal||!cfGramsOk)return;
    const s=cfGrams;
    const food={
      name:cf.name.trim(),
      brand:cf.brand.trim()||null, // a placeholder is rendered, never stored
      servingG:s,
      servingQty:parseFloat(cf.servingSize)||null,
      servingUnit:cf.servingUnit,
      isCustom:true,
      per100:{
        cal:Math.round((parseFloat(cf.cal)||0)/s*100),
        protein:Math.round((parseFloat(cf.protein)||0)/s*100*10)/10,
        carbs:Math.round((parseFloat(cf.carbs)||0)/s*100*10)/10,
        fat:Math.round((parseFloat(cf.fat)||0)/s*100*10)/10,
        fiber:Math.round((parseFloat(cf.fiber)||0)/s*100*10)/10,
        sugar:Math.round((parseFloat(cf.sugar)||0)/s*100*10)/10,
        sodium:Math.round((parseFloat(cf.sodium)||0)/s*100),
      }
    };
    const ok=await addCustomFood(food);
    if(!ok)return; // addCustomFoodDB already rolled back and said why
    setCfSaved(true);
    setTimeout(()=>{
      setCfSaved(false);
      setCf({name:"",brand:"",servingSize:"100",servingUnit:"g",servingGrams:"100",cal:"",protein:"",carbs:"",fat:"",fiber:"",sugar:"",sodium:""});
      setFoodView("search");
    },1200);
  };

  // Reset when panel opens
  useEffect(()=>{
    if(open){setMode(initialMode);setScannerOpen(initialAction==="scan");setQuery("");setResults([]);setSelected(null);setError("");setAdded(false);setGrams("100");setServings("1");setFoodView("search");}
  },[open]);

  const doSearch=async()=>{
    if(!query.trim())return;
    setError("");setSelected(null);
    // Show local results immediately so user gets instant feedback
    const localImmediate=[
      ...(customFoods||[]).filter(f=>f.name.toLowerCase().includes(query.toLowerCase())||(f.brand||"").toLowerCase().includes(query.toLowerCase())).map(f=>({...f,isCustom:true})),
      ...searchLocalFood(query),
    ];
    setResults(localImmediate);
    setLoading(true);
    try{
      const r=await searchFood(query,customFoods);
      setResults(r.results);
      const st=searchStatus(r);
      if(st==="failed")setError("Search failed ("+r.failed.join(", ")+"). Tap Search to retry.");
      else if(st==="none")setError("No results. Try a brand name like 'Real Good' or a food name.");
      else if(st==="partial")setError(r.failed.join(", ")+" didn't respond — showing the rest.");
    }catch{
      setError("Search failed. Tap Search to retry.");
    }
    setLoading(false);
  };

  const getMacros=()=>{
    if(!selected)return null;
    let g=0;
    if(servingMode==="g"){g=parseFloat(grams)||0;}
    else{const sSize=selected.servingG||100;g=(parseFloat(servings)||0)*sSize;}
    if(g<=0)return null;
    return{g,macros:calc({...selected,grams:g})};
  };

  const preview=getMacros();

  const handleAdd=()=>{
    if(!selected||!preview)return;
    onAddItem(targetSlot,{
      id:Date.now(),name:selected.name,grams:preview.g,
      per100:selected.per100,
      color:COLORS[Math.floor(Math.random()*COLORS.length)],
    });
    setAdded(true);
    setTimeout(()=>{setAdded(false);setSelected(null);setQuery("");setResults([]);},900);
  };

  return(
    <>
      {scannerOpen&&<BarcodeScanner onResult={(food)=>{setScannerOpen(false);setSelected(food);setGrams(String(food.servingG||100));setResults([]);setQuery(food.name);}} onClose={()=>setScannerOpen(false)}/>}
      {open&&<div onClick={onClose} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:140,backdropFilter:"blur(4px)"}}/>}
      <div style={{
        position:"fixed",
        top:"50%",left:"50%",
        width:"calc(100% - 32px)",maxWidth:460,
        background:T.card,
        borderRadius:20,
        zIndex:145,
        transition:"opacity 0.25s, transform 0.25s cubic-bezier(.34,1.56,.64,1)",
        transform:open?"translate(-50%,-50%) scale(1)":"translate(-50%,-50%) scale(0.94)",
        opacity:open?1:0,
        pointerEvents:open?"auto":"none",
        maxHeight:"88vh",
        display:"flex",flexDirection:"column",
        overflow:"hidden",
        boxSizing:"border-box",
        boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",
      }}>
        {/* Header */}
        <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:600}}>Quick add</div>
          <div onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{display:"flex",gap:8,padding:"12px 20px 0",flexShrink:0}}>
          {[["food","🍽 Food"],["supps","💊 Supplements"],["water","💧 Water"]].map(([m,l])=>(
            <div key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+mode===m?T.accent:T.border),boxShadow:mode===m?T.glowShadow:"none",background:mode===m?T.accent:T.card,color:mode===m?"#fff":T.muted}}>{l}</div>
          ))}
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"14px 20px 0"}}>

          {/* ── FOOD MODE ── */}
          {mode==="food"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* Search / Create sub-toggle */}
              <div style={{display:"flex",gap:0,background:T.accentPill,borderRadius:12,padding:3}}>
                {[["search","🔍 Search foods"],["create","✏️ Create food"]].map(([v,l])=>(
                  <div key={v} onClick={()=>{setFoodView(v);setSelected(null);setResults([]);setCfSaved(false);}} style={{flex:1,padding:"8px 10px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",background:foodView===v?T.accent:"transparent",color:foodView===v?"#fff":T.muted,transition:"all 0.15s",boxShadow:foodView===v?("0 2px 8px "+T.accentGlow):"none"}}>{l}</div>
                ))}
              </div>

              {/* ── SEARCH VIEW ── */}
              {foodView==="search"&&(<>
              <div style={{display:"flex",gap:8,width:"100%"}}>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e=>setQuery(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&doSearch()}
                  placeholder="Search food (e.g. Fairlife milk...)"
                  style={{flex:1,minWidth:0,background:T.bg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}
                />
                <div onClick={()=>setScannerOpen(true)} title="Scan barcode"
                  style={{width:44,height:44,flexShrink:0,background:T.accentPill,border:("1px solid "+T.accent),borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round">
                    <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="14" y="1" width="5" height="5" rx="1"/><rect x="1" y="14" width="5" height="5" rx="1"/>
                    <line x1="8" y1="1.5" x2="8" y2="6.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/><line x1="8" y1="9" x2="8" y2="18.5"/><line x1="11" y1="10" x2="11" y2="14"/><line x1="14" y1="9" x2="18.5" y2="9"/><line x1="14" y1="13" x2="18.5" y2="13"/><line x1="14" y1="16" x2="16" y2="16"/><line x1="16" y1="11" x2="18.5" y2="11"/>
                  </svg>
                </div>
                <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"11px 16px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,whiteSpace:"nowrap",flexShrink:0,minWidth:72}}>
                  {loading?"…":"Search"}
                </button>
              </div>
              {customFoods.length>0&&!query&&(
                <div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:8}}>⭐ My saved foods</div>
                  {customFoods.slice(0,3).map((f,i)=>(
                    <div key={i} onClick={()=>{setSelected(f);setGrams(String(f.servingG||100));setServings("1");}} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"10px 14px",marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:9,height:9,borderRadius:"50%",background:T.accent,flexShrink:0}}/>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{f.name}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{f.brand}</div></div>
                      <div style={{fontSize:12,fontWeight:600,color:T.text}}>{f.per100.cal} kcal/100g</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{fontSize:11,color:T.muted,marginTop:-8}}>Includes your saved foods, Fairlife, common brands &amp; more.</div>
              {error&&<div style={{fontSize:13,color:"#E24B4A",padding:"9px 12px",background:"rgba(248,113,113,0.1)",borderRadius:10}}>{error}</div>}

              {/* Loading indicator — shown while APIs are fetching more results */}
              {loading&&results.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",opacity:0.6}}>
                  <div style={{width:14,height:14,border:("2px solid "+T.accent),borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                  <div style={{fontSize:12,color:T.muted}}>Searching databases for more results…</div>
                </div>
              )}
              {loading&&results.length===0&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"24px 0"}}>
                  <div style={{width:18,height:18,border:("2px solid "+T.accent),borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                  <div style={{fontSize:13,color:T.muted}}>Searching…</div>
                </div>
              )}

              {/* No results → offer to create */}
              {!selected&&query&&results.length===0&&!loading&&(
                <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:10,alignItems:"center",textAlign:"center"}}>
                  <div style={{fontSize:13,color:T.muted}}>No results found for <span style={{fontWeight:600,color:T.text}}>"{query}"</span></div>
                  <div
                    onClick={()=>{setFoodView("create");setCfSaved(false);}}
                    style={{display:"inline-flex",alignItems:"center",gap:7,background:T.accentPill,border:("1px solid "+T.border),borderRadius:20,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Create "{query}"
                  </div>
                </div>
              )}

              {!selected&&results.map((r,i)=>(
                <div key={i} onClick={()=>{setSelected(r);setGrams(String(r.servingG||100));setServings("1");}} style={{background:r.isCustom?"#F0FBF6":"#fff",border:("1px solid "+r.isCustom?T.accent:T.border),borderRadius:12,padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:r.isCustom?T.accent:COLORS[i%COLORS.length],flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,lineHeight:1.3}}>{r.name}{r.isCustom&&<span style={{fontSize:10,color:T.accent,marginLeft:6,fontWeight:600}}>MY FOOD</span>}</div>
                    {(r.brand||r.isCustom)&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{r.brand||"My foods"}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:600}}>{r.per100.cal}</div><div style={{fontSize:10,color:T.muted}}>kcal/100g</div></div>
                </div>
              ))}
              {selected&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div onClick={()=>{setSelected(null);setResults([]);}} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                      <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="8,2 3,6 8,10" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                    </div>
                    <div><div style={{fontSize:14,fontWeight:600,lineHeight:1.2}}>{selected.name}</div>{selected.brand&&<div style={{fontSize:11,color:T.muted}}>{selected.brand}</div>}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["Cal",selected.per100.cal,"kcal","#2ECC8F"],["Prot",selected.per100.protein,"g","#FF6B4A"],["Carbs",selected.per100.carbs,"g","#F5A623"],["Fat",selected.per100.fat,"g","#5B8DEF"]].map(([l,v,u,c])=>(
                      <div key={l} style={{flex:1,background:T.bg,borderRadius:10,padding:"7px 4px",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:600,color:c}}>{v}{u}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:1}}>{l}/100g</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["g","By grams"],["serving","By serving"]].map(([m,l])=>(
                      <div key={m} onClick={()=>setServingMode(m)} style={{flex:1,padding:"7px 10px",borderRadius:10,fontSize:12,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+T.border),boxShadow:T.glowShadow,background:servingMode===m?T.accent:T.card,color:servingMode===m?"#fff":T.muted}}>{l}</div>
                    ))}
                  </div>
                  {servingMode==="g"&&(
                    <div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:T.muted}}>Amount in grams</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input type="number" value={grams} onChange={e=>setGrams(e.target.value)} onFocus={selectOnFocus} min="1" style={{width:72,flexShrink:0,background:T.bg,border:("2px solid "+T.accent),borderRadius:10,padding:"9px 8px",fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:13,color:T.muted,flexShrink:0}}>g</span>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                          {[50,100,150,200,300].map(g=>(
                            <div key={g} onClick={()=>setGrams(String(g))} style={{padding:"6px 8px",background:grams===String(g)?T.accent:T.card,color:grams===String(g)?"#fff":T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{g}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {servingMode==="serving"&&(
                    <div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:T.muted}}>Servings {selected.servingG?("(1 serving ≈ "+selected.servingG+"g)"):"(1 serving = 100g)"}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input type="number" value={servings} onChange={e=>setServings(e.target.value)} onFocus={selectOnFocus} min="0.25" step="0.25" style={{width:72,flexShrink:0,background:T.bg,border:("2px solid "+T.accent),borderRadius:10,padding:"9px 8px",fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:13,color:T.muted,flexShrink:0}}>serving{parseFloat(servings)!==1?"s":""}</span>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                          {[0.5,1,1.5,2,3].map(s=>(
                            <div key={s} onClick={()=>setServings(String(s))} style={{padding:"6px 8px",background:servings===String(s)?T.accent:T.card,color:servings===String(s)?"#fff":T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{s}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {preview&&(
                    <div style={{background:T.card,borderRadius:14,padding:14,color:T.text}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:6}}>
                        {servingMode==="g"?(preview.g+"g of "+selected.name):(servings+" serving"+(parseFloat(servings)!==1?"s":"")+" · "+Math.round(preview.g)+"g")}
                      </div>
                      <div style={{fontSize:28,fontWeight:600,letterSpacing:"-1px",marginBottom:10}}>{preview.macros.cal} <span style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>kcal</span></div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                        {[["Protein",preview.macros.protein,"g","#FF6B4A"],["Carbs",preview.macros.carbs,"g","#F5A623"],["Fat",preview.macros.fat,"g","#5B8DEF"],["Fiber",preview.macros.fiber,"g","#9B6DFF"]].map(([l,v,u,c])=>(
                          <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:9,padding:"8px 4px",textAlign:"center"}}>
                            <div style={{fontSize:14,fontWeight:600,color:c}}>{v}{u}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:1}}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              </>)}

              {/* ── CREATE FOOD VIEW ── */}
              {foodView==="create"&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>

                  {/* No results notice */}
                  <div style={{background:T.accentPill,border:("1px solid "+T.border),borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="8.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.8" fill={T.accent}/></svg>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:T.accent}}>No results found</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>Create a custom food and it'll be saved for future searches.</div>
                    </div>
                  </div>

                  <div style={{fontSize:13,color:T.muted}}>Fill in the nutrition label info below.</div>

                  {/* Name & Brand */}
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <input value={cf.name} onChange={e=>cfChange("name",e.target.value)} placeholder="Food name (required)" style={{background:T.bg,border:("1px solid "+cf.name?T.accent:T.border),borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none",fontWeight:cf.name?500:400}}/>
                    <input value={cf.brand} onChange={e=>cfChange("brand",e.target.value)} placeholder="Brand (optional)" style={{background:T.bg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}/>
                  </div>

                  {/* Serving size */}
                  <div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Serving size</div>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
                      <input type="number" value={cf.servingSize} onChange={e=>cfSetServing(e.target.value)} onFocus={selectOnFocus} min="1" style={{width:80,flexShrink:0,background:T.bg,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:10,padding:"10px 10px",fontSize:15,fontWeight:600,outline:"none",textAlign:"center"}}/>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1}}>
                        {["g","ml","oz","cup","tbsp","piece"].map(u=>(
                          <div key={u} onClick={()=>cfSetUnit(u)} style={{padding:"7px 8px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),boxShadow:T.glowShadow,background:cf.servingUnit===u?T.accent:T.card,color:cf.servingUnit===u?"#fff":T.muted,flexShrink:0}}>{u}</div>
                        ))}
                      </div>
                    </div>
                    {/* Grams is the source of truth for the per-100g macros below.
                        Exact for g/oz, so we just show it; asked for otherwise. */}
                    {CF_AUTO_UNITS.includes(cf.servingUnit)?(
                      <div style={{fontSize:12,color:T.muted,marginTop:8}}>1 serving = {cfGramsOk?cfGrams:"—"} g</div>
                    ):(
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:11,color:T.muted,fontWeight:500,marginBottom:4}}>Weight of 1 serving (g)<span style={{color:"#E24B4A"}}> *</span></div>
                        <input type="number" min="1" value={cf.servingGrams} onChange={e=>cfChange("servingGrams",e.target.value)} onFocus={selectOnFocus} placeholder="grams"
                          style={{width:110,background:T.bg,border:("1px solid "+(cf.servingGrams?T.accent:T.border)),boxShadow:T.glowShadow,borderRadius:10,padding:"10px 10px",fontSize:15,fontWeight:cf.servingGrams?600:400,outline:"none",textAlign:"center",color:T.text}}/>
                        <div style={{fontSize:11,color:T.muted,marginTop:5,lineHeight:1.4}}>
                          {cf.servingUnit==="ml"
                            ?"Pre-filled at 1 ml ≈ 1 g (water). Adjust for oil, honey and other liquids."
                            :"One "+cf.servingUnit+" weighs a different amount for every food — take it from the label."}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Macros grid */}
                  <div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Per serving nutrition</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
                      {[
                        ["cal","Calories (kcal)","#2ECC8F",true],
                        ["protein","Protein (g)","#FF6B4A",false],
                        ["carbs","Total Carbs (g)","#F5A623",false],
                        ["fat","Total Fat (g)","#5B8DEF",false],
                        ["fiber","Dietary Fiber (g)","#9B6DFF",false],
                        ["sugar","Total Sugar (g)","#F5A623",false],
                        ["sodium","Sodium (mg)","#5B8DEF",false],
                      ].map(([k,label,color,required])=>(
                        <div key={k} style={{display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
                          <div style={{fontSize:11,color:T.muted,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}{required&&<span style={{color:"#E24B4A"}}> *</span>}</div>
                          <input
                            type="number" min="0" value={cf[k]}
                            onChange={e=>cfChange(k,e.target.value)}
                            placeholder="0"
                            style={{background:T.bg,border:("1px solid "+cf[k]?color:T.border),borderRadius:10,padding:"10px 8px",fontSize:15,fontWeight:cf[k]?600:400,outline:"none",textAlign:"center",color:cf[k]?color:T.muted,width:"100%",minWidth:0}}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live preview */}
                  {cfPreview&&cf.name&&(
                    <div style={{background:T.card,borderRadius:14,padding:14,color:T.text}}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:6}}>Preview: 1 serving ({cf.servingSize}{cf.servingUnit}) of {cf.name}</div>
                      <div style={{fontSize:28,fontWeight:600,letterSpacing:"-1px",marginBottom:10}}>{cfPreview.servingCal} <span style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>kcal</span></div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                        {[["Protein",cf.protein||0,"g","#FF6B4A"],["Carbs",cf.carbs||0,"g","#F5A623"],["Fat",cf.fat||0,"g","#5B8DEF"],["Fiber",cf.fiber||0,"g","#9B6DFF"],["Sugar",cf.sugar||0,"g","#F5A623"],["Sodium",cf.sodium||0,"mg","#2ECC8F"]].map(([l,v,u,c])=>(
                          <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:9,padding:"8px 4px",textAlign:"center"}}>
                            <div style={{fontSize:13,fontWeight:600,color:c}}>{v}{u}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:1}}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {mode==="supps"&&(
            <SuppSearchPanel suppList={suppList} suppTaken={suppTaken} setSuppTaken={setSuppTaken} addSuppToList={addSuppToList}/>
          )}

          {mode==="water"&&(
            <div style={{padding:"16px 20px 0"}}>
              {/* Current status */}
              <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:16,padding:16,marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
                <GallonBottle oz={waterOz} size={60}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.5px"}}>{waterOz} <span style={{fontSize:13,color:T.muted,fontWeight:500}}>oz today</span></div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{GOAL_OZ-waterOz>0?(GOAL_OZ-waterOz)+" oz to reach goal":"🎉 Goal reached!"}</div>
                  <div style={{marginTop:8,height:5,background:T.card,borderRadius:3}}>
                    <div style={{width:(Math.min(waterOz/GOAL_OZ,1)*100+"%"),height:"100%",background:("linear-gradient(90deg,#38BDF8,"+T.accent+")"),borderRadius:3,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    <div style={{fontSize:9,color:T.muted}}>0 oz</div>
                    <div style={{fontSize:9,color:T.accent,fontWeight:700}}>{Math.round(waterOz/GOAL_OZ*100)}%</div>
                    <div style={{fontSize:9,color:T.muted}}>{GOAL_OZ} oz</div>
                  </div>
                </div>
              </div>

              {/* Common vessels */}
              <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:10}}>Tap to add</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                {[["🥤","Small glass","8 oz",8],["🍶","Standard bottle","16 oz",16],["🧴","Large bottle","32 oz",32],["🫗","Big glass","12 oz",12]].map(([icon,label,sub,n])=>(
                  <div key={label} onClick={()=>setWaterOz&&setWaterOz(w=>Math.min(GOAL_OZ,w+n))}
                    style={{background:T.surface,border:("1px solid "+T.border),borderRadius:12,padding:"12px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",transition:"border-color 0.15s",boxShadow:T.glowShadow}}>
                    <div style={{fontSize:22,flexShrink:0}}>{icon}</div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:T.text}}>{label}</div>
                      <div style={{fontSize:10,color:T.muted,marginTop:1}}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom amount */}
              <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:8}}>Custom amount</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {[4,8,12,16,20,24,32,40].map(n=>(
                  <div key={n} onClick={()=>setWaterOz&&setWaterOz(w=>Math.min(GOAL_OZ,w+n))}
                    style={{padding:"8px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:T.accentPill,border:("1px solid "+T.accent+"44"),color:T.accent}}>
                    +{n} oz
                  </div>
                ))}
              </div>
              {waterOz>0&&(
                <div onClick={()=>setWaterOz&&setWaterOz(0)}
                  style={{fontSize:12,color:T.muted,cursor:"pointer",textAlign:"center",marginTop:8,padding:"8px",borderRadius:10,border:("1px solid "+T.border)}}>
                  Reset today's intake
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── STICKY FOOTER — always visible ── */}
        {mode==="food"&&foodView==="search"&&selected&&preview&&(
          <div style={{flexShrink:0,borderTop:("1px solid "+T.border),padding:"12px 20px 20px",background:T.card}}>
            <div style={{fontSize:12,fontWeight:500,marginBottom:8,color:T.muted}}>Add to meal</div>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              {[["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snacks","Snacks"]].map(([s,l])=>(
                <div key={s} onClick={()=>setTargetSlot(s)} style={{flex:1,padding:"7px 4px",borderRadius:10,fontSize:11,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+targetSlot===s?T.accent:T.border),background:targetSlot===s?T.accent:T.card,color:targetSlot===s?"#fff":T.text,transition:"all 0.15s"}}>{l}</div>
              ))}
            </div>
            <button onClick={handleAdd} style={{width:"100%",background:added?"#22C55E":"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",transition:"background 0.2s",boxShadow:added?"none":("0 4px 16px "+T.accentGlow)}}>
              {added?"✓ Added!":"Add to "+targetSlot.charAt(0).toUpperCase()+targetSlot.slice(1)}
            </button>
          </div>
        )}
        {mode==="food"&&foodView==="create"&&(
          <div style={{flexShrink:0,borderTop:("1px solid "+T.border),padding:"12px 20px 20px",background:T.card}}>
            {cfGramsOver&&<div style={{fontSize:13,color:"#E24B4A",marginBottom:10,padding:"9px 12px",background:"rgba(248,113,113,0.1)",borderRadius:10}}>One serving can't weigh more than {CF_MAX_SERVING_G} g — check the amount and unit.</div>}
            <button onClick={saveCustomFood} disabled={!cf.name.trim()||!cf.cal||!cfGramsOk}
              style={{width:"100%",background:cfSaved?"#22C55E":(!cf.name.trim()||!cf.cal||!cfGramsOk?T.border:T.accent),border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:(!cf.name.trim()||!cf.cal||!cfGramsOk)?"not-allowed":"pointer",transition:"background 0.2s"}}>
              {cfSaved?"✓ Saved to My Foods":"Save food to my library"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── ADD FOOD MODAL ───────────────────────────────────────────────
function AddFoodModal({slot,onAdd,onClose,customFoods=[]}){
  const T=useTheme();
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(null);
  const [grams,setGrams]=useState("100");
  const [error,setError]=useState("");
  const inputRef=useRef();
  useEffect(()=>{inputRef.current?.focus();},[]);

  const doSearch=async()=>{
    if(!query.trim())return;
    setError("");setSelected(null);
    // Show local results immediately
    const localImmediate=[
      ...(customFoods||[]).filter(f=>f.name.toLowerCase().includes(query.toLowerCase())||(f.brand||"").toLowerCase().includes(query.toLowerCase())).map(f=>({...f,isCustom:true})),
      ...searchLocalFood(query),
    ];
    setResults(localImmediate);
    setLoading(true);
    try{
      const r=await searchFood(query,customFoods);
      setResults(r.results);
      const st=searchStatus(r);
      if(st==="failed")setError("Search failed ("+r.failed.join(", ")+"). Tap Search to retry.");
      else if(st==="none")setError("No results found. Try a brand name like 'Real Good' or a food name.");
      else if(st==="partial")setError(r.failed.join(", ")+" didn't respond — showing the rest.");
    }catch{
      setError("Search failed. Tap Search to retry.");
    }
    setLoading(false);
  };
  const preview=selected?calc({...selected,grams:parseFloat(grams)||0}):null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
      <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"88vh",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:600}}>Add food — {slot}</div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"14px 16px 0"}}>
          <div style={{display:"flex",gap:8,marginBottom:12,width:"100%"}}>
            <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Search food (e.g. white rice, fairlife...)" style={{flex:1,minWidth:0,background:T.bg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}/>
            <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"11px 16px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,flexShrink:0,minWidth:72}}>{loading?"…":"Search"}</button>
          </div>
          {error&&<div style={{fontSize:13,color:"#E24B4A",marginBottom:12,padding:"10px 14px",background:"rgba(248,113,113,0.1)",borderRadius:10}}>{error}</div>}

          {/* No results → offer to create */}
          {!selected&&query&&results.length===0&&!loading&&(
            <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:10,alignItems:"center",textAlign:"center",marginBottom:12}}>
              <div style={{fontSize:30}}>🔍</div>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>No results for "{query}"</div>
              <div style={{fontSize:13,color:T.muted}}>Can't find it in the database? Create it yourself.</div>
              <div
                onClick={()=>{onClose();}}
                style={{display:"inline-flex",alignItems:"center",gap:7,background:T.accentPill,border:("1px solid "+T.border),borderRadius:20,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}
              >
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                Create "{query}" in Quick Add
              </div>
              <div style={{fontSize:11,color:T.muted}}>(Open Quick Add → Food → Create food)</div>
            </div>
          )}

          {!selected&&results.map((r,i)=>(
            <div key={i} onClick={()=>{setSelected(r);setGrams("100");}} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,lineHeight:1.3}}>{r.name}</div>{r.brand&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{r.brand}</div>}</div>
              <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:600}}>{r.per100.cal} kcal</div><div style={{fontSize:11,color:T.muted}}>per 100g</div></div>
            </div>
          ))}
          {selected&&(
            <div>
              <div onClick={()=>setSelected(null)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:14,color:T.accent,fontSize:13,fontWeight:500}}>
                <svg width="14" height="14" viewBox="0 0 14 14"><polyline points="9,2 4,7 9,12" stroke={T.accent} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                Back to results
              </div>
              <div style={{background:T.bg,borderRadius:14,padding:14,marginBottom:16}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:2}}>{selected.name}</div>
                {selected.brand&&<div style={{fontSize:12,color:T.muted,marginBottom:10}}>{selected.brand}</div>}
                <div style={{fontSize:12,color:T.muted,marginBottom:8}}>Per 100g:</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["Cal",selected.per100.cal,"kcal","#2ECC8F"],["Protein",selected.per100.protein,"g","#FF6B4A"],["Carbs",selected.per100.carbs,"g","#F5A623"],["Fat",selected.per100.fat,"g","#5B8DEF"],["Fiber",selected.per100.fiber,"g","#9B6DFF"]].map(([l,v,u,c])=>(
                    <div key={l} style={{background:T.card,borderRadius:10,padding:"8px 10px",textAlign:"center",minWidth:56,border:("1px solid "+T.border),boxShadow:T.glowShadow,flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:c}}>{v}{u}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>How many grams?</div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <input type="number" value={grams} onChange={e=>setGrams(e.target.value)} onFocus={selectOnFocus} min="1" max={MAX_FOOD_GRAMS} style={{width:80,flexShrink:0,background:T.bg,border:("2px solid "+T.accent),borderRadius:10,padding:"10px 10px",fontSize:17,fontWeight:700,outline:"none",textAlign:"center"}}/>
                  <span style={{fontSize:14,color:T.muted,flexShrink:0}}>grams</span>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                    {[50,100,150,200,300].map(g=>(
                      <div key={g} onClick={()=>setGrams(String(g))} style={{padding:"7px 8px",background:grams===String(g)?T.accent:T.card,color:grams===String(g)?"#fff":T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{g}g</div>
                    ))}
                  </div>
                </div>
              </div>
              {preview&&parseFloat(grams)>0&&(
                <div style={{background:T.card,borderRadius:14,padding:16,marginBottom:8,color:T.text}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:8}}>Nutrition for {grams}g of {selected.name}</div>
                  <div style={{fontSize:30,fontWeight:600,letterSpacing:"-1px",marginBottom:14}}>{preview.cal} <span style={{fontSize:14,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>kcal</span></div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {[["Protein",preview.protein,"g","#FF6B4A"],["Carbs",preview.carbs,"g","#F5A623"],["Fat",preview.fat,"g","#5B8DEF"],["Fiber",preview.fiber,"g","#9B6DFF"],["Sodium",preview.sodium,"mg","#2ECC8F"]].map(([l,v,u,c])=>(
                      <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"9px 8px",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:600,color:c}}>{v}{u}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer — always visible */}
        {selected&&(
          <div style={{flexShrink:0,borderTop:("1px solid "+T.border),padding:"12px 16px 20px",background:T.card}}>
            <button onClick={()=>{const g=parseFloat(grams);if(!g||g<=0)return;onAdd({id:Date.now(),name:selected.name,grams:g,per100:selected.per100,color:COLORS[Math.floor(Math.random()*COLORS.length)]});}}
              style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 16px "+T.accentGlow)}}>
              Add {grams}g to {slot}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MacroRow({label,value,goal,color,unit="g"}){
  const T=useTheme();
  const pct=Math.min(100,Math.round((value/goal)*100));
  const over=value>goal;
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F0EFE9"}}>
      <div style={{fontSize:14,minWidth:60}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,flex:1,marginLeft:10}}>
        <div style={{flex:1,height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:(pct+"%"),background:over?"#E24B4A":color,borderRadius:3,transition:"width 0.4s"}}/>
        </div>
        <div style={{fontSize:12,fontWeight:500,minWidth:88,textAlign:"right",color:over?"#E24B4A":T.text}}>{value}{unit} / {goal}{unit}</div>
      </div>
    </div>
  );
}

function FoodItemRow({item,m,onDelete}){
  const T=useTheme();
  const [delMode,setDelMode]=useState(false);
  const [leaving,setLeaving]=useState(false);

  const confirmDelete=()=>{
    setLeaving(true);
    setTimeout(onDelete,260);
  };

  const lp=useLongPress(()=>{setDelMode(true);},480);

  if(delMode){
    return(
      <div style={{
        borderRadius:12,marginBottom:6,overflow:"hidden",
        display:"flex",alignItems:"stretch",
        transform:leaving?"translateX(-100%)":"translateX(0)",
        transition:"transform 0.26s cubic-bezier(.4,0,.2,1)",
      }}>
        {/* Item — dimmed */}
        <div style={{flex:1,background:T.card,border:"1px solid rgba(239,68,68,0.35)",borderRight:"none",borderRadius:"12px 0 0 12px",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,opacity:0.45}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:item.color,flexShrink:0}}/>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:T.text}}>{item.name}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{item.grams}g · {m.cal} kcal</div></div>
        </div>
        {/* Cancel */}
        <div onClick={()=>setDelMode(false)} style={{background:T.surface,border:"1px solid rgba(239,68,68,0.35)",borderRight:"none",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 14px",cursor:"pointer",flexShrink:0}}>
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/><line x1="11" y1="1" x2="1" y2="11" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
        {/* Confirm delete */}
        <div onClick={confirmDelete} style={{background:"rgba(239,68,68,0.9)",borderRadius:"0 12px 12px 0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 16px",cursor:"pointer",gap:3,flexShrink:0}}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"><polyline points="3,4 12,4"/><path d="M5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1"/><rect x="4" y="4" width="7" height="8" rx="1"/><line x1="6" y1="7" x2="6" y2="10"/><line x1="9" y1="7" x2="9" y2="10"/></svg>
          <span style={{fontSize:10,fontWeight:700,color:"#fff"}}>Delete</span>
        </div>
      </div>
    );
  }

  return(
    <div {...lp} style={{
      background:T.card,borderRadius:12,padding:"11px 14px",
      border:("1px solid "+T.border),boxShadow:T.glowShadow,
      display:"flex",alignItems:"center",gap:10,marginBottom:6,
      userSelect:"none",WebkitUserSelect:"none",cursor:"default",
      transition:"box-shadow 0.15s",
    }}>
      <div style={{width:8,height:8,borderRadius:"50%",background:item.color,flexShrink:0}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:500}}>{item.name}</div>
        <div style={{fontSize:12,color:T.muted,marginTop:1}}>{item.grams}g · {m.protein}g P · {m.carbs}g C · {m.fat}g F · {m.cal} kcal</div>
      </div>
      <div style={{fontSize:13,fontWeight:600,flexShrink:0}}>{m.cal}</div>
      <div style={{fontSize:9,color:T.muted,flexShrink:0,opacity:0.5,marginLeft:2}}>hold</div>
    </div>
  );
}

function WaterStrip({waterOz=0,setWaterOz}){
  const T=useTheme();
  const [open,setOpen]=useState(false);
  return(
    <div style={{margin:"0 16px 12px",background:T.accentPill,border:("1px solid "+T.accent+"33"),borderRadius:14,overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer"}}>
        <GallonBottle oz={waterOz} size={30}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>💧 Water intake</div>
          <div style={{height:4,background:T.surface,borderRadius:2,marginTop:4,overflow:"hidden"}}>
            <div style={{width:(Math.min(waterOz/GOAL_OZ,1)*100+"%"),height:"100%",background:("linear-gradient(90deg,#38BDF8,"+T.accent+")"),borderRadius:2,transition:"width 0.5s"}}/>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{waterOz}<span style={{fontSize:10,color:T.muted,fontWeight:500}}> oz</span></div>
          <div style={{fontSize:9,color:T.muted}}>of {GOAL_OZ}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}>
          <polyline points="1,3 6,9 11,3" stroke={T.muted} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>
      {open&&(
        <div style={{borderTop:("1px solid "+T.accent+"22"),padding:"10px 14px 12px"}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[8,12,16,24,32].map(n=>(
              <div key={n} onClick={()=>setWaterOz&&setWaterOz(w=>Math.min(GOAL_OZ,w+n))}
                style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",background:T.accent,color:"#fff",boxShadow:("0 2px 8px "+T.accentGlow)}}>
                +{n} oz
              </div>
            ))}
            {waterOz>0&&(
              <div onClick={()=>setWaterOz&&setWaterOz(0)}
                style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:T.surface,border:("1px solid "+T.border),color:T.muted}}>
                reset
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FoodTab({log,setLog,onAddItem,uid,customFoods=[],addCustomFood,onDeleteFailed,goals={cal:2200,protein:140,carbs:180,fat:78,fiber:25,sodium:2300},waterOz=0,setWaterOz}){
  const T=useTheme();
  const [modal,setModal]=useState(null);
  const M=totals(log);
  const calGoal=goals?.cal||2200;
  const remain=Math.max(0,calGoal-M.cal);
  const r=34,circ=2*Math.PI*r,dash=circ*Math.min(1,M.cal/calGoal);
  return(
    <div style={{paddingBottom:80}}>
      {modal&&<AddFoodModal slot={modal} onAdd={item=>{onAddItem(modal,item);setModal(null);}} onClose={()=>setModal(null)} customFoods={customFoods}/>}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:600}}>Food log</div><div style={{fontSize:13,color:T.muted}}>Calorie tracker</div></div>
        <div onClick={()=>setModal("breakfast")} style={{fontSize:13,color:T.accent,fontWeight:500,cursor:"pointer"}}>+ Add food</div>
      </div>
      <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),margin:16,borderRadius:16,padding:18,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:18}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Calories remaining</div>
            <div style={{fontSize:36,fontWeight:600,letterSpacing:"-2px",lineHeight:1}}>{remain.toLocaleString()}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:3}}>of {calGoal.toLocaleString()} · {M.cal} consumed</div>
          </div>
          <svg width="86" height="86" viewBox="0 0 86 86">
            <circle cx="43" cy="43" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7"/>
            <circle cx="43" cy="43" r={r} fill="none" stroke={T.accent} strokeWidth="7" strokeDasharray={dash+" "+circ+""} strokeLinecap="round" transform="rotate(-90 43 43)"/>
            <text x="43" y="40" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">{M.cal}</text>
            <text x="43" y="53" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">consumed</text>
          </svg>
        </div>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          {[["Protein",M.protein+"g","#FF6B4A"],["Carbs",M.carbs+"g","#F5A623"],["Fat",M.fat+"g","#5B8DEF"],["Fiber",M.fiber+"g","#2ECC8F"]].map(([l,v,c])=>(
            <div key={l} style={{flex:1,background:"rgba(255,255,255,0.07)",borderRadius:10,padding:9,textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:600,color:c}}>{v}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* ── WATER STRIP ── */}
      <WaterStrip waterOz={waterOz} setWaterOz={setWaterOz}/>
      {[["Breakfast","breakfast"],["Lunch","lunch"],["Dinner","dinner"],["Snacks","snacks"]].map(([label,slot])=>{
        const slotCal=log[slot].reduce((s,item)=>s+calc(item).cal,0);
        return(
          <div key={slot} style={{margin:"0 16px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div><div style={{fontSize:14,fontWeight:600}}>{label}</div><div style={{fontSize:12,color:T.muted}}>{slotCal} cal</div></div>
              <div onClick={()=>setModal(slot)} style={{fontSize:13,color:T.accent,fontWeight:500,cursor:"pointer"}}>+ Add</div>
            </div>
            {log[slot].map((item,i)=>{
              const m=calc(item);
              return(
                <FoodItemRow key={item.id||i} item={item} m={m} onDelete={async()=>{
                  // sb.delete never throws; it returns false. The old try/catch{}
                  // here was unreachable and the 400 from a local id sailed past it.
                  const filter=foodDeleteFilter(item,uid);
                  if(uid&&!filter){onDeleteFailed&&onDeleteFailed("That item hasn't finished saving yet — try again in a moment.");return;}
                  setLog(p=>({...p,[slot]:p[slot].filter(x=>x!==item)}));
                  if(!filter)return;
                  const ok=await sb.delete("food_log",filter);
                  if(!ok){
                    setLog(p=>({...p,[slot]:[...p[slot],item]}));
                    onDeleteFailed&&onDeleteFailed("Couldn't delete "+item.name+". Check your connection.");
                  }
                }}/>
              );
            })}
            {log[slot].length===0&&(
              <div onClick={()=>setModal(slot)} style={{background:T.card,border:"1.5px dashed #D0CFC9",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke="#D0CFC9" strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke="#D0CFC9" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke="#D0CFC9" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <div style={{fontSize:14,color:T.muted,fontWeight:500}}>Search & add {label.toLowerCase()}</div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{padding:"0 16px",marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>Nutrition breakdown</div>
        <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:"4px 14px"}}>
          <MacroRow label="Calories" value={M.cal} goal={goals?.cal||2200} color={T.accent} unit=" kcal"/>
          <MacroRow label="Protein" value={M.protein} goal={goals?.protein||140} color="#FF6B4A"/>
          <MacroRow label="Carbs" value={M.carbs} goal={goals?.carbs||180} color="#F5A623"/>
          <MacroRow label="Fat" value={M.fat} goal={goals?.fat||78} color="#5B8DEF"/>
          <MacroRow label="Fiber" value={M.fiber} goal={goals?.fiber||25} color="#9B6DFF"/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
            <div style={{fontSize:14,minWidth:60}}>Sodium</div>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1,marginLeft:10}}>
              <div style={{flex:1,height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(Math.min(100,Math.round((M.sodium/(goals?.sodium||2300))*100))+"%"),background:M.sodium>(goals?.sodium||2300)?"#E24B4A":"#5B8DEF",borderRadius:3,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:12,fontWeight:500,minWidth:88,textAlign:"right",color:M.sodium>(goals?.sodium||2300)?"#E24B4A":T.text}}>{M.sodium}mg / {goals?.sodium||2300}mg</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GallonBottle({oz,size=52}){
  const T=useTheme();
  const pct=Math.min(oz/GOAL_OZ,1);
  const fillColor=pct>=0.75?T.accent:pct>=0.4?"#38BDF8":"#7DD3FC";
  return(
    <svg width={size} height={size*1.25} viewBox="0 0 40 50" fill="none">
      <defs>
        <clipPath id={"bc"+size}><path d="M8,11 L6,14 L5,18 L5,42 Q5,46 9,46 L31,46 Q35,46 35,42 L35,18 L34,14 L32,11 Z"/></clipPath>
        <linearGradient id={"wg"+size} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.95"/>
          <stop offset="100%" stopColor={fillColor} stopOpacity="1"/>
        </linearGradient>
        <linearGradient id={"bg"+size} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.14"/>
          <stop offset="100%" stopColor={T.accent} stopOpacity="0.05"/>
        </linearGradient>
      </defs>
      <rect x="14" y="3" width="12" height="8" rx="2" fill={T.accent} fillOpacity="0.45" stroke={T.accent} strokeWidth="0.8" strokeOpacity="0.5"/>
      <path d="M8,11 L6,14 L5,18 L5,42 Q5,46 9,46 L31,46 Q35,46 35,42 L35,18 L34,14 L32,11 Z" fill="url(#bg)" stroke={T.accent} strokeWidth="1.2" strokeOpacity="0.5"/>
      {pct>0&&<rect x="5" y={46-(28*pct)} width="30" height={28*pct} fill={"url(#wg"+size+")"} clipPath={"url(#bc"+size+")"} style={{transition:"y 0.7s cubic-bezier(.4,0,.2,1),height 0.7s"}}/>}
      {pct>0&&<ellipse cx="20" cy={46-(28*pct)} rx="12" ry="2" fill="#93C5FD" fillOpacity="0.35" clipPath={"url(#bc"+size+")"} style={{transition:"cy 0.7s"}}/>}
      <rect x="9" y="17" width="3" height="16" rx="1.5" fill="white" fillOpacity="0.09"/>
      <text x="20" y={38} textAnchor="middle" fill={pct>0.35?"#fff":T.accent} fontSize="7.5" fontWeight="800" fontFamily="-apple-system,sans-serif">{Math.round(pct*100)}%</text>
    </svg>
  );
}



// ── CREATE WORKOUT MODAL ─────────────────────────────────────────
function CreateWorkoutModal({onSave,onClose,existing}){
  const T=useTheme();
  const [name,setName]=useState(existing?.name||"");
  const [tag,setTag]=useState(existing?.tag||"Upper Body");
  const [level,setLevel]=useState(existing?.level||"Intermediate");
  const [estMin,setEstMin]=useState(String(existing?.estMin||45));
  const [exercises,setExercises]=useState(existing?.exercises||[]);
  const [showLib,setShowLib]=useState(false);
  const [libSearch,setLibSearch]=useState("");
  const [libCat,setLibCat]=useState("All");

  const filtered=EXERCISE_LIBRARY.filter(e=>
    (libCat==="All"||e.cat===libCat)&&
    (e.name.toLowerCase().includes(libSearch.toLowerCase())||e.muscle.toLowerCase().includes(libSearch.toLowerCase()))
  );

  const addExercise=(ex)=>{
    setExercises(prev=>[...prev,{
      id:"ex"+Date.now(),
      name:ex.name,
      sets:[{reps:10,weight:0,done:false},{reps:10,weight:0,done:false},{reps:10,weight:0,done:false}]
    }]);
    setShowLib(false);setLibSearch("");
  };

  const removeExercise=(id)=>setExercises(prev=>prev.filter(e=>e.id!==id));

  const updateSet=(exId,setIdx,field,val)=>{
    setExercises(prev=>prev.map(e=>e.id!==exId?e:{
      ...e,sets:e.sets.map((s,i)=>i!==setIdx?s:{...s,[field]:val})
    }));
  };

  const addSet=(exId)=>{
    setExercises(prev=>prev.map(e=>{
      if(e.id!==exId)return e;
      const last=e.sets[e.sets.length-1]||{reps:10,weight:0};
      return{...e,sets:[...e.sets,{reps:last.reps,weight:last.weight,done:false}]};
    }));
  };

  const removeSet=(exId,setIdx)=>{
    setExercises(prev=>prev.map(e=>e.id!==exId?e:{
      ...e,sets:e.sets.filter((_,i)=>i!==setIdx)
    }));
  };

  const handleSave=()=>{
    if(!name.trim()||exercises.length===0)return;
    onSave({
      id:existing?.id||"w"+Date.now(),
      name:name.trim(),tag,level,
      estMin:parseInt(estMin)||45,
      exercises,
    });
  };

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
      <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"90vh",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:700,color:T.text}}>{existing?"Edit workout":"Create workout"}</div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 16px 32px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Name */}
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Workout name (e.g. Push Day)" style={{background:T.inputBg,color:T.text,border:("1px solid "+name?T.accent:T.border),boxShadow:name?T.glowShadow:"none",borderRadius:12,padding:"12px 14px",fontSize:15,fontWeight:500,outline:"none"}}/>

          {/* Meta row */}
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Category</div>
              <select value={tag} onChange={e=>setTag(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none"}}>
                {["Upper Body","Lower Body","Full Body","Push","Pull","Legs","Core","Cardio","Custom"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Level</div>
              <select value={level} onChange={e=>setLevel(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none"}}>
                {["Beginner","Intermediate","Advanced"].map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div style={{width:72}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Est. min</div>
              <input type="number" value={estMin} onChange={e=>setEstMin(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 8px",fontSize:13,outline:"none",textAlign:"center"}}/>
            </div>
          </div>

          {/* Exercises */}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>Exercises ({exercises.length})</div>
            {exercises.map((ex,ei)=>(
              <div key={ex.id} style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:14,marginBottom:10}}>
                {/* Exercise header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.name}</div>
                  <div onClick={()=>removeExercise(ex.id)} style={{width:24,height:24,borderRadius:"50%",background:"rgba(248,113,113,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </div>
                {/* Set headers */}
                <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 24px",gap:6,marginBottom:6}}>
                  {["Set","Reps","Weight (lbs)",""].map((h,i)=>(
                    <div key={i} style={{fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8,textAlign:i>0?"center":"left"}}>{h}</div>
                  ))}
                </div>
                {/* Sets */}
                {ex.sets.map((s,si)=>(
                  <div key={si} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 24px",gap:6,marginBottom:6,alignItems:"center"}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.muted,textAlign:"center"}}>{si+1}</div>
                    <input type="number" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",parseFloat(e.target.value)||0)} style={{background:T.card,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 6px",fontSize:13,fontWeight:500,textAlign:"center",outline:"none",width:"100%"}}/>
                    <input type="number" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",parseFloat(e.target.value)||0)} style={{background:T.card,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 6px",fontSize:13,fontWeight:500,textAlign:"center",outline:"none",width:"100%"}}/>
                    <div onClick={()=>removeSet(ex.id,si)} style={{width:22,height:22,borderRadius:"50%",background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                      <svg width="8" height="8" viewBox="0 0 8 8"><line x1="1" y1="1" x2="7" y2="7" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                ))}
                <div onClick={()=>addSet(ex.id)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"7px",border:("1px dashed "+T.border),borderRadius:8,cursor:"pointer",marginTop:4}}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="6" x2="10" y2="6" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <div style={{fontSize:12,color:T.muted,fontWeight:500}}>Add set</div>
                </div>
              </div>
            ))}

            {/* Add exercise button */}
            <div onClick={()=>setShowLib(true)} style={{border:("1.5px dashed "+T.border),borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
              <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="8" y1="4" x2="8" y2="12" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="8" x2="12" y2="8" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div style={{fontSize:13,color:T.accent,fontWeight:600}}>Add exercise</div>
            </div>
          </div>

          {/* Exercise library picker */}
          {showLib&&(
            <div style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:14}}>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>Exercise library</div>
              <input value={libSearch} onChange={e=>setLibSearch(e.target.value)} placeholder="Search exercises..." style={{width:"100%",background:T.card,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",marginBottom:10,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:10,paddingBottom:2}}>
                {["All","Push","Pull","Legs","Core","Cardio"].map(c=>(
                  <div key={c} onClick={()=>setLibCat(c)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),background:libCat===c?T.accent:T.card,color:libCat===c?"#fff":T.muted,whiteSpace:"nowrap",flexShrink:0}}>{c}</div>
                ))}
              </div>
              <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
                {filtered.map((ex,i)=>(
                  <div key={i} onClick={()=>addExercise(ex)} style={{background:T.card,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:T.text}}>{ex.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>{ex.muscle} · {ex.cat}</div>
                    </div>
                    <div style={{width:22,height:22,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                ))}
                {filtered.length===0&&<div style={{fontSize:13,color:T.muted,textAlign:"center",padding:"16px 0"}}>No exercises found</div>}
              </div>
            </div>
          )}

          {/* Save button */}
          <button onClick={handleSave} disabled={!name.trim()||exercises.length===0} style={{background:!name.trim()||exercises.length===0?T.muted:T.accent,border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:!name.trim()||exercises.length===0?"not-allowed":"pointer",transition:"background 0.2s"}}>
            {existing?"Save changes":"Create workout"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ACTIVE WORKOUT VIEW ──────────────────────────────────────────
function ActiveWorkout({workout,onFinish,onClose,bests={},restore=null,snapKey=null}){
  const T=useTheme();
  // `restore` is a snapshot of this same workout from before an unmount — a tab
  // switch, a reload, or the app being evicted. Seeding from it is what makes
  // those recoverable instead of silent data loss.
  const [sets,setSets]=useState(()=>
    restore?.sets||workout.exercises.map(ex=>({
      ...ex,
      sets:ex.sets.map(s=>({...s,done:false,actualReps:s.reps,actualWeight:s.weight}))
    }))
  );
  const [elapsed,setElapsed]=useState(0);
  const [restSecs,setRestSecs]=useState(null);   // null = not resting
  const [restTotal,setRestTotal]=useState(90);   // configured duration
  const [restDuration,setRestDuration]=useState(90); // picker value
  const [confirmCancel,setConfirmCancel]=useState(false);
  // Only meaningful on a restored session, and only until dismissed. A resumed
  // workout is otherwise indistinguishable from a fresh one that inexplicably
  // has sets ticked and a running clock.
  const [showResumed,setShowResumed]=useState(!!restore);
  const timerRef=useRef();
  const audioCtx=useRef(null);
  // Both timers are derived from wall-clock timestamps, not from counting ticks.
  // setInterval is throttled hard in a backgrounded tab (Chrome drops to roughly
  // once a minute) and can stop entirely while a phone is locked — which is the
  // normal case for a PWA sitting in a pocket between sets, not an edge case.
  // Counting ticks meant a real session was silently under-reported, in the same
  // direction as the 3-13 second click-through artifacts, so the two would have
  // been indistinguishable. Deriving from timestamps means a throttled or
  // suspended tab simply catches up on its next tick.
  // Restored so a resumed session keeps its true start — otherwise elapsed
  // would restart at zero and duration_secs would under-report, which is the
  // failure the timestamp timer exists to prevent.
  const startedAtRef=useRef(restore?.startedAt||Date.now());
  const restEndsAtRef=useRef(restore?.restEndsAt??null);

  // Rest is a deadline, not a countdown, for the same reason.
  const startRest=(secs)=>{restEndsAtRef.current=Date.now()+secs*1000;setRestSecs(secs);setRestTotal(secs);};
  const clearRest=()=>{restEndsAtRef.current=null;setRestSecs(null);};

  // The number that gets STORED is read from the clock at the moment Finish is
  // tapped, not from `elapsed`. Deriving elapsed from timestamps fixes the rate
  // it accumulates, but the state is still only as fresh as the last tick — and
  // a throttled tab may not have ticked for a minute. `elapsed` drives the
  // display; this drives the row in workout_sessions.
  const finalElapsed=()=>Math.floor((Date.now()-startedAtRef.current)/1000);

  // Debounced: updateSet fires on every keystroke in the reps and weight inputs,
  // so saving directly on change would write to localStorage once per character.
  // elapsed and restSecs are deliberately NOT dependencies — they change every
  // second and would turn this into a 1Hz write loop. restEndsAt is read from
  // the ref at save time, so it rides along with the next real change.
  useEffect(()=>{
    if(!snapKey)return;
    const t=setTimeout(()=>{
      try{
        localStorage.setItem(snapKey,JSON.stringify({
          v:1,workout,sets,
          startedAt:startedAtRef.current,
          restEndsAt:restEndsAtRef.current,
          savedAt:Date.now(),
        }));
      }catch{}
    },500);
    return()=>clearTimeout(t);
  },[snapKey,workout,sets]);

  // Play a short beep using Web Audio API
  const beep=()=>{
    try{
      if(!audioCtx.current)audioCtx.current=new(window.AudioContext||window.webkitAudioContext)();
      const ctx=audioCtx.current;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=880;gain.gain.setValueAtTime(0.3,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
      osc.start(ctx.currentTime);osc.stop(ctx.currentTime+0.4);
    }catch{}
    try{navigator.vibrate&&navigator.vibrate([100,50,100]);}catch{}
  };

  useEffect(()=>{
    const tick=()=>{
      setElapsed(Math.floor((Date.now()-startedAtRef.current)/1000));
      const endsAt=restEndsAtRef.current;
      if(endsAt===null)return;
      const msLeft=endsAt-Date.now();
      if(msLeft>0){setRestSecs(Math.ceil(msLeft/1000));return;}
      restEndsAtRef.current=null;
      setRestSecs(null);
      // Only sound if rest ended just now. Coming back to the tab ten minutes
      // later, the user does not need to be told their rest is over.
      if(msLeft>-2000)beep();
    };
    tick();
    timerRef.current=setInterval(tick,1000);
    return()=>clearInterval(timerRef.current);
  },[]);

  const allSets=sets.flatMap(e=>e.sets);
  const doneSets=allSets.filter(s=>s.done).length;
  const totalSets=allSets.length;
  // Derived, not accumulated: reflects the sets as they are right now.
  const newPRs=useMemo(()=>computePRs(sets,bests),[sets,bests]);
  const pct=totalSets>0?Math.round((doneSets/totalSets)*100):0;

  const toggleSet=(exIdx,setIdx)=>{
    setSets(prev=>prev.map((ex,ei)=>ei!==exIdx?ex:{
      ...ex,sets:ex.sets.map((s,si)=>{
        if(si!==setIdx)return s;
        const nowDone=!s.done;
        if(nowDone){
          startRest(restDuration);
          // Check PR: beat a recorded best, not merely exist.
          //
          // best===0 means this exercise has no history to beat, and a first-ever
          // lift is a baseline, not a record. Without the best>0 test an empty
          // bests made every weighted set a "PR" — that is what put 4 phantom
          // PRs on a 13-second artifact session, and it would fire on every
          // exercise of the first real session too, since bests is seeded
          // only when workout_sessions already has rows.
          //
          // Every writer of bests stores positive weights only (see the
          // loader and both setBests updaters), so best>0 is exactly "has a
          // baseline". This also fails safe if a workout starts before the
          // history load finishes: no PRs claimed rather than all of them.
        }else{
          clearRest();
        }
        return{...s,done:nowDone};
      })
    }));
  };

  const updateSet=(exIdx,setIdx,field,val)=>{
    setSets(prev=>prev.map((ex,ei)=>ei!==exIdx?ex:{
      ...ex,sets:ex.sets.map((s,si)=>si!==setIdx?s:{...s,[field]:val})
    }));
  };

  const fmt=(s)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");

  // Circular ring math
  const R=28,CIRC=2*Math.PI*R;
  const ringPct=restSecs!==null&&restTotal>0?restSecs/restTotal:0;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:T.appBg,zIndex:190,overflowY:"auto",paddingBottom:80}}>

      {/* Cancel confirmation. Cancel is the only exit that destroys work: it
          clears the snapshot as well as the session, so nothing survives it —
          not a reload, not the nav dot. It is also a small target in the corner
          a back-swipe thumb reaches for. zIndex sits above the 190 of this view
          for the same reason that 190 is what hides the bottom nav. */}
      {confirmCancel&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:400,padding:"22px 20px 20px",boxShadow:"0 24px 64px rgba(0,0,0,0.35)",display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:T.text}}>Discard this workout?</div>
              <div style={{fontSize:13,color:T.subtext,marginTop:6,lineHeight:1.45}}>
                {doneSets} of {totalSets} sets, {fmt(elapsed)} elapsed{newPRs.length>0?(", "+newPRs.length+" PR"+(newPRs.length===1?"":"s")):""}. This cannot be undone — nothing is saved and the session will not come back after a reload.
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={()=>setConfirmCancel(false)} style={{width:"100%",background:T.accent,border:"none",borderRadius:12,padding:"13px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>
                Keep going
              </button>
              <button onClick={()=>{setConfirmCancel(false);onClose();}} style={{width:"100%",background:"transparent",border:("1px solid "+T.border),borderRadius:12,padding:"13px",color:T.red,fontSize:15,fontWeight:600,cursor:"pointer"}}>
                Discard workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:T.card,padding:"16px 16px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
        <div onClick={()=>doneSets>0?setConfirmCancel(true):onClose()} style={{fontSize:13,color:T.muted,cursor:"pointer"}}>✕ Cancel</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text}}>{workout.name}</div>
          <div style={{fontSize:12,color:T.accent,fontWeight:600}}>{fmt(elapsed)}</div>
        </div>
        <div onClick={()=>onFinish(sets,finalElapsed(),startedAtRef.current)} style={{fontSize:13,color:T.accent,fontWeight:700,cursor:"pointer"}}>Finish</div>
      </div>

      {/* Progress bar */}
      <div style={{height:3,background:T.border}}>
        <div style={{height:"100%",width:(pct+"%"),background:("linear-gradient(90deg,"+T.accent+","+T.accentSoft+")"),transition:"width 0.4s"}}/>
      </div>

      {/* Resumed-session banner. The restore has already happened by the time
          this renders — it reports, it does not ask. The nav dot is what brings
          the user back here after a reload; this is what tells them the sets and
          the clock they are looking at were carried over rather than invented. */}
      {showResumed&&(
        <div style={{background:T.accentPill,borderBottom:("1px solid "+T.accent),padding:"9px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{fontSize:12,color:T.accent,fontWeight:600}}>
            Resumed · started {new Date(startedAtRef.current).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
          </div>
          <div onClick={()=>setShowResumed(false)} style={{fontSize:12,color:T.accent,fontWeight:700,cursor:"pointer",flexShrink:0,padding:"0 4px"}}>✕</div>
        </div>
      )}

      {/* Rest timer — ring version */}
      {restSecs!==null&&(
        <div style={{background:T.card,border:("1px solid "+T.accent),margin:"12px 16px 0",borderRadius:16,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.accent,marginBottom:4}}>⏱ Rest</div>
            <div style={{display:"flex",gap:6}}>
              {[60,90,120,180].map(d=>(
                <div key={d} onClick={()=>{setRestDuration(d);startRest(d);}}
                  style={{padding:"4px 8px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",
                    background:restDuration===d?T.accent:T.surface,
                    color:restDuration===d?"#fff":T.muted,border:("1px solid "+restDuration===d?T.accent:T.border)}}>
                  {d}s
                </div>
              ))}
            </div>
          </div>
          {/* Circular progress */}
          <div style={{position:"relative",width:72,height:72,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="72" height="72" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
              <circle cx="36" cy="36" r={R} fill="none" stroke={T.border} strokeWidth="4"/>
              <circle cx="36" cy="36" r={R} fill="none" stroke={T.accent} strokeWidth="4"
                strokeDasharray={CIRC} strokeDashoffset={CIRC*(1-ringPct)}
                strokeLinecap="round" style={{transition:"stroke-dashoffset 0.9s linear"}}/>
            </svg>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:17,fontWeight:800,color:T.accent,fontFamily:"monospace",lineHeight:1}}>{fmt(restSecs)}</div>
            </div>
          </div>
          <div onClick={clearRest} style={{fontSize:12,color:T.muted,cursor:"pointer",textAlign:"center"}}>Skip</div>
        </div>
      )}

      {/* New PR flash */}
      {newPRs.length>0&&(
        <div style={{margin:"10px 16px 0",background:"linear-gradient(135deg,#F59E0B22,#EF444422)",border:"1px solid #F59E0B55",borderRadius:12,padding:"10px 14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#F59E0B"}}>🏆 New PR{newPRs.length>1?"s":""} this session!</div>
          <div style={{fontSize:12,color:T.muted,marginTop:3}}>{newPRs.join(" · ")}</div>
        </div>
      )}

      {/* Stats */}
      <div style={{display:"flex",gap:10,padding:"12px 16px 0"}}>
        {[[doneSets+"/"+totalSets,"Sets done"],[pct+"%","Complete"],[fmt(elapsed),"Elapsed"]].map(([v,l])=>(
          <div key={l} style={{flex:1,background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:700,color:T.accent}}>{v}</div>
            <div style={{fontSize:10,color:T.muted,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Exercises */}
      {sets.map((ex,ei)=>(
        <div key={ex.id} style={{margin:"12px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>{ex.name}</div>
            {newPRs.includes(ex.name)&&<span style={{fontSize:10,fontWeight:700,color:"#F59E0B",background:"rgba(245,158,11,0.15)",padding:"2px 8px",borderRadius:20}}>🏆 PR</span>}
            {bests[ex.name]&&<span style={{fontSize:10,color:T.muted}}>Best: {bests[ex.name]}lbs</span>}
          </div>
          <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 44px",gap:8,padding:"8px 12px",borderBottom:("1px solid "+T.border),background:T.surface}}>
              {["Set","Reps","lbs","✓"].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8,textAlign:"center"}}>{h}</div>
              ))}
            </div>
            {ex.sets.map((s,si)=>(
              <div key={si} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 44px",gap:8,padding:"10px 12px",borderBottom:si<ex.sets.length-1?"1px solid "+T.border:"none",alignItems:"center",background:s.done?"rgba(6,182,212,0.05)":"transparent",transition:"background 0.2s"}}>
                <div style={{fontSize:13,fontWeight:700,color:T.muted,textAlign:"center"}}>{si+1}</div>
                <input type="number" value={s.actualReps} onChange={e=>updateSet(ei,si,"actualReps",parseFloat(e.target.value)||0)} style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 4px",fontSize:14,fontWeight:600,textAlign:"center",outline:"none",width:"100%"}}/>
                <input type="number" value={s.actualWeight} onChange={e=>updateSet(ei,si,"actualWeight",parseFloat(e.target.value)||0)} style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 4px",fontSize:14,fontWeight:600,textAlign:"center",outline:"none",width:"100%"}}/>
                <div onClick={()=>toggleSet(ei,si)} style={{width:36,height:36,borderRadius:10,background:s.done?T.accent:T.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"background 0.2s",margin:"0 auto"}}>
                  {s.done?<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,7 6,11 12,3" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round"/></svg>:<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1,5 4,8 9,2" stroke={T.muted} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Finish button */}
      <div style={{padding:"20px 16px 0"}}>
        <button onClick={()=>onFinish(sets,finalElapsed(),startedAtRef.current)} style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"16px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 20px "+T.accentGlow)}}>
          🏁 Finish workout
        </button>
      </div>
    </div>
  );
}

// ── EXERCISE PREVIEW LIST (expandable) ───────────────────────────
function ExercisePreviewList({exercises}){
  const T=useTheme();
  const [expanded,setExpanded]=useState(null);
  const toggle=(id)=>setExpanded(e=>e===id?null:id);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:600,color:T.text}}>Exercise preview</div>
        <div style={{fontSize:11,color:T.muted}}>Tap to see sets</div>
      </div>
      {exercises.map((ex,i)=>{
        const isOpen=expanded===ex.id;
        const totalVol=ex.sets.reduce((s,set)=>s+(set.reps*(set.weight||0)),0);
        return(
          <div
            key={ex.id}
            style={{background:T.card,border:("1px solid "+isOpen?T.accent:T.border),boxShadow:isOpen?T.glowShadow:T.glowShadow,borderRadius:14,marginBottom:8,overflow:"hidden",transition:"border-color 0.2s",cursor:"pointer"}}
            onClick={()=>toggle(ex.id)}
          >
            {/* Header row — always visible */}
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:28,height:28,borderRadius:8,background:isOpen?T.accent:T.accentPill,color:isOpen?"#fff":T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0,transition:"background 0.2s"}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.name}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:1}}>
                  {ex.sets.length} sets · {ex.sets[0]?.reps} reps
                  {ex.sets[0]?.weight>0?" · "+ex.sets[0].weight+" lbs":" · Bodyweight"}
                  {totalVol>0&&<span style={{color:T.accent,fontWeight:500}}> · {totalVol.toLocaleString()} lbs vol</span>}
                </div>
              </div>
              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0,transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
                <polyline points="2,4 7,10 12,4" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
            </div>

            {/* Expanded set breakdown */}
            {isOpen&&(
              <div style={{borderTop:("1px solid "+T.border),background:T.surface}}>
                {/* Column headers */}
                <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 1fr",gap:0,padding:"7px 14px",borderBottom:("1px solid "+T.border)}}>
                  {["Set","Target reps","Weight","Volume"].map((h,hi)=>(
                    <div key={h} style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:0.8,textAlign:hi===0?"left":"center"}}>{h}</div>
                  ))}
                </div>
                {/* Set rows */}
                {ex.sets.map((s,si)=>{
                  const vol=s.reps*(s.weight||0);
                  return(
                    <div key={si} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 1fr",gap:0,padding:"9px 14px",borderBottom:si<ex.sets.length-1?"1px solid "+T.border:"none",alignItems:"center"}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.accent}}>S{si+1}</div>
                      <div style={{textAlign:"center"}}>
                        <span style={{background:T.accentPill,color:T.accent,fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20}}>{s.reps} reps</span>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>
                          {s.weight>0?s.weight+" lbs":"BW"}
                        </span>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <span style={{fontSize:12,color:T.muted}}>{vol>0?vol.toLocaleString()+" lbs":"—"}</span>
                      </div>
                    </div>
                  );
                })}
                {/* Summary footer */}
                <div style={{padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:("1px solid "+T.border)}}>
                  <div style={{fontSize:11,color:T.muted}}>{ex.sets.length} sets total</div>
                  {totalVol>0&&(
                    <div style={{fontSize:11,fontWeight:600,color:T.accent}}>Total volume: {totalVol.toLocaleString()} lbs</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── WORKOUT TAB ──────────────────────────────────────────────────
function WorkoutTab({workouts,setWorkouts,history=[],prEvents={},onSessionComplete,bests,onReadSession,onSaveSession,onDeleteSession,onSavePlan,onDeletePlan,uid,onActiveChange,historyStatus="ready",onRetryHistory,pendingStartPlanId=null,onPendingConsumed}){
  const T=useTheme();
  const [createOpen,setCreateOpen]=useState(false);
  const [editWorkout,setEditWorkout]=useState(null);
  // Read once, on mount. This component is remounted by every visit to the tab,
  // so this is also the resume path after navigating away mid-workout.
  const snapKey=workoutKey(uid);
  const [restored]=useState(()=>readWorkoutSnapshot(snapKey));
  const [activeWorkout,setActiveWorkout]=useState(()=>restored?.workout||null);
  const [view,setView]=useState("today");

  // Lets the nav show that a session is live while the user is on another tab.
  // No cleanup on unmount: unmounting is exactly the case where the workout is
  // still running and the flag must stay true.
  useEffect(()=>{onActiveChange&&onActiveChange(!!activeWorkout);},[activeWorkout,onActiveChange]);

  // Only seed ActiveWorkout from the snapshot while activeWorkout IS the
  // restored one. Reference equality, so starting any other workout afterwards
  // gets a clean slate rather than someone else's sets.
  const restorePayload=restored&&activeWorkout===restored.workout?restored:null;
  // No session may start against an unloaded history: its PRs would persist
  // as false. Retry re-reads; the banner is the only thing that unblocks Start.
  const canStart=historyStatus!=="failed";
  // #25 editor state. editing = {id, exercises} (a normalised copy re-read
  // from the row when the editor opened); confirmDelete = session id.
  const [editing,setEditing]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [mutating,setMutating]=useState(false);
  const openEditor=async(h)=>{
    if(mutating||!onReadSession)return;
    setMutating(true);
    const exercises=await onReadSession(h.id);
    setMutating(false);
    if(exercises)setEditing({id:h.id,exercises});
  };
  const saveEditor=async()=>{
    if(!editing||mutating)return;
    setMutating(true);
    const ok=await onSaveSession(editing.id,editing.exercises);
    setMutating(false);
    if(ok)setEditing(null); // on failure App said why; the editor keeps the user's numbers
  };
  const doDelete=async(id)=>{
    if(mutating)return;
    setMutating(true);
    const ok=await onDeleteSession(id);
    setMutating(false);
    if(ok)setConfirmDelete(null);
  };
  const startPlan=(plan)=>{if(canStart)setActiveWorkout(plan);};

  const cancelWorkout=()=>{clearWorkoutSnapshot(snapKey);setActiveWorkout(null);};

  // Home's Start button: consume the pending id in an effect, not a render.
  // StrictMode runs this twice with the same id; the functional update keeps
  // the first open and the second call finds a session already live.
  useEffect(()=>{
    if(!pendingStartPlanId)return;
    if(historyStatus==="failed"){onPendingConsumed&&onPendingConsumed();return;} // Start is blocked until history loads
    const plan=workouts.find(w=>w.id===pendingStartPlanId);
    if(plan)setActiveWorkout(prev=>prev||plan);
    onPendingConsumed&&onPendingConsumed();
  },[pendingStartPlanId,workouts,onPendingConsumed]);

  const todayDayName=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]; // the TODAY badge in My Plans
  const todayWorkout=todayPlanFor(workouts);

  const saveWorkout=(w)=>{
    const isNew=!workouts.find(x=>x.id===w.id);
    setWorkouts(prev=>{
      const exists=prev.find(x=>x.id===w.id);
      return exists?prev.map(x=>x.id===w.id?w:x):[...prev,w];
    });
    onSavePlan&&onSavePlan(w,isNew);
    setCreateOpen(false);setEditWorkout(null);
  };

  const deleteWorkout=async(id)=>{
    const idx=workouts.findIndex(w=>w.id===id);
    const removed=workouts[idx];
    setWorkouts(prev=>prev.filter(w=>w.id!==id));
    const ok=onDeletePlan?await onDeletePlan(id):true;
    if(!ok&&removed)setWorkouts(prev=>{const next=[...prev];next.splice(Math.min(idx,next.length),0,removed);return next;}); // restore where it was; App already said why
  };

  const finishWorkout=(sets,elapsed,startedAt=Date.now())=>{
    const allSets=sets.flatMap(e=>e.sets);
    const doneSets=allSets.filter(s=>s.done).length;
    const entry={
      id:"h"+Date.now(),
      workoutName:activeWorkout.name,
      // Dated from when the work STARTED, not when Finish was tapped. An 11pm
      // session finishing at 12:30am belongs to the day it was trained, and a
      // resumed session must not take the date of whenever the app happened to
      // remount. Explicit rather than inherited: this used to be localDate(),
      // which read `today` — computed once per App mount (known issue #8) — so
      // the stamped day was an accident of mount timing.
      date:localDate(new Date(startedAt)),
      startedAt,
      duration:elapsed,
      setsCompleted:doneSets,
      totalSets:allSets.length,
      // prs / isPR are no longer stored (#28): the history cards read the
      // exercise_pr_events view, which recomputes from setsData. The only PR
      // logic left on the client is ActiveWorkout's live banner — computePRs
      // against the baseline loaded at session start — because the session
      // isn't saved yet and the view can't see it.
      // Labels are derived from setsData, not typed alongside it: one source,
      // and normalizeExercises pins the shape the reader expects.
      exercises:normalizeExercises(sets.map(ex=>{const setsData=setsDataOf(ex);return{name:ex.name,sets:setsData.map(setLabel),setsData};}))
    };
    clearWorkoutSnapshot(snapKey);
    onSessionComplete&&onSessionComplete(entry);
    setActiveWorkout(null);
    setView("history");
  };

  const fmt=(s)=>Math.floor(s/60)+"m "+s%60+"s";

  // ── VIEWS ──
  const views=[["today","Today"],["plans","My Plans"],["history","History"]];

  return(
    <div style={{paddingBottom:80}}>
      {createOpen&&<CreateWorkoutModal onSave={saveWorkout} onClose={()=>setCreateOpen(false)}/>}
      {editWorkout&&<CreateWorkoutModal existing={editWorkout} onSave={saveWorkout} onClose={()=>setEditWorkout(null)}/>}
      {activeWorkout&&<ActiveWorkout workout={activeWorkout} onFinish={finishWorkout} onClose={cancelWorkout} bests={bests} restore={restorePayload} snapKey={snapKey}/>}

      {/* Header */}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:700,color:T.text}}>Workout</div><div style={{fontSize:13,color:T.muted}}>{workouts.length} plan{workouts.length!==1?"s":""} · {history.length} sessions logged</div></div>
        <div onClick={()=>setCreateOpen(true)} style={{background:T.accentPill,border:("1px solid "+T.accent),borderRadius:20,padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="1" x2="6" y2="11" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="6" x2="11" y2="6" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/></svg>
          <span style={{fontSize:13,fontWeight:600,color:T.accent}}>New</span>
        </div>
      </div>

      {historyStatus==="failed"&&(
        <div data-testid="history-failed" style={{margin:"12px 16px 0",padding:"10px 14px",borderRadius:12,background:T.accentPill,border:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{fontSize:12,color:T.text}}>Couldn't load your history — PRs can't be checked, so starting is paused.</div>
          <div onClick={onRetryHistory} style={{fontSize:12,fontWeight:700,color:T.accent,cursor:"pointer",flexShrink:0}}>Retry</div>
        </div>
      )}

      {/* View toggle */}
      <div style={{display:"flex",gap:0,background:T.surface,margin:"12px 16px 0",borderRadius:12,padding:3,border:("1px solid "+T.border)}}>
        {views.map(([v,l])=>(
          <div key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px 6px",borderRadius:10,fontSize:12,fontWeight:600,textAlign:"center",cursor:"pointer",background:view===v?T.accent:"transparent",color:view===v?"#fff":T.muted,transition:"all 0.15s"}}>{l}</div>
        ))}
      </div>

      {/* ── TODAY VIEW ── */}
      {view==="today"&&todayWorkout&&(
        <div style={{padding:"12px 16px 0"}}>
          {/* Today's workout banner */}
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:16,padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:T.accentGlow,filter:"blur(24px)"}}/>
            <div style={{display:"inline-block",background:"rgba(6,182,212,0.3)",color:"#A855F7",fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,marginBottom:10,letterSpacing:"0.5px"}}>TODAY · {todayWorkout.tag.toUpperCase()}</div>
            <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:4}}>{todayWorkout.name}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:14}}>{todayWorkout.exercises.length} exercises · ~{todayWorkout.estMin} min · {todayWorkout.level}</div>
            <button onClick={()=>startPlan(todayWorkout)} disabled={!canStart} style={{background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:700,cursor:canStart?"pointer":"not-allowed",opacity:canStart?1:0.5,boxShadow:("0 4px 16px "+T.accentGlow)}}>
              🏋️ Start workout
            </button>
          </div>

          {/* Exercise preview */}
          <ExercisePreviewList exercises={todayWorkout.exercises} />
        </div>
      )}

      {view==="today"&&!todayWorkout&&(
        <div style={{padding:"40px 16px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>💪</div>
          <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:6}}>No workout planned for today</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:20}}>Create your first workout plan to get started</div>
          <button onClick={()=>setCreateOpen(true)} style={{background:T.accent,border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Create a workout</button>
        </div>
      )}

      {/* ── MY PLANS VIEW ── */}
      {view==="plans"&&(
        <div style={{padding:"12px 16px 0"}}>
          {workouts.length===0?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:6}}>No workout plans yet</div>
              <div style={{fontSize:13,color:T.muted,marginBottom:20}}>Tap "New" to create your first plan</div>
              <button onClick={()=>setCreateOpen(true)} style={{background:T.accent,border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Create first plan</button>
            </div>
          ):workouts.map((w,i)=>(
            <div key={w.id} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:16,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:T.text}}>{w.name}</div>
                    {w.scheduledDay===todayDayName&&<span style={{background:T.accentPill,color:T.accent,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>TODAY</span>}
                  </div>
                  <div style={{fontSize:12,color:T.muted}}>{w.exercises.length} exercises · {w.estMin}min · {w.level} · {w.tag}{w.scheduledDay?(" · 📅 "+w.scheduledDay):""}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <div onClick={()=>setEditWorkout(w)} style={{width:30,height:30,borderRadius:8,background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={T.accent} strokeWidth="1.5"><path d="M9 2l2 2L4 11H2V9L9 2z"/></svg>
                  </div>
                  <div onClick={()=>deleteWorkout(w.id)} style={{width:30,height:30,borderRadius:8,background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                    <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/><line x1="11" y1="1" x2="1" y2="11" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {w.exercises.slice(0,4).map(ex=>(
                  <span key={ex.id} style={{background:T.accentPill,color:T.accent,fontSize:11,padding:"3px 9px",borderRadius:20}}>{ex.name}</span>
                ))}
                {w.exercises.length>4&&<span style={{background:T.surface,color:T.muted,fontSize:11,padding:"3px 9px",borderRadius:20}}>+{w.exercises.length-4} more</span>}
              </div>
              <button onClick={()=>startPlan(w)} disabled={!canStart} style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:canStart?"pointer":"not-allowed",opacity:canStart?1:0.5}}>
                🏋️ Start this workout
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view==="history"&&(
        <div style={{padding:"12px 16px 0"}}>
          {historyStatus==="failed"?(
            // The list in state may predate a mutation that succeeded before
            // the re-read failed — a stale list rendered as truth. Say so.
            <div data-testid="history-list-failed" style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:6}}>Couldn't load your history</div>
              <div style={{fontSize:13,color:T.muted,marginBottom:12}}>What was shown before may be out of date, so it isn't shown.</div>
              <div onClick={onRetryHistory} style={{display:"inline-block",fontSize:13,fontWeight:700,color:T.accent,cursor:"pointer"}}>Retry</div>
            </div>
          ):history.length===0?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:6}}>No workout history yet</div>
              <div style={{fontSize:13,color:T.muted}}>Complete a workout to see your history here</div>
            </div>
          ):history.map(h=>{const prs=prEvents[h.id]||[];return(
            <div key={h.id} style={{background:T.card,border:"1px solid "+(prs.length>0?"rgba(245,158,11,0.4)":T.border),boxShadow:prs.length>0?"0 0 16px rgba(245,158,11,0.12)":T.glowShadow,borderRadius:14,padding:16,marginBottom:12}}>
              {/* PR banner */}
              {prs.length>0&&(
                <div style={{background:"linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.1))",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>🏆</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#F59E0B"}}>New PR{prs.length>1?"s":""} this session!</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:1}}>{prs.join(" · ")}</div>
                  </div>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{h.workoutName}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{h.date}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{fmt(h.duration)}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:1}}>{h.setsCompleted}/{h.totalSets} sets</div>
                </div>
              </div>
              {hasDbId(h)&&editing?.id!==h.id&&(
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  {confirmDelete===h.id?(
                    <>
                      <span style={{fontSize:12,color:T.text,alignSelf:"center"}}>Delete this session?</span>
                      <button type="button" data-testid={"session-delete-confirm-"+h.id} disabled={mutating} onClick={()=>doDelete(h.id)} style={{background:T.red,color:"#fff",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Delete</button>
                      <button type="button" disabled={mutating} onClick={()=>setConfirmDelete(null)} style={{background:"transparent",color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Keep</button>
                    </>
                  ):(
                    <>
                      <button type="button" data-testid={"session-edit-"+h.id} disabled={mutating} onClick={()=>openEditor(h)} style={{background:"transparent",color:T.accent,border:("1px solid "+T.border),borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit sets</button>
                      <button type="button" data-testid={"session-delete-"+h.id} disabled={mutating} onClick={()=>setConfirmDelete(h.id)} style={{background:"transparent",color:T.red,border:("1px solid "+T.border),borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Delete</button>
                    </>
                  )}
                </div>
              )}
              {editing?.id===h.id&&(
                <div data-testid={"session-editor-"+h.id} style={{background:T.surface,border:("1px solid "+T.border),borderRadius:10,padding:10,marginBottom:8}}>
                  <div style={{fontSize:11,color:T.muted,marginBottom:8}}>Correct reps / weight. Exercise names, dates and set counts can't change here.</div>
                  {editing.exercises.map((ex,ei)=>(
                    <div key={ei} style={{marginBottom:8}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4}}>{ex.name}</div>
                      {ex.setsData.map((d,si)=>(
                        <div key={si} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:11,color:T.muted,width:34}}>Set {si+1}</span>
                          <input type="number" inputMode="decimal" value={d.reps} data-testid={"edit-reps-"+ei+"-"+si} onChange={e=>setEditing(ed=>({...ed,exercises:editSet(ed.exercises,ei,si,{reps:e.target.value,weight:d.weight})}))} style={{width:60,background:T.inputBg||T.card,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"6px 8px",fontSize:13}}/>
                          <span style={{fontSize:11,color:T.muted}}>reps ×</span>
                          <input type="number" inputMode="decimal" value={d.weight} data-testid={"edit-weight-"+ei+"-"+si} onChange={e=>setEditing(ed=>({...ed,exercises:editSet(ed.exercises,ei,si,{reps:d.reps,weight:e.target.value})}))} style={{width:70,background:T.inputBg||T.card,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"6px 8px",fontSize:13}}/>
                          <span style={{fontSize:11,color:T.muted}}>lbs</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8}}>
                    <button type="button" data-testid={"session-save-"+h.id} disabled={mutating} onClick={saveEditor} style={{background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{mutating?"Saving…":"Save"}</button>
                    <button type="button" disabled={mutating} onClick={()=>setEditing(null)} style={{background:"transparent",color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {(h.exercises||[]).filter(e=>(e.sets||[]).length>0).map((ex,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:prs.includes(ex.name)?"rgba(245,158,11,0.08)":T.surface,borderRadius:8,border:prs.includes(ex.name)?"1px solid rgba(245,158,11,0.2)":"1px solid transparent"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {prs.includes(ex.name)&&<span style={{fontSize:11}}>🏆</span>}
                      <div style={{fontSize:12,fontWeight:500,color:T.text}}>{ex.name}</div>
                    </div>
                    <div style={{fontSize:11,color:T.muted}}>{ex.sets.join(" · ")}</div>
                  </div>
                ))}
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}


// ── REMINDER MODAL ───────────────────────────────────────────────
function ReminderModal({supp,onSave,onClose}){
  const T=useTheme();
  const [time,setTime]=useState(supp.reminderTime||"08:00");
  const [enabled,setEnabled]=useState(supp.reminderEnabled||false);
  const [permDenied,setPermDenied]=useState(false);

  const requestPermAndSave=async()=>{
    if(enabled&&"Notification" in window){
      const perm=await Notification.requestPermission();
      if(perm==="denied"){setPermDenied(true);return;}
    }
    onSave({reminderEnabled:enabled,reminderTime:time});
  };

  const fmtTime=(t)=>{
    const [h,m]=t.split(":").map(Number);
    const ampm=h>=12?"PM":"AM";
    const h12=h===0?12:h>12?h-12:h;
    return h12+":"+String(m).padStart(2,"0")+" "+ampm;
  };

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
      <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,padding:"24px 20px 28px",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column",gap:20}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:T.text}}>Set a time</div>
            <div style={{fontSize:12,color:T.subtext,marginTop:2}}>{supp.name}</div>
          </div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Enable toggle */}
        <div style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>Show a time on this supplement</div>
            <div style={{fontSize:12,color:T.subtext,marginTop:2}}>A nudge appears while the app is open. Background alerts need the iOS app.</div>
          </div>
          <div onClick={()=>setEnabled(e=>!e)} style={{width:48,height:28,borderRadius:14,background:enabled?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,boxShadow:enabled?("0 0 10px "+T.accentGlow):"none"}}>
            <div style={{position:"absolute",top:3,left:enabled?23:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.25)"}}/>
          </div>
        </div>

        {/* Time picker */}
        {enabled&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>Reminder time</div>
            <div style={{background:T.surface,border:("1px solid "+T.accent),boxShadow:T.glowShadow,borderRadius:14,padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div style={{fontSize:42,fontWeight:800,color:T.accent,letterSpacing:"-1px"}}>{fmtTime(time)}</div>
              <input
                type="time"
                value={time}
                onChange={e=>setTime(e.target.value)}
                style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 16px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",textAlign:"center",cursor:"pointer"}}
              />
            </div>

            {/* Quick time presets */}
            <div>
              <div style={{fontSize:12,color:T.subtext,marginBottom:8}}>Quick presets</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[["Morning","07:00"],["With breakfast","08:00"],["Midday","12:00"],["Pre-workout","17:00"],["Dinner","18:00"],["Before bed","21:00"],["Night","22:00"]].map(([label,t])=>(
                  <div key={t} onClick={()=>setTime(t)}
                    style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:("1px solid "+time===t?T.accent:T.border),background:time===t?T.accentPill:"transparent",color:time===t?T.accent:T.subtext,transition:"all 0.15s"}}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Info note */}
            <div style={{background:T.accentPill,border:("1px solid "+T.border),borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0,marginTop:1}}>
                <circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/>
                <line x1="8" y1="5" x2="8" y2="8.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.8" fill={T.accent}/>
              </svg>
              <div style={{fontSize:11,color:T.subtext,lineHeight:1.5}}>
                Browser reminders work while the app is open. For native lock screen alerts even when closed, install the app to your home screen or use the iOS app via Capacitor.
              </div>
            </div>
          </div>
        )}

        {permDenied&&(
          <div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:"10px 14px",fontSize:12,color:T.red}}>
            Browser notifications are blocked, so the in-app nudge can't show. The time label still works.
          </div>
        )}

        <button onClick={requestPermAndSave}
          style={{background:T.accent,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 16px "+T.accentGlow)}}>
          {enabled?"Save reminder · "+fmtTime(time):"Save (no reminder)"}
        </button>
      </div>
    </div>
  );
}

// ── BROWSER NOTIFICATION SCHEDULER ──────────────────────────────
// An IN-APP nudge while the tab is open. That is all this is: a setTimeout in
// the current tab. It does not fire when the tab is closed, backgrounded on
// iOS, or the device is locked — there is no service worker, no Push, no
// persisted schedule. The UI says exactly that (P1, 2026-09-07); the real
// feature is UNUserNotificationCenter in the iOS app (PROJECT_CONTEXT #26).
// Returns a cancel function; re-arms itself for the next day after firing.
function scheduleNotification(supp){
  if(!("Notification" in window)||Notification.permission!=="granted")return()=>{};
  if(!supp.reminderTime)return()=>{};
  let timer=null;
  const arm=()=>{
    const [h,m]=supp.reminderTime.split(":").map(Number);
    const now=new Date();
    const target=new Date();
    target.setHours(h,m,0,0);
    if(target<=now)target.setDate(target.getDate()+1);
    timer=setTimeout(()=>{
      if(Notification.permission==="granted"){
        try{new Notification("💊 Time for your "+supp.name,{body:supp.sub||"Your daily supplement",icon:"/favicon.ico",tag:"supp-"+supp.k,renotify:true});}catch{}
      }
      arm(); // tomorrow, while this tab lives
    },target-now);
  };
  arm();
  return()=>clearTimeout(timer);
}

// ── SUPPS TAB ────────────────────────────────────────────────────
function SuppsTab({suppList,setSuppList,suppTaken,setSuppTaken,taken,total,uid,addSuppToList,onWriteFailed}){
  const T=useTheme();
  const [manageOpen,setManageOpen]=useState(false);
  const [reminderSupp,setReminderSupp]=useState(null);
  const [editItem,setEditItem]=useState(null);
  const [newName,setNewName]=useState("");
  const [newSub,setNewSub]=useState("");
  const [newReminderEnabled,setNewReminderEnabled]=useState(false);
  const [newReminderTime,setNewReminderTime]=useState("08:00");

  // In-app nudges while this tab is open. Cancelled on unmount and re-armed
  // when the stack changes, so timers never accumulate.
  useEffect(()=>{
    if(!("Notification" in window))return;
    const cancels=suppList.filter(s=>s.reminderEnabled&&s.reminderTime).map(scheduleNotification);
    return()=>cancels.forEach(c=>c());
  },[suppList]);

  const morning=suppList.filter(s=>/(morning|breakfast|workout|am\b)/i.test(s.sub||""));
  const evening=suppList.filter(s=>/(evening|dinner|bed|night|pm\b)/i.test(s.sub||""));
  const other=suppList.filter(s=>!morning.includes(s)&&!evening.includes(s));

  const removeSupp=async(k)=>{
    const removed=suppList.find(s=>s.k===k); const idx=suppList.findIndex(s=>s.k===k);
    setSuppList(p=>p.filter(s=>s.k!==k));
    if(!uid)return;
    // sb.delete never throws; it returns false. Restore and say why.
    const ok=await sb.delete("supplement_stack","id=eq."+k+"&user_id=eq."+uid);
    if(!ok){
      setSuppList(p=>{const n=[...p];n.splice(Math.min(idx,n.length),0,removed);return n;});
      onWriteFailed&&onWriteFailed("Couldn't remove "+removed.name+". Check your connection.");
    }
  };

  const saveEdit=async()=>{
    if(!editItem||!newName.trim())return;
    const before=suppList.find(s=>s.k===editItem.k);
    const name=newName.trim(),sub=newSub.trim()||"";
    setSuppList(p=>p.map(s=>s.k===editItem.k?{...s,name,sub}:s));
    setEditItem(null);setNewName("");setNewSub("");
    if(!uid)return;
    const ok=await sb.update("supplement_stack",{name,sub:sub||null},{filter:"id=eq."+editItem.k+"&user_id=eq."+uid});
    if(!ok){
      setSuppList(p=>p.map(s=>s.k===before.k?before:s));
      onWriteFailed&&onWriteFailed("Couldn't save the edit to "+name+". Check your connection.");
    }
  };

  const addCustom=()=>{
    if(!newName.trim())return;
    const item={k:"m"+Date.now(),name:newName,sub:newSub||"",dot:"#888",reminderEnabled:newReminderEnabled,reminderTime:newReminderTime};
    if(addSuppToList){addSuppToList(item);}
    else{setSuppList(p=>[...p,item]);}
    setNewName("");setNewSub("");setNewReminderEnabled(false);setNewReminderTime("08:00");
  };

  const saveReminder=async({reminderEnabled,reminderTime})=>{
    const before=suppList.find(s=>s.k===reminderSupp.k);
    setSuppList(p=>p.map(s=>s.k===reminderSupp.k?{...s,reminderEnabled,reminderTime}:s));
    setReminderSupp(null);
    if(!uid)return;
    const ok=await sb.update("supplement_stack",{reminder_enabled:reminderEnabled,reminder_time:reminderTime},{filter:"id=eq."+before.k+"&user_id=eq."+uid});
    if(!ok){
      setSuppList(p=>p.map(s=>s.k===before.k?before:s));
      onWriteFailed&&onWriteFailed("Couldn't save that time for "+before.name+". Check your connection.");
    }
  };

  const fmtTime=(t)=>{
    if(!t)return"";
    const [h,m]=t.split(":").map(Number);
    const ampm=h>=12?"PM":"AM";
    const h12=h===0?12:h>12?h-12:h;
    return h12+":"+String(m).padStart(2,"0")+" "+ampm;
  };

  const renderGroup=(label,items)=>items.length===0?null:(
    <div key={label}>
      <div style={{padding:"0 16px",margin:"14px 0 8px"}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{label}</div></div>
      <div style={{background:T.card,margin:"0 16px",borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,overflow:"hidden"}}>
        {items.map((s,i)=>(
          <div key={s.k} style={{borderBottom:i<items.length-1?"1px solid "+T.border:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{s.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap"}}>
                    {s.sub&&<div style={{fontSize:11,color:T.subtext}}>{s.sub}</div>}
                    {/* Reminder badge */}
                    <div onClick={()=>setReminderSupp(s)}
                      style={{display:"flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:20,cursor:"pointer",background:s.reminderEnabled?T.accentPill:"transparent",border:("1px solid "+s.reminderEnabled?T.accent:T.border),transition:"all 0.15s"}}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <circle cx="5" cy="5" r="4" stroke={s.reminderEnabled?T.accent:T.muted} strokeWidth="1.2"/>
                        <polyline points="5,3 5,5.5 6.5,5.5" stroke={s.reminderEnabled?T.accent:T.muted} strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      <span style={{fontSize:9,fontWeight:600,color:s.reminderEnabled?T.accent:T.muted}}>
                        {s.reminderEnabled?fmtTime(s.reminderTime):"Set time"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Toggle */}
              <div onClick={()=>setSuppTaken(s.k,!suppTaken[s.k])}
                style={{width:44,height:26,borderRadius:13,background:suppTaken[s.k]?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,marginLeft:10,boxShadow:suppTaken[s.k]?("0 0 8px "+T.accentGlow):"none"}}>
                <div style={{position:"absolute",top:3,left:suppTaken[s.k]?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return(
    <div style={{paddingBottom:80}}>
      {/* Reminder modal */}
      {reminderSupp&&<ReminderModal supp={reminderSupp} onSave={saveReminder} onClose={()=>setReminderSupp(null)}/>}

      {/* Manage modal */}
      {manageOpen&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"88vh",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:17,fontWeight:700,color:T.text}}>Manage supplements</div>
              <div onClick={()=>{setManageOpen(false);setEditItem(null);setNewName("");setNewSub("");}} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div style={{overflowY:"auto",padding:"14px 20px 30px",display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:12,color:T.subtext}}>Daily goal: {total} supplement{total!==1?"s":""} · Tap the clock icon on any supplement to set a reminder.</div>
              <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,overflow:"hidden"}}>
                {suppList.map((s,i)=>(
                  <div key={s.k}
                    draggable
                    onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(i));}}
                    onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";e.currentTarget.style.background=T.accentPill;}}
                    onDragLeave={e=>{e.currentTarget.style.background="transparent";}}
                    onDrop={async e=>{
                      e.preventDefault();e.currentTarget.style.background="transparent";
                      const from=parseInt(e.dataTransfer.getData("text/plain"));
                      if(from===i||isNaN(from))return;
                      // The writes used to live INSIDE the state updater, un-awaited: a
                      // state updater must be pure (StrictMode runs it twice), and a
                      // fire-and-forget write is never observed. Compute the order,
                      // set it, then await every PATCH and roll back on any failure.
                      const before=suppList;
                      const arr=[...before];
                      const [moved]=arr.splice(from,1);
                      arr.splice(i,0,moved);
                      setSuppList(arr);
                      if(!uid)return;
                      const results=await Promise.all(arr.map((s,idx)=>sb.update("supplement_stack",{sort_order:idx},{filter:"id=eq."+s.k+"&user_id=eq."+uid})));
                      if(results.some(ok=>!ok)){
                        setSuppList(before);
                        onWriteFailed&&onWriteFailed("Couldn't save the new order. Check your connection.");
                      }
                    }}
                  >
                    {editItem?.k===s.k?(
                      <div style={{padding:"12px 14px",borderBottom:i<suppList.length-1?"1px solid "+T.border:"none",display:"flex",flexDirection:"column",gap:8}}>
                        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
                        <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Dose / timing" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{setEditItem(null);setNewName("");setNewSub("");}} style={{flex:1,background:T.card,border:("1px solid "+T.border),borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",color:T.text}}>Cancel</button>
                          <button onClick={saveEdit} style={{flex:1,background:T.accent,border:"none",borderRadius:8,padding:"8px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Save</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:i<suppList.length-1?"1px solid "+T.border:"none",cursor:"grab",userSelect:"none"}}>
                        {/* Drag handle */}
                        <div style={{display:"flex",flexDirection:"column",gap:2.5,flexShrink:0,opacity:0.35,cursor:"grab",padding:"2px 4px"}}>
                          {[0,1,2].map(j=><div key={j} style={{width:14,height:1.5,background:T.muted,borderRadius:1}}/>)}
                        </div>
                        <div style={{width:9,height:9,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500,color:T.text}}>{s.name}</div>
                          {s.sub&&<div style={{fontSize:11,color:T.subtext,marginTop:1}}>{s.sub}</div>}
                          {s.reminderEnabled&&<div style={{fontSize:10,color:T.accent,marginTop:2}}>🔔 {fmtTime(s.reminderTime)}</div>}
                        </div>
                        <div onClick={()=>{setEditItem(s);setNewName(s.name);setNewSub(s.sub||"");}} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9l1.5-1.5 5-5L10 4 4.5 9.5 2 10l.5-1.5zM7.5 2.5l2 2" stroke={T.accent} strokeWidth="1.3" strokeLinecap="round"/></svg>
                        </div>
                        <div onClick={()=>removeSupp(s.k)} style={{width:28,height:28,borderRadius:"50%",background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>Add supplement</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name (e.g. Ashwagandha)" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>
                <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Dose / timing (e.g. 600mg · Morning)" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>

                {/* Optional reminder row */}
                <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:T.text}}>Set reminder <span style={{fontSize:11,color:T.muted,fontWeight:400}}>(optional)</span></div>
                      <div style={{fontSize:11,color:T.subtext,marginTop:2}}>Get notified when it's time to take this</div>
                    </div>
                    <div onClick={()=>setNewReminderEnabled(e=>!e)} style={{width:42,height:24,borderRadius:12,background:newReminderEnabled?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,boxShadow:newReminderEnabled?("0 0 8px "+T.accentGlow):"none"}}>
                      <div style={{position:"absolute",top:2.5,left:newReminderEnabled?19:2.5,width:19,height:19,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.25)"}}/>
                    </div>
                  </div>

                  {/* Time picker — only shown when toggle is on */}
                  {newReminderEnabled&&(
                    <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{background:T.card,border:("1px solid "+T.accent),borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{fontSize:20,fontWeight:800,color:T.accent,letterSpacing:"-0.5px"}}>
                          {(()=>{const[h,m]=newReminderTime.split(":").map(Number);const ap=h>=12?"PM":"AM";const h12=h===0?12:h>12?h-12:h;return h12+":"+String(m).padStart(2,"0")+" "+ap;})()}
                        </div>
                        <input type="time" value={newReminderTime} onChange={e=>setNewReminderTime(e.target.value)}
                          style={{background:"transparent",color:T.subtext,border:"none",fontSize:12,outline:"none",cursor:"pointer"}}/>
                      </div>
                      {/* Quick presets */}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[["Morning","07:00"],["Breakfast","08:00"],["Midday","12:00"],["Pre-workout","17:00"],["Dinner","18:00"],["Bedtime","21:00"]].map(([label,t])=>(
                          <div key={t} onClick={()=>setNewReminderTime(t)}
                            style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:("1px solid "+newReminderTime===t?T.accent:T.border),background:newReminderTime===t?T.accentPill:"transparent",color:newReminderTime===t?T.accent:T.subtext,transition:"all 0.15s"}}>
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={addCustom} disabled={!newName.trim()} style={{background:!newName.trim()?T.muted:T.accent,border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:600,cursor:newName.trim()?"pointer":"not-allowed",transition:"background 0.2s"}}>
                  {newReminderEnabled?"Add to stack with reminder 🔔":"Add to daily stack"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:T.text}}>Supplements</div>
          <div style={{fontSize:13,color:T.subtext}}>Daily tracker</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {/* Bell icon showing active reminders count */}
          {suppList.filter(s=>s.reminderEnabled).length>0&&(
            <div style={{background:T.accentPill,border:("1px solid "+T.accent),borderRadius:20,padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1a3.5 3.5 0 0 1 3.5 3.5c0 2 .7 3 1 3.5H1c.3-.5 1-1.5 1-3.5A3.5 3.5 0 0 1 5.5 1z" stroke={T.accent} strokeWidth="1.2"/>
                <path d="M4.5 9.5a1 1 0 0 0 2 0" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:10,fontWeight:700,color:T.accent}}>{suppList.filter(s=>s.reminderEnabled).length} active</span>
            </div>
          )}
          <div onClick={()=>setManageOpen(true)} style={{width:34,height:34,borderRadius:10,background:T.inputBg,border:("1px solid "+T.border),boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.text} strokeWidth="1.4"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:10,padding:"14px 16px 0",marginBottom:4}}>
        <div style={{flex:1,background:T.greenBg,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:700,color:T.green}}>{taken}/{total}</div>
          <div style={{fontSize:11,color:T.green,marginTop:2}}>taken today</div>
        </div>
        <div style={{flex:1,background:"rgba(249,115,22,0.1)",borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:700,color:"#F97316"}}>{total-taken}</div>
          <div style={{fontSize:11,color:"#F97316",marginTop:2}}>remaining</div>
        </div>
        {suppList.filter(s=>s.reminderEnabled).length>0&&(
          <div style={{flex:1,background:T.accentPill,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:700,color:T.accent}}>{suppList.filter(s=>s.reminderEnabled).length}</div>
            <div style={{fontSize:11,color:T.accent,marginTop:2}}>reminders</div>
          </div>
        )}
      </div>

      {/* Groups */}
      {renderGroup("Morning",morning)}
      {renderGroup("Evening",evening)}
      {renderGroup("All day",other)}

      {/* Add shortcut */}
      <div style={{padding:"14px 16px 0"}}>
        <div onClick={()=>setManageOpen(true)} style={{border:("1.5px dashed "+T.border),borderRadius:13,padding:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.muted} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{fontSize:13,color:T.muted,fontWeight:500}}>Add or manage supplements</div>
        </div>
      </div>
    </div>
  );
}


function CalendarTab({uid,goals,suppList,userName,log,suppTaken,workoutHistory,waterOz=0}){
  const T=useTheme();
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAY_NAMES=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const WEEK_LABELS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const todayObj=new Date();
  const todayStr=localDate(todayObj);
  const [view,setView]=useState("month");
  const [month,setMonth]=useState(todayObj.getMonth());
  const [year,setYear]=useState(todayObj.getFullYear());
  const [selDate,setSelDate]=useState(todayStr);
  const [calData,setCalData]=useState({});
  const [loading,setLoading]=useState(false);
  const [chartView,setChartView]=useState("week");

  // Local YYYY-MM-DD for a calendar cell (m is 0-based, as from getMonth)
  const fmt=(y,m,d)=>localDate(new Date(y,m,d));

  // Compute today's live entry from in-memory App state (always up-to-date)
  const liveTodayEntry=()=>{
    const stackSize=suppList?.length||0;
    const takenCount=(suppList||[]).filter(s=>suppTaken?.[s.k]).length;
    const todayCal=log?Object.values(log).flat().reduce((sum,item)=>{
      const g=item.grams||0;
      return sum+Math.round(((item.per100?.cal||0)*g)/100);
    },0):0;
    const todayWorkout=workoutHistory?.find(w=>w.date===todayStr);
    return{
      cal:todayCal,
      food:todayCal>0,
      workout:!!todayWorkout,
      workoutName:todayWorkout?.workoutName||"",
      suppTaken:takenCount,
      suppTotal:stackSize,
      waterOz:waterOz,
    };
  };

  // Seed demo mode from the hardcoded dayData constant
  useEffect(()=>{
    if(!uid){
      const demo={};
      Object.entries(dayData).forEach(([d,v])=>{
        const ds=fmt(2026,3,Number(d));
        demo[ds]={cal:v.cal,food:!!v.food,workout:!!v.workout,suppTaken:v.supp?(suppList?.length||1):0,suppTotal:suppList?.length||1,workoutName:v.workout?"Workout":""};
      });
      setCalData(demo);
      return;
    }
    fetchMonthData();
  },[uid,month,year]);

  // Always keep today's cell in sync with live App state
  useEffect(()=>{
    setCalData(prev=>({...prev,[todayStr]:liveTodayEntry()}));
  },[log,suppTaken,suppList,workoutHistory]);

  const [loadError,setLoadError]=useState(false);
  const fetchMonthData=async()=>{
    if(!uid)return;
    setLoading(true);
    const firstDay=fmt(year,month,1);
    const lastDay=fmt(year,month,new Date(year,month+1,0).getDate());
    try{
      const [fr,wr,sr]=await Promise.all([
        sb.selectAuth("food_log","user_id=eq."+uid+"&logged_date=gte."+firstDay+"&logged_date=lte."+lastDay,{limit:2000}),
        sb.selectAuth("workout_sessions","user_id=eq."+uid+"&completed_date=gte."+firstDay+"&completed_date=lte."+lastDay,{limit:200}),
        sb.selectAuth("supplement_log","user_id=eq."+uid+"&log_date=gte."+firstDay+"&log_date=lte."+lastDay+"&taken=eq.true",{limit:1000}),
      ]);
      // A failed month must not render as an empty month.
      if(!fr.ok||!wr.ok||!sr.ok){setLoadError(true);setLoading(false);return;}
      setLoadError(false);
      const foodRows=fr.rows,workoutRows=wr.rows,suppLogRows=sr.rows;
      const data={};
      const stackSize=suppList?.length||0;
      const ensure=ds=>{if(!data[ds])data[ds]={cal:0,food:false,workout:false,suppTaken:0,suppTotal:stackSize,workoutName:""};};
      (foodRows||[]).forEach(r=>{
        ensure(r.logged_date);
        data[r.logged_date].cal+=Math.round((r.per100_cal*r.grams)/100);
      });
      Object.keys(data).forEach(ds=>{if(data[ds].cal>0)data[ds].food=true;});
      (workoutRows||[]).forEach(r=>{
        ensure(r.completed_date);
        data[r.completed_date].workout=true;
        data[r.completed_date].workoutName=r.workout_name||"";
      });
      (suppLogRows||[]).forEach(r=>{
        ensure(r.log_date);
        data[r.log_date].suppTaken++;
      });
      setCalData(data);
    }catch(e){console.error("CalendarTab fetch:",e);}
    setLoading(false);
  };

  const dim=new Date(year,month+1,0).getDate();
  const fdow=new Date(year,month,1).getDay();
  const calGoal=goals?.cal||2200;

  // Return Mon–Sun dates for the week containing selDate
  const getWeekDates=()=>{
    const d=new Date(selDate+"T00:00:00");
    const dow=d.getDay();
    const diff=dow===0?-6:1-dow;
    const mon=new Date(d);mon.setDate(d.getDate()+diff);
    return Array.from({length:7},(_,i)=>{const dd=new Date(mon);dd.setDate(mon.getDate()+i);return localDate(dd);});
  };
  const weekDates=getWeekDates();

  const isFuture=ds=>ds>todayStr;

  // Compute status flags for a given date string
  const dayStatus=ds=>{
    const d=calData[ds];
    if(!d)return{allDone:false,missed:[],suppDone:false};
    const suppDone=d.suppTotal>0?d.suppTaken>=d.suppTotal:false;
    const calMet=d.cal>0&&Math.abs(d.cal-calGoal)<=100;
    const waterDone=(d.waterOz||0)>=GOAL_OZ*0.75;
    const allDone=d.food&&d.workout&&suppDone&&calMet&&waterDone;
    const missed=[!d.food,!d.workout,!suppDone,!calMet,!waterDone].filter(Boolean);
    return{allDone,missed,suppDone,calMet,waterDone};
  };

  // Chart arrays — future days show as 0 but styled differently
  const monthChart=Array.from({length:dim},(_,i)=>{
    const ds=fmt(year,month,i+1);
    return{val:calData[ds]?.cal||0,future:ds>todayStr,ds,label:String(i+1)};
  });
  const weekChart=weekDates.map((ds,i)=>({val:calData[ds]?.cal||0,future:ds>todayStr,ds,label:WEEK_LABELS[i]}));
  const chartItems=chartView==="week"?weekChart:monthChart;
  const chartVals=chartItems.map(c=>c.val);
  const hasAnyData=chartVals.some(v=>v>0);
  const maxB=Math.max(...chartVals.filter(v=>v>0),calGoal);

  // Summary stats (for the visible month)
  const monthEntries=Object.entries(calData).filter(([ds])=>ds.startsWith(year+"-"+String(month+1).padStart(2,"0")));
  const loggedDays=monthEntries.filter(([,d])=>d.food).length;
  const goalMetDays=monthEntries.filter(([,d])=>d.cal>=calGoal*0.9&&d.cal>0).length;
  const workoutDays=monthEntries.filter(([,d])=>d.workout).length;
  const avgCal=loggedDays>0?Math.round(monthEntries.filter(([,d])=>d.food).reduce((a,[,d])=>a+d.cal,0)/loggedDays):0;

  // Selected day data
  const selDD=calData[selDate];
  const selStatus=dayStatus(selDate);
  const selDObj=new Date(selDate+"T00:00:00");
  const initials=userName?userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";

  return(
    <div style={{paddingBottom:80}}>
      {/* Header */}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:600}}>Calendar</div><div style={{fontSize:13,color:T.muted}}>{MONTHS[month]} {year}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {loading&&<div style={{width:16,height:16,border:("2px solid "+T.border),borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
          <div style={{width:36,height:36,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:600}}>{initials}</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:8,padding:"14px 16px 0"}}>
        {["month","week"].map(v=>(
          <div key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+view===v?T.accent:T.border),boxShadow:view===v?T.glowShadow:"none",background:view===v?T.accent:T.card,color:view===v?"#fff":T.muted,textTransform:"capitalize"}}>{v}</div>
        ))}
      </div>

      {loadError&&(
        <div data-testid="calendar-failed" style={{margin:"12px 16px 0",padding:"10px 14px",borderRadius:12,background:T.accentPill,border:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{fontSize:12,color:T.text}}>Couldn't load this month.</div>
          <div onClick={fetchMonthData} style={{fontSize:12,fontWeight:700,color:T.accent,cursor:"pointer"}}>Retry</div>
        </div>
      )}
      {/* Month nav */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px 10px"}}>
        <div onClick={()=>{let m=month-1,y=year;if(m<0){m=11;y--;}setMonth(m);setYear(y);}} style={{width:32,height:32,borderRadius:"50%",background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="14" height="14" viewBox="0 0 14 14"><polyline points="9,2 4,7 9,12" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
        <div style={{fontSize:16,fontWeight:600}}>{MONTHS[month]} {year}</div>
        <div onClick={()=>{let m=month+1,y=year;if(m>11){m=0;y++;}setMonth(m);setYear(y);}} style={{width:32,height:32,borderRadius:"50%",background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="14" height="14" viewBox="0 0 14 14"><polyline points="5,2 10,7 5,12" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
      </div>

      {/* Month grid */}
      {view==="month"&&(
        <div style={{padding:"0 16px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:T.muted,fontWeight:500,padding:"4px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {Array.from({length:fdow},(_,i)=><div key={"e"+i}/>)}
            {Array.from({length:dim},(_,i)=>{
              const d=i+1,ds=fmt(year,month,d);
              const fut=isFuture(ds),tod=ds===todayStr,isSel=ds===selDate;
              const{allDone,missed}=dayStatus(ds);
              const hasData=!!calData[ds];
              return(
                <div key={d} onClick={()=>{if(!fut)setSelDate(ds);}} style={{borderRadius:10,padding:"4px 2px",textAlign:"center",cursor:"pointer",background:isSel?T.accent:T.card,border:tod?"2px solid "+T.accent:("1px solid "+T.border),minHeight:52,display:"flex",flexDirection:"column",alignItems:"center",gap:2,opacity:fut?0.35:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:isSel?"#fff":tod?T.accent:T.text,paddingTop:4}}>{d}</div>
                  <div style={{height:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {!fut&&allDone?(
                      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill={isSel?"rgba(255,255,255,0.9)":T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke={isSel?T.accent:"white"} strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                    ):!fut&&hasData&&missed.length>0?(
                      <div style={{display:"flex",gap:2}}>
                        {missed.map((_,mi)=><div key={mi} style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.5)":"#C8C7C2"}}/>)}
                      </div>
                    ):null}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:10}}>
            {[["#2ECC8F","Food logged"],["#5B8DEF","Workout"],["#F5A623","Supplements"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:c}}/><div style={{fontSize:12,color:T.muted}}>{l}</div></div>
            ))}
          </div>
        </div>
      )}

      {/* Week strip — Mon–Sun of the week containing selDate */}
      {view==="week"&&(
        <div style={{padding:"0 16px",marginBottom:12}}>
          <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:14}}>
            <div style={{display:"flex",gap:6}}>
              {weekDates.map((ds,i)=>{
                const isActive=ds===selDate,fut=isFuture(ds);
                const{allDone,missed}=dayStatus(ds);
                const hasData=!!calData[ds];
                const dayNum=new Date(ds+"T00:00:00").getDate();
                return(
                  <div key={i} onClick={()=>{if(!fut)setSelDate(ds);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",padding:"6px 2px",borderRadius:10,background:isActive?T.accent:"transparent",opacity:fut?0.4:1}}>
                    <div style={{fontSize:11,color:isActive?"rgba(255,255,255,0.6)":T.muted,fontWeight:500}}>{WEEK_LABELS[i]}</div>
                    <div style={{fontSize:13,fontWeight:600,color:isActive?"#fff":T.text}}>{dayNum}</div>
                    <div style={{height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {!fut&&allDone?(
                        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill={T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                      ):!fut&&hasData&&missed.length>0?(
                        <div style={{display:"flex",gap:2}}>
                          {missed.map((_,mi)=><div key={mi} style={{width:4,height:4,borderRadius:"50%",background:isActive?"rgba(255,255,255,0.4)":"#C8C7C2"}}/>)}
                        </div>
                      ):null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selected day detail */}
      <div style={{background:T.card,margin:"0 16px 14px",borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:16}}>
        <div style={{fontSize:13,color:T.muted,marginBottom:12}}>{DAY_NAMES[selDObj.getDay()]}, {MONTHS[selDObj.getMonth()]} {selDObj.getDate()}</div>
        {[
          ["🍽","Food log",selDD?.food?(selDD.cal.toLocaleString()+" cal logged"):"Not logged",selDD?.food],
          ["💪","Workout",selDD?.workout?(selDD.workoutName||"Completed"):"Not done",selDD?.workout],
          ["💊","Supplements",selDD?.suppTotal>0?(selDD.suppTaken+"/"+selDD.suppTotal+" taken"):"None tracked",selStatus.suppDone],
          ["💧","Water",selDD?.waterOz>0?(selDD.waterOz+" / "+GOAL_OZ+" oz"):"Not logged",selStatus.waterDone],
          ["🎯","Calorie goal",selDD?.cal?(selDD.cal>=calGoal*0.9?"Goal met ✓":Math.round((selDD.cal/calGoal)*100)+"% of goal"):"—",selStatus.calMet],
        ].map(([icon,label,val,chk],i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<3?"1px solid "+T.border:"none"}}>
            <div style={{width:28,height:28,borderRadius:8,background:T.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{icon}</div>
            <div style={{flex:1,fontSize:14}}>{label}</div>
            <div style={{fontSize:13,color:T.muted}}>{val}</div>
            <div style={{width:22,height:22,borderRadius:"50%",background:chk?T.accent:T.surface,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CheckIcon done={chk}/></div>
          </div>
        ))}
      </div>

      {/* Calorie chart */}
      <div style={{padding:"0 16px",marginBottom:14}}>
        <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:16}}>
          {/* Header row with toggle */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:600}}>Calorie history</div>
            <div style={{display:"flex",gap:4,background:T.surface,borderRadius:8,padding:3}}>
              {["week","month"].map(cv=>(
                <div key={cv} onClick={()=>setChartView(cv)}
                  style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",
                    background:chartView===cv?T.accent:"transparent",
                    color:chartView===cv?"#fff":T.muted,
                    transition:"all 0.15s",textTransform:"capitalize"}}>
                  {cv==="week"?"This week":"Monthly"}
                </div>
              ))}
            </div>
          </div>

          {hasAnyData?(
            <div style={{display:"flex",alignItems:"flex-end",gap:chartView==="week"?8:3,height:90}}>
              {chartItems.map(({val,future,label},i)=>{
                const onTarget=!future&&val>0&&Math.abs(val-calGoal)<=100;
                const color=future||val===0?T.barEmpty:onTarget?"#22C55E":val>calGoal+100?"#FF6B4A":val>calGoal*0.85?"#5B8DEF":"#FF6B4A";
                const borderColor=future||val===0?"transparent":onTarget?"rgba(34,197,94,0.6)":val>calGoal*0.85?"rgba(91,141,239,0.5)":"rgba(255,107,74,0.45)";
                const glowColor=onTarget?"rgba(34,197,94,0.25)":val>calGoal*0.85?"rgba(91,141,239,0.18)":"rgba(255,107,74,0.18)";
                const pct=val&&!future?Math.max(Math.round((val/maxB)*100),6):0;
                return(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{width:"100%",height:72,display:"flex",alignItems:"flex-end",position:"relative"}}>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"100%",background:future?T.surface:T.accentPill,borderRadius:6,opacity:future?0.2:1}}/>
                      {pct>0&&(
                        <div style={{
                          position:"absolute",bottom:0,left:0,right:0,
                          height:(pct+"%"),
                          background:("linear-gradient(to top,"+color+","+color+"cc)"),
                          borderRadius:6,
                          border:("1px solid "+borderColor),
                          boxShadow:val>0&&!future?"0 0 6px "+glowColor+",inset 0 1px 0 rgba(255,255,255,0.18)":"none",
                        }}/>
                      )}
                    </div>
                    <div style={{fontSize:chartView==="week"?10:8,color:T.muted,textAlign:"center",lineHeight:1}}>{label}</div>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:13,color:T.muted}}>No data logged this {chartView==="week"?"week":"month"} yet</div>
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
            <div style={{fontSize:12,color:T.muted}}>Goal: {calGoal.toLocaleString()}/day</div>
            <div style={{fontSize:12,color:T.accent,fontWeight:500}}>
              {chartView==="week"?(()=>{
                const wLogged=weekChart.filter(c=>c.val>0);
                const wAvg=wLogged.length>0?Math.round(wLogged.reduce((a,c)=>a+c.val,0)/wLogged.length):0;
                return wAvg?"Week avg: "+wAvg.toLocaleString()+" cal":"Log food to see avg";
              })():avgCal?"Month avg: "+avgCal.toLocaleString()+" cal":"Log food to see avg"}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly summary */}
      <div style={{padding:"0 16px",marginBottom:10}}><div style={{fontSize:15,fontWeight:600}}>Monthly summary</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,padding:"0 16px",marginBottom:14}}>
        {[
          [loggedDays||"0","Days logged",T.text],
          [goalMetDays||"0","Goals met",T.green],
          [avgCal?avgCal.toLocaleString():"—","Avg cal/day",T.text],
          [workoutDays||"0","Workouts done",T.macro[1]],
        ].map(([v,l,c])=>(
          <div key={l} style={{background:T.card,borderRadius:12,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:14}}>
            <div style={{fontSize:20,fontWeight:600,color:c}}>{v}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:3}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── SUPABASE CLIENT ──────────────────────────────────────────────
const SUPABASE_URL="https://vghqqksbjpgdzmvfmnru.supabase.co";
const SUPABASE_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaHFxa3NianBnZHptdmZtbnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjAwNzgsImV4cCI6MjA5MzMzNjA3OH0.1JXmsIs9Jk87wd9uTIpNp93gnoqNMtOR78XiDQHUasg";


// Food-log identity. Every entry path gives a new item a local id (Date.now()
// or Date.now()+Math.random()); the database gives it a uuid on insert. Until
// 2026-09-07 the uuid was never written back, so deleting an item logged in
// the same session sent id=eq.1788763… at a uuid column — a 400 swallowed by
// an unreachable catch, the UI removed the item, and the row came back on
// reload. These helpers are exported so that contract is tested.
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const hasDbId=(item)=>typeof item?.id==="string"&&UUID_RE.test(item.id);
// Replace the local item with one carrying the database id, by reference.
export const withDbId=(items,item,row)=>items.map(i=>i===item?{...i,id:row.id}:i);

export const foodDeleteFilter=(item,uid)=>hasDbId(item)&&uid?"id=eq."+item.id+"&user_id=eq."+uid:null;

export const sb={
  _url:SUPABASE_URL,_key:SUPABASE_ANON,_session:null,
  headers(extra={}){
    return{"Content-Type":"application/json","apikey":this._key,"Authorization":"Bearer "+(this._session?.access_token||this._key),...extra};
  },
  // Single chokepoint for every /rest/v1 call, so mid-session token expiry is
  // handled in one place instead of six. Before this, an access_token that died
  // while the app sat open (a workout runs well past the token's life) made every
  // subsequent write 401 until the user reloaded — the write was rejected and the
  // session was lost.
  //
  // 401 is the ONLY status retried. A 403 is an RLS denial, which refreshing
  // cannot fix, and a 409/400 is a real request problem.
  //
  // The body is deliberately not read here: a Response body can be read only
  // once, and every caller reads it itself. On a failed refresh the original 401
  // Response is handed back untouched, so each method's failure contract
  // (select -> [], insert/upsert -> null, delete/update -> false) is unchanged.
  //
  // Retries exactly once — this never calls itself, so no loop is possible.
  async _fetch(path,init={},extra={}){
    const sent=this._session?.access_token||null;
    const r=await fetch(this._url+path,{...init,headers:this.headers(extra)});
    if(r.status!==401)return r;
    if(!(await reauth(sent)))return r;
    console.warn("[sb] access_token expired mid-session — refreshed, retrying",path.split("?")[0]);
    return fetch(this._url+path,{...init,headers:this.headers(extra)});
  },
  async signUp(email,password){
    const r=await fetch(this._url+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json","apikey":this._key},body:JSON.stringify({email,password})});
    return r.json();
  },
  async signIn(email,password){
    const r=await fetch(this._url+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json","apikey":this._key},body:JSON.stringify({email,password})});
    const d=await r.json();
    if(d.access_token){this._session=d;localStorage.setItem("sb_session",JSON.stringify(d));}
    return d;
  },
  async signOut(){
    await fetch(this._url+"/auth/v1/logout",{method:"POST",headers:this.headers()});
    this._session=null;localStorage.removeItem("sb_session");
  },
  getUser(){return this._session?.user||null;},
  async select(table,filters="",opts={}){
    const q=[filters,opts.order?"order="+opts.order:"",opts.limit?"limit="+opts.limit:""].filter(Boolean).join("&");
    const r=await this._fetch("/rest/v1/"+table+"?"+q);
    if(!r.ok){console.error("[sb.select]",table,r.status,await r.text().catch(()=>""));return[];}
    return r.json();
  },
  // Auth-critical sibling of select(). Same request construction, different
  // response handling: select() collapses every non-2xx into [], which makes a
  // 401 indistinguishable from "no rows" — the mount profile check then reads an
  // expired session as a brand-new user and routes to onboarding.
  // Never throws; rows is always an array. authError is set ONLY by 401/403, so a
  // 500 or a network blip cannot sign anyone out.
  async selectAuth(table,filters="",opts={}){
    try{
      const q=[filters,opts.order?"order="+opts.order:"",opts.limit?"limit="+opts.limit:""].filter(Boolean).join("&");
      const r=await this._fetch("/rest/v1/"+table+"?"+q);
      if(!r.ok){
        console.error("[sb.selectAuth]",table,r.status,await r.text().catch(()=>""));
        // ok:false on ANY non-2xx. authError alone let a 500 or a network
        // failure come back as {authError:false, rows:[]} — the same shape as
        // "succeeded, no rows". Readers that must not launder check ok.
        return{ok:false,authError:r.status===401||r.status===403,status:r.status,rows:[]};
      }
      const d=await r.json();
      return{ok:true,authError:false,status:r.status,rows:Array.isArray(d)?d:[]};
    }catch(e){
      console.error("[sb.selectAuth]",table,"network",e);
      return{ok:false,authError:false,status:0,rows:[]};
    }
  },
  async insert(table,row){
    const r=await this._fetch("/rest/v1/"+table,{method:"POST",body:JSON.stringify(Array.isArray(row)?row:[row])},{"Prefer":"return=representation"});
    if(!r.ok){console.error("[sb.insert]",table,r.status,await r.text().catch(()=>""));return null;}
    const d=await r.json();return Array.isArray(row)?d:d[0];
  },
  // resolution=merge-duplicates alone is not enough: PostgREST infers the
  // ON CONFLICT target from the PRIMARY KEY unless on_conflict says otherwise.
  // Tables with a surrogate id PK plus a separate composite UNIQUE (water_log,
  // supplement_log, body_weight_log) therefore fall through to a plain INSERT
  // and 409 on the second same-day write. Pass onConflict with the exact
  // columns of the UNIQUE constraint — order does not matter, membership does.
  // Callers that upsert on the PK itself (profiles.id) can omit it.
  async upsert(table,row,{onConflict=""}={}){
    const q=onConflict?"?on_conflict="+onConflict.split(",").map(c=>encodeURIComponent(c.trim())).join(","):"";
    const r=await this._fetch("/rest/v1/"+table+q,{method:"POST",body:JSON.stringify(Array.isArray(row)?row:[row])},{"Prefer":"resolution=merge-duplicates,return=representation"});
    if(!r.ok){console.error("[sb.upsert]",table,r.status,await r.text().catch(()=>""));return null;}
    const d=await r.json();return Array.isArray(row)?d:d[0];
  },
  // delete and update log like the other four: "[sb.<method>] <table> <status>"
  // is the grep the browser-side verification depends on, and without it a
  // genuine failure here left no trace anywhere. Return contract is unchanged —
  // still the boolean r.ok was returning.
  async delete(table,filter){
    const r=await this._fetch("/rest/v1/"+table+"?"+filter,{method:"DELETE"});
    if(!r.ok){console.error("[sb.delete]",table,r.status,await r.text().catch(()=>""));return false;}
    return true;
  },
  async update(table,changes,{filter=""}={}){
    const r=await this._fetch("/rest/v1/"+table+"?"+filter,{method:"PATCH",body:JSON.stringify(changes)},{"Prefer":"return=representation"});
    if(!r.ok){console.error("[sb.update]",table,r.status,await r.text().catch(()=>""));return false;}
    return true;
  },
};

// Headers for /api/coach. The token is read at call time, not captured, so a
// just-refreshed access_token is used rather than a stale one. If there is no
// session the request still goes out and the server answers 401 — the client
// never decides for itself whether a token is valid.
function coachHeaders(){
  const t=sb._session?.access_token;
  return t?{"Content-Type":"application/json","Authorization":"Bearer "+t}
          :{"Content-Type":"application/json"};
}

// One place to turn a coach failure into something honest. 429 prefers the
// server's message because it carries the actual retry time.
function coachErrorText(e,fallback){
  if(e?.status===401)return "Your session expired. Sign out and sign back in to keep using the coach.";
  if(e?.status===429)return e.userMessage||"You've reached the coach's usage limit. Try again later.";
  return fallback;
}

// Treat a token expiring within this window as needing refresh (clock skew buffer).
const REFRESH_SKEW_MS=60*1000;

function persistSession(d){
  // Refresh-grant responses may omit expires_at; derive it from expires_in.
  if(d&&d.access_token&&!d.expires_at&&d.expires_in){
    d.expires_at=Math.floor(Date.now()/1000)+d.expires_in;
  }
  sb._session=d;
  try{localStorage.setItem("sb_session",JSON.stringify(d));}catch{}
}

function clearSession(){
  sb._session=null;
  try{localStorage.removeItem("sb_session");}catch{}
}

// Coalesce concurrent refreshes (StrictMode double-mount, component remount) onto
// ONE network call so the single-use refresh_token is rotated exactly once.
let _refreshInFlight=null;
export async function refreshSession(refresh_token){
  if(_refreshInFlight)return _refreshInFlight;
  _refreshInFlight=(async()=>{
    try{
      const r=await fetch(sb._url+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"Content-Type":"application/json","apikey":sb._key},body:JSON.stringify({refresh_token})});
      if(!r.ok)return null;
      const d=await r.json();
      return d.access_token?d:null;
    }catch{return null;}
    finally{_refreshInFlight=null;}
  })();
  return _refreshInFlight;
}

// sb is a module-level object; authState is React state. A refresh that fails
// deep inside a write has no way to route on its own, so App registers one
// handler at mount. Routing target is "auth" and never "onboarding" — see the
// routing rule in PROJECT_CONTEXT: onboarding as a fallback overwrites a real
// profile.
let _onAuthLost=null;
export function setAuthLostHandler(fn){_onAuthLost=fn;}
function authLost(){
  clearSession();
  if(_onAuthLost)_onAuthLost();
}

// Recover from a 401 on a data request. Returns true if the caller should retry.
//
// `sent` is the access_token the failed request actually used. The in-flight
// guard inside refreshSession only coalesces requests that overlap in time;
// finishing a workout fires several writes that 401 in sequence, microseconds
// apart. Without this comparison the second one would redeem a refresh_token the
// first had already rotated — Supabase rejects the reused single-use token, and
// the user is signed out mid-workout, which is worse than the bug being fixed.
//
// So: if the live session already carries a different access_token, someone else
// refreshed while this request was in flight. Retry on theirs, do not refresh.
async function reauth(sent){
  const cur=sb._session?.access_token||null;
  if(cur&&cur!==sent)return true;
  const rt=sb._session?.refresh_token;
  if(!rt){authLost();return false;}
  const fresh=await refreshSession(rt);
  if(!fresh){authLost();return false;}
  // Refresh responses may omit the user; loadUserData and getUser need it.
  if(!fresh.user&&sb._session?.user)fresh.user=sb._session.user;
  persistSession(fresh);
  return true;
}

// Single auth-resolution gate: turn the stored session into a definite state
// BEFORE any data load runs. Refreshes at most once. Returns
// {status:"valid"|"refreshed"|"logged-out", session?}.
export async function resolveSession(){
  let s;
  try{s=JSON.parse(localStorage.getItem("sb_session")||"null");}catch{s=null;}
  if(!s?.access_token)return{status:"logged-out"};
  const expMs=(s.expires_at||0)*1000;
  const needsRefresh=!s.expires_at||((expMs-Date.now())<REFRESH_SKEW_MS);
  if(!needsRefresh){sb._session=s;return{status:"valid",session:s};}
  // Expired/expiring: attempt a single refresh with the rotated refresh_token.
  if(!s.refresh_token){clearSession();return{status:"logged-out"};}
  const fresh=await refreshSession(s.refresh_token);
  if(!fresh){clearSession();return{status:"logged-out"};}
  // Carry the user forward if the refresh response omits it (loadUserData/getUser need it).
  if(!fresh.user&&s.user)fresh.user=s.user;
  persistSession(fresh);
  return{status:"refreshed",session:fresh};
}

// ── AUTH SCREEN ───────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const T=useTheme();
  const [isLogin,setIsLogin]=useState(true);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const submit=async()=>{
    setError("");
    if(!email.trim()||!password.trim()){setError("Please fill in all fields.");return;}
    if(!isLogin&&password!==confirm){setError("Passwords don't match.");return;}
    if(password.length<6){setError("Password must be at least 6 characters.");return;}
    setLoading(true);
    try{
      if(isLogin){
        const d=await sb.signIn(email.trim(),password);
        console.log("SignIn response:",JSON.stringify(d));
        if(d.error||d.error_description||d.msg){
          const msg=d.error_description||d.msg||d.error||"Login failed";
          if(msg.toLowerCase().includes("confirm")||msg.toLowerCase().includes("email")){
            setError("Please check your email and click the confirmation link first, then try logging in.");
          } else if(msg.toLowerCase().includes("invalid")||msg.toLowerCase().includes("credentials")){
            setError("Incorrect email or password. Please try again.");
          } else {
            setError(msg);
          }
          setLoading(false);return;
        }
        if(!d.access_token){setError("Login failed — no session returned. Check console for details.");setLoading(false);return;}
        onAuth(d.user,false);
      }else{
        const d=await sb.signUp(email.trim(),password);
        console.log("SignUp response:",JSON.stringify(d));
        if(d.error||d.error_description){setError(d.error_description||d.error||"Signup failed.");setLoading(false);return;}
        // Try signing in immediately (works if email confirmation is disabled)
        const d2=await sb.signIn(email.trim(),password);
        console.log("Post-signup SignIn response:",JSON.stringify(d2));
        if(d2.access_token){
          onAuth(d2.user,true);
        } else {
          setError("Account created! Check your email for a confirmation link, then come back and log in.");
        }
      }
    }catch(e){
      console.error("Auth error:",e);
      setError("Network error — check your connection and try again.");
    }
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",background:T.appBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",fontFamily:"-apple-system,sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-80,right:-60,width:260,height:260,borderRadius:"50%",background:T.accentGlow,filter:"blur(60px)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-60,left:-60,width:200,height:200,borderRadius:"50%",background:(T.accentSoft+"22"),filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:("0 8px 28px "+T.accentGlow)}}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M6 16L11 21L26 9"/><circle cx="16" cy="16" r="13"/></svg>
        </div>
        <div style={{fontSize:28,fontWeight:800,color:T.text,letterSpacing:"-1px"}}>WiFit</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>Your personal fitness companion</div>
      </div>

      {/* Demo mode button */}
      <div style={{width:"100%",maxWidth:400,marginBottom:16}}>
        <button onClick={()=>onAuth({id:"demo",email:"demo@fittrack.app"},true)}
          style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 20px "+T.accentGlow)}}>
          🚀 Try Demo Mode (no account needed)
        </button>
      </div>

      <div style={{width:"100%",maxWidth:400,display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{flex:1,height:1,background:T.border}}/>
        <div style={{fontSize:12,color:T.muted}}>or sign in with account</div>
        <div style={{flex:1,height:1,background:T.border}}/>
      </div>

      <div style={{width:"100%",maxWidth:400,background:T.card,border:("1px solid "+T.border),borderRadius:20,padding:"28px 24px",boxShadow:T.glowShadow}}>
        <div style={{display:"flex",background:T.surface,borderRadius:12,padding:4,marginBottom:24}}>
          {[["Log in",true],["Sign up",false]].map(([l,v])=>(
            <div key={l} onClick={()=>{setIsLogin(v);setError("");}} style={{flex:1,padding:"9px",borderRadius:9,fontSize:13,fontWeight:600,textAlign:"center",cursor:"pointer",background:isLogin===v?T.accent:"transparent",color:isLogin===v?"#fff":T.muted,transition:"all 0.15s"}}>{l}</div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          {[["Email","email",email,setEmail,"you@example.com"],["Password","password",password,setPassword,"6+ characters"],[!isLogin&&"Confirm password","password",confirm,setConfirm,"Repeat password"]].filter(Boolean).map(([label,type,val,set,ph])=>(
            label&&<div key={label}>
              <div style={{fontSize:12,fontWeight:600,color:T.subtext,marginBottom:6}}>{label}</div>
              <input type={type} value={val} onChange={e=>set(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={ph}
                style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        {error&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#EF4444",marginBottom:14}}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{width:"100%",background:loading?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":("0 4px 20px "+T.accentGlow),transition:"all 0.2s"}}>
          {loading?"Please wait…":isLogin?"Log in →":"Create account →"}
        </button>
      </div>
      <div style={{marginTop:20,fontSize:12,color:T.muted,textAlign:"center"}}>By continuing you agree to our Terms of Service.</div>
    </div>
  );
}

// ── ONBOARDING WIZARD ─────────────────────────────────────────────

function GoalRatePicker({rate,setRate,tdee=0}){
  const T=useTheme();
  return(
    <div style={{display:"flex",flexDirection:"column",gap:7}}>
      {GOAL_RATES.map(r=>{
        const isActive=rate===r.id;
        const cal=tdee>0?calcCalFromRate(tdee,r.id):null;
        return(
          <div key={r.id} onClick={()=>setRate(r.id)}
            style={{
              display:"flex",alignItems:"center",gap:12,
              padding:"12px 14px",borderRadius:13,cursor:"pointer",
              background:isActive?T.accentPill:T.card,
              border:("1.5px solid "+isActive?r.color:T.border),
              boxShadow:isActive?"0 0 0 1px "+r.color+"33":"none",
              transition:"all 0.15s",
            }}>
            {/* Radio */}
            <div style={{width:18,height:18,borderRadius:"50%",border:("2px solid "+isActive?r.color:T.muted),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {isActive&&<div style={{width:9,height:9,borderRadius:"50%",background:r.color}}/>}
            </div>
            {/* Icon */}
            <div style={{fontSize:16,flexShrink:0}}>{r.icon}</div>
            {/* Label */}
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:isActive?r.color:T.text}}>{r.label}</div>
              {r.delta!==0&&(
                <div style={{fontSize:10,color:T.muted,marginTop:1}}>
                  {r.delta>0?"+":""}{r.delta} kcal/day from TDEE
                </div>
              )}
            </div>
            {/* Calorie estimate */}
            {cal&&(
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:800,color:r.color}}>{cal.toLocaleString()}</div>
                <div style={{fontSize:9,color:T.muted}}>kcal/day</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OnboardingWizard({userId,onComplete}){
  const T=useTheme();
  const [step,setStep]=useState(0);
  // A failed upsert must not call onComplete: the app would run on goals the
  // database never received, and the wizard would never show again.
  const [saveError,setSaveError]=useState("");
  const [name,setName]=useState("");
  const [gender,setGender]=useState("male");
  const [age,setAge]=useState("");
  const [weightLbs,setWeightLbs]=useState("");
  const [heightFt,setHeightFt]=useState("5");
  const [heightIn,setHeightIn]=useState("9");
  const [activity,setActivity]=useState("moderate");
  const [goalRate,setGoalRate]=useState("maintain");
  const [saving,setSaving]=useState(false);


  const calcGoals=()=>{
    const w=parseFloat(weightLbs)||170;
    const h=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    const a=parseInt(age)||25;
    const wKg=w*0.453592;const hCm=h*2.54;
    const bmr=gender==="male"
      ?(13.397*wKg)+(4.799*hCm)-(5.677*a)+88.362
      :(9.247*wKg)+(3.098*hCm)-(4.330*a)+447.593;
    const mult=ACTIVITY.find(x=>x.id===activity)?.mult||1.55;
    const tdee=Math.round(bmr*mult);
    const cal=calcCalFromRate(tdee,goalRate);
    const protein=Math.round(w*0.82);
    const fat=Math.round(cal*0.25/9);
    const carbs=Math.max(Math.round((cal-protein*4-fat*9)/4),50);
    return{cal,protein,carbs,fat,tdee,bmr:Math.round(bmr)};
  };

  const g=calcGoals();

  const finish=async()=>{
    setSaving(true);
    const goals={cal:g.cal,protein:g.protein,carbs:g.carbs,fat:g.fat};
    const hin=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    setSaveError("");
    if(userId){
      const row=await sb.upsert("profiles",{
        id:userId,
        name:name.trim()||"Friend",
        gender,
        age:parseInt(age)||null,
        weight_lbs:parseFloat(weightLbs)||null,
        height_in:hin,
        goal_rate:goalRate,
        activity_level:activity,
        cal_goal:g.cal,
        protein_goal:g.protein,
        carbs_goal:g.carbs,
        fat_goal:g.fat,
        bmr:g.bmr,
        tdee:g.tdee,
        theme:DEFAULT_THEME_KEY,
        updated_at:new Date().toISOString(),
      });
      if(!row){
        setSaving(false);
        setSaveError("Your plan couldn't be saved. Check your connection and try again.");
        return;
      }
    }
    setSaving(false);
    onComplete(goals,name.trim()||"Friend");
  };

  const inp=(val,set,ph,type="text",extra={})=>(
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
      style={{background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",...extra}}/>
  );

  const RadioOpt=({value,current,onChange,label,sub})=>(
    <div onClick={()=>onChange(value)}
      style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderRadius:13,cursor:"pointer",
        background:current===value?T.accentPill:T.card,
        border:("1.5px solid "+current===value?T.accent:T.border),
        boxShadow:current===value?T.glowShadow:"none",
        transition:"all 0.15s"}}>
      {/* Radio circle */}
      <div style={{width:20,height:20,borderRadius:"50%",border:("2px solid "+current===value?T.accent:T.muted),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {current===value&&<div style={{width:10,height:10,borderRadius:"50%",background:T.accent}}/>}
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:600,color:T.text}}>{label}</div>
        {sub&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{sub}</div>}
      </div>
    </div>
  );

  const STEPS=[
    // ── Step 0: Name & Gender ─────────────────────────────────────
    {
      title:"Let's get started 👋",
      sub:"Tell us a little about yourself",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Your name</div>
            {inp(name,setName,"First name")}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Gender</div>
            <div style={{display:"flex",gap:10}}>
              {[["male","♂ Male"],["female","♀ Female"]].map(([v,l])=>(
                <div key={v} onClick={()=>setGender(v)}
                  style={{flex:1,padding:"14px 10px",borderRadius:13,textAlign:"center",cursor:"pointer",
                    background:gender===v?T.accentPill:T.card,
                    border:("1.5px solid "+gender===v?T.accent:T.border),
                    fontSize:14,fontWeight:600,color:gender===v?T.accent:T.text,
                    boxShadow:gender===v?T.glowShadow:"none",transition:"all 0.15s"}}>
                  {l}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Age <span style={{fontSize:10,fontWeight:500,color:T.muted}}>(15 – 80)</span></div>
            {inp(age,setAge,"e.g. 25","number")}
          </div>
        </div>
      ),
    },

    // ── Step 1: Height & Weight ───────────────────────────────────
    {
      title:"Body measurements 📏",
      sub:"Used to calculate your exact calorie target using the Revised Harris-Benedict formula",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Height</div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{flex:1,position:"relative"}}>
                <input type="number" value={heightFt} onChange={e=>setHeightFt(e.target.value)} placeholder="5"
                  style={{width:"100%",background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box"}}/>
                <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:T.muted,pointerEvents:"none"}}>ft</div>
              </div>
              <div style={{flex:1,position:"relative"}}>
                <input type="number" value={heightIn} onChange={e=>setHeightIn(e.target.value)} placeholder="9"
                  style={{width:"100%",background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box"}}/>
                <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:T.muted,pointerEvents:"none"}}>in</div>
              </div>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Weight</div>
            <div style={{position:"relative"}}>
              <input type="number" value={weightLbs} onChange={e=>setWeightLbs(e.target.value)} placeholder="e.g. 165"
                style={{width:"100%",background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box"}}/>
              <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:T.muted,pointerEvents:"none"}}>lbs</div>
            </div>
          </div>
          {/* Live BMR preview */}
          {weightLbs&&age&&(
            <div style={{background:T.accentPill,border:("1px solid "+T.accent+"33"),borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between"}}>
              <div style={{fontSize:12,color:T.muted}}>Estimated BMR</div>
              <div style={{fontSize:12,fontWeight:700,color:T.accent}}>{g.bmr.toLocaleString()} kcal/day</div>
            </div>
          )}
        </div>
      ),
    },

    // ── Step 2: Activity Level ────────────────────────────────────
    {
      title:"Activity level ⚡",
      sub:"How much do you exercise on average?",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {ACTIVITY.map(({id,label,sub})=>(
            <RadioOpt key={id} value={id} current={activity} onChange={setActivity} label={label} sub={sub}/>
          ))}
        </div>
      ),
    },

    // ── Step 3: Goal Rate ─────────────────────────────────────────
    {
      title:"Choose your goal 🎯",
      sub:"Pick how fast you want to lose or gain. Your daily calories are calculated from this.",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <GoalRatePicker rate={goalRate} setRate={setGoalRate} tdee={g.tdee}/>
          {g.tdee>0&&(
            <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
              <div style={{fontSize:12,color:T.muted}}>Your TDEE (maintenance)</div>
              <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{g.tdee.toLocaleString()} kcal/day</div>
            </div>
          )}
        </div>
      ),
    },

    // ── Step 4: Summary ───────────────────────────────────────────
    {
      title:"Your personalised plan ✨",
      sub:"Calculated from your stats. You can adjust these later in Profile.",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Calorie target */}
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:16,padding:20,textAlign:"center",border:("1px solid "+T.border)}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Daily calorie target</div>
            <div style={{fontSize:48,fontWeight:800,color:"#fff",letterSpacing:"-2px",lineHeight:1}}>{g.cal.toLocaleString()}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:6}}>kcal / day</div>
          </div>

          {/* Macros */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[["Protein",g.protein+"g",T.macro[0]],["Carbs",g.carbs+"g",T.macro[1]],["Fat",g.fat+"g",T.macro[2]]].map(([l,v,c])=>(
              <div key={l} style={{background:T.card,border:("1px solid "+T.border),borderRadius:12,padding:"12px 8px",textAlign:"center",boxShadow:T.glowShadow}}>
                <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:3}}>{l}/day</div>
              </div>
            ))}
          </div>

          {/* Stats summary */}
          <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,overflow:"hidden"}}>
            {[
              ["Name",name||"—"],
              ["Gender",gender==="male"?"Male":"Female"],
              ["Age",age?age+" yrs":"—"],
              ["Weight",weightLbs?weightLbs+" lbs":"—"],
              ["Height",heightFt+"ft "+heightIn+"in"],
              ["Activity",ACTIVITY.find(a=>a.id===activity)?.label||"—"],
              ["Goal",GOAL_RATES.find(r=>r.id===goalRate)?.label||"—"],
              ["BMR",g.bmr.toLocaleString()+" kcal"],
              ["TDEE",g.tdee.toLocaleString()+" kcal"],
            ].map(([k,v],i,arr)=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:i<arr.length-1?"1px solid "+T.border:"none"}}>
                <div style={{fontSize:12,color:T.muted}}>{k}</div>
                <div style={{fontSize:12,fontWeight:600,color:T.text}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const canAdvance=()=>{
    if(step===0)return name.trim().length>0&&age;
    if(step===1)return weightLbs&&heightFt&&heightIn;
    return true;
  };

  return(
    <div style={{minHeight:"100vh",background:T.appBg,display:"flex",flexDirection:"column",fontFamily:"-apple-system,sans-serif",maxWidth:480,margin:"0 auto",position:"relative",overflow:"hidden"}}>
      {/* Glow */}
      <div style={{position:"absolute",top:-80,right:-60,width:220,height:220,borderRadius:"50%",background:T.accentGlow,filter:"blur(60px)",pointerEvents:"none"}}/>

      {/* Progress bar */}
      <div style={{padding:"52px 20px 0"}}>
        <div style={{display:"flex",gap:6,marginBottom:28}}>
          {STEPS.map((_,i)=>(
            <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?T.accent:T.border,transition:"all 0.3s"}}/>
          ))}
        </div>
        <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Step {step+1} of {STEPS.length}</div>
        <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.6px",marginBottom:4}}>{STEPS[step].title}</div>
        <div style={{fontSize:13,color:T.muted,marginBottom:22}}>{STEPS[step].sub}</div>
      </div>

      {/* Step content — scrollable */}
      <div style={{flex:1,overflowY:"auto",padding:"0 20px"}}>
        {STEPS[step].content}
      </div>

      {saveError&&(
        <div data-testid="onboarding-save-failed" style={{margin:"0 20px",padding:"10px 14px",borderRadius:12,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.35)",color:T.red,fontSize:13,fontWeight:600}}>
          {saveError}
        </div>
      )}
      {/* Footer buttons */}
      <div style={{padding:"20px 20px 44px",display:"flex",gap:10,flexShrink:0}}>
        {step>0&&(
          <button onClick={()=>setStep(s=>s-1)}
            style={{flex:1,background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:"15px",color:T.text,fontSize:15,fontWeight:600,cursor:"pointer"}}>
            ← Back
          </button>
        )}
        <button
          onClick={()=>step<STEPS.length-1?setStep(s=>s+1):finish()}
          disabled={!canAdvance()||saving}
          style={{flex:2,background:(!canAdvance()||saving)?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:(!canAdvance()||saving)?"not-allowed":"pointer",boxShadow:canAdvance()?("0 4px 20px "+T.accentGlow):"none",transition:"all 0.2s"}}>
          {saving?"Saving your plan…":step<STEPS.length-1?"Continue →":saveError?"Try again":"Let's go 🚀"}
        </button>
      </div>
    </div>
  );
}

// ── SHARED COMPONENTS ────────────────────────────────────────────
function SectionHeader({label}){
  const T=useTheme();
  return <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1.2,padding:"20px 20px 8px"}}>{label}</div>;
}
function SettingRow({label,sub,right,onClick,danger}){
  const T=useTheme();
  return(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",cursor:onClick?"pointer":"default",borderBottom:("1px solid "+T.border)}}
      onMouseEnter={e=>onClick&&(e.currentTarget.style.background=T.surface)}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:500,color:danger?"#EF4444":T.text}}>{label}</div>
        {sub&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}
function Toggle({value,onChange}){
  const T=useTheme();
  return(
    <div onClick={()=>onChange(!value)} style={{width:44,height:26,borderRadius:13,background:value?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:value?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
    </div>
  );
}
function PageShell({title,onBack,children,footer}){
  const T=useTheme();
  return(
    <div style={{position:"fixed",inset:0,zIndex:310,background:T.appBg,display:"flex",flexDirection:"column",animation:"slideInRight 0.22s cubic-bezier(.4,0,.2,1)"}}>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{background:T.card,borderBottom:("1px solid "+T.border),padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <div onClick={onBack} style={{width:34,height:34,borderRadius:"50%",background:T.surface,border:("1px solid "+T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><polyline points="8,2 2,8 8,14" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{fontSize:17,fontWeight:700,color:T.text}}>{title}</div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>{children}</div>
      {footer&&<div style={{flexShrink:0,padding:"12px 16px 32px",borderTop:("1px solid "+T.border),background:T.card}}>{footer}</div>}
    </div>
  );
}

// ── SETTINGS PAGE ─────────────────────────────────────────────────
// ── HEALTH SYNC — Feature 10 ──────────────────────────────────────
function HealthSyncSection({T:TFallback}){
  const T=useTheme()||TFallback;
  const [status,setStatus]=useState("idle"); // idle | connecting | connected | unsupported | error
  const [lastSync,setLastSync]=useState(null);
  const [steps,setSteps]=useState(null);

  // Detect platform
  const hasHealthAPI=typeof navigator!=="undefined"&&"health" in navigator;
  const isIOS=typeof navigator!=="undefined"&&/iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid=typeof navigator!=="undefined"&&/Android/.test(navigator.userAgent);

  const connectHealth=async()=>{
    setStatus("connecting");
    try{
      // Web Health API (experimental — Chrome on Android with Health Connect)
      if(hasHealthAPI){
        const health=navigator.health;
        await health.query({
          metrics:["steps","active_calories_burned","weight"],
          startTime:new Date(Date.now()-7*24*60*60*1000).toISOString(),
          endTime:new Date().toISOString(),
        });
        setStatus("connected");
        setLastSync(new Date().toLocaleTimeString());
        // Try to get today's steps
        const today=new Date();today.setHours(0,0,0,0);
        const stepsData=await health.query({metrics:["steps"],startTime:today.toISOString(),endTime:new Date().toISOString()});
        if(stepsData?.steps)setSteps(stepsData.steps.reduce((s,r)=>s+(r.value||0),0));
        localStorage.setItem("health_sync_connected","1");
      }else{
        // Not supported — show platform-specific instructions
        setStatus("unsupported");
      }
    }catch(e){
      setStatus(e.name==="NotAllowedError"?"error_permission":"error");
    }
  };

  useEffect(()=>{
    if(localStorage.getItem("health_sync_connected")==="1")setStatus("connected");
  },[]);

  const platformName=isIOS?"Apple Health":isAndroid?"Google Fit / Health Connect":"Health App";

  return(
    <div style={{padding:"0 20px 8px"}}>
      {status==="idle"||status==="connecting"?(
        <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:28}}>{isIOS?"🍎":isAndroid?"💚":"❤️"}</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:T.text}}>{platformName}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:2}}>Sync steps, weight and calories burned</div>
            </div>
          </div>
          <button onClick={connectHealth} disabled={status==="connecting"}
            style={{background:status==="connecting"?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:700,cursor:status==="connecting"?"not-allowed":"pointer",transition:"background 0.2s"}}>
            {status==="connecting"?"Connecting…":"Connect "+platformName}
          </button>
        </div>
      ):status==="connected"?(
        <div style={{background:T.surface,border:("1px solid "+T.accent+"55"),borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:24}}>{isIOS?"🍎":isAndroid?"💚":"❤️"}</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:T.accent}}>✓ {platformName} connected</div>
                {lastSync&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>Last sync: {lastSync}</div>}
              </div>
            </div>
            <div onClick={()=>{setStatus("idle");localStorage.removeItem("health_sync_connected");}} style={{fontSize:11,color:T.muted,cursor:"pointer",padding:"4px 8px",borderRadius:8,background:T.card,border:("1px solid "+T.border)}}>Disconnect</div>
          </div>
          {steps!==null&&(
            <div style={{background:T.card,borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,color:T.text}}>👟 Steps today</div>
              <div style={{fontSize:14,fontWeight:700,color:T.accent}}>{steps.toLocaleString()}</div>
            </div>
          )}
        </div>
      ):status==="unsupported"?(
        <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:14,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:6}}>Health app sync</div>
          <div style={{fontSize:12,color:T.muted,lineHeight:1.6,marginBottom:10}}>
            {isIOS
              ?"Your browser doesn't support direct Health API access. For full Apple Health integration, download the native WiFit app from the App Store."
              :isAndroid
              ?"Requires Chrome on Android with Health Connect installed. Make sure Health Connect is set up in your device settings."
              :"Health app sync requires a supported mobile browser. On iOS use Safari, on Android use Chrome with Health Connect installed."}
          </div>
          <div style={{background:T.accentPill,border:("1px solid "+T.accent+"44"),borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:18}}>📱</div>
            <div style={{fontSize:12,color:T.accent,fontWeight:600}}>Native app coming soon — full Health sync</div>
          </div>
        </div>
      ):(
        <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:14,padding:14}}>
          <div style={{fontSize:13,fontWeight:600,color:"#EF4444",marginBottom:4}}>Connection failed</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:10}}>
            {status==="error_permission"?"Permission was denied. Allow health data access in your device settings to connect.":"Something went wrong. Make sure you're on a supported browser and try again."}
          </div>
          <div onClick={()=>setStatus("idle")} style={{fontSize:12,color:T.accent,cursor:"pointer",fontWeight:600}}>Try again</div>
        </div>
      )}
    </div>
  );
}

function SettingsPage({onBack,isDark,setIsDark,onSignOut,userName}){
  const T=useTheme();
  // One of navItems' ids below; renderSection has no fallback branch, so this
  // must always be a valid id. "account" matches the first nav item.
  const [section,setSection]=useState("account");
  const [notifWorkout,setNotifWorkout]=useState(()=>JSON.parse(localStorage.getItem("notif_workout")||"true"));
  const [notifSupps,setNotifSupps]=useState(()=>JSON.parse(localStorage.getItem("notif_supps")||"true"));
  const [notifGoals,setNotifGoals]=useState(()=>JSON.parse(localStorage.getItem("notif_goals")||"false"));
  const [notifPerm,setNotifPerm]=useState(()=>"Notification" in window?Notification.permission:"denied");
  const [units,setUnits]=useState("imperial");
  const [privMode,setPrivMode]=useState(false);

  const requestAndToggleNotif=async(key,val,setter)=>{
    if(val&&"Notification" in window&&Notification.permission!=="granted"){
      const perm=await Notification.requestPermission();
      setNotifPerm(perm);
      if(perm!=="granted"){setter(false);return;}
    }
    setter(val);
    localStorage.setItem("notif_"+key,JSON.stringify(val));
    if(val&&notifPerm==="granted"){
      scheduleNotif(key);
    }
  };

  const scheduleNotif=(key)=>{
    if(!("Notification" in window)||Notification.permission!=="granted")return;
    const msgs={
      workout:{title:"💪 Time to train!",body:"Your workout is scheduled for today. Let's get it done."},
      supps:{title:"💊 Supplement reminder",body:"Don't forget to take your supplements today."},
      goals:{title:"🎯 Calorie check-in",body:"Have you logged your meals today? Stay on track."},
    };
    const m=msgs[key];
    if(!m)return;
    // Fire a demo notification immediately to confirm it works, then daily
    setTimeout(()=>{
      try{new Notification(m.title,{body:m.body,icon:"/favicon.ico"});}catch{}
    },3000);
  };

  const navItems=[{id:"account",label:"Account"},{id:"notifications",label:"Notifications"},{id:"appearance",label:"Appearance"},{id:"units",label:"Units & data"},{id:"privacy",label:"Privacy"},{id:"advanced",label:"Advanced"}];
  const email=sb.getUser()?.email||"—";
  const initials=userName?userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";
  const renderSection=()=>{
    if(section==="account")return(<>
      <div style={{padding:"24px 20px 16px",borderBottom:("1px solid "+T.border),display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700,flexShrink:0}}>{initials}</div>
        <div><div style={{fontSize:18,fontWeight:700,color:T.text}}>{userName||"User"}</div><div style={{fontSize:13,color:T.muted,marginTop:2}}>Signed in as {email}</div></div>
      </div>
      <SectionHeader label="Your account"/>
      <SettingRow label="Email address" sub={email} right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Change password" sub="Update your login credentials" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Connected devices" sub="Manage synced wearables and apps" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Subscription"/>
      <SettingRow label="WiFit Plus" sub="Active — renews monthly" right={<span style={{fontSize:12,color:T.accent,fontWeight:600,background:T.accentPill,padding:"3px 10px",borderRadius:20}}>Manage</span>}/>
      <SectionHeader label="Danger zone"/>
      <SettingRow label="Sign out" danger onClick={onSignOut}/>
      <SettingRow label="Delete account" sub="Permanently remove all your data" danger/>
    </>);
    if(section==="notifications")return(<>
      {notifPerm==="denied"&&(
        <div style={{margin:"16px 16px 0",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:16,flexShrink:0}}>🔕</span>
          <div><div style={{fontSize:13,fontWeight:600,color:"#EF4444"}}>Notifications blocked</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>Enable notifications in your browser or device settings to receive reminders.</div></div>
        </div>
      )}
      {notifPerm==="granted"&&(
        <div style={{margin:"16px 16px 0",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:12,padding:"10px 14px",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:14}}>✅</span>
          <div style={{fontSize:12,color:"#22C55E",fontWeight:600}}>Notifications enabled</div>
        </div>
      )}
      <SectionHeader label="Workout reminders"/>
      <SettingRow label="Workout nudge" sub="While the app is open — background alerts need the iOS app" right={<Toggle value={notifWorkout} onChange={v=>requestAndToggleNotif("workout",v,setNotifWorkout)}/>}/>
      <SectionHeader label="Nutrition"/>
      <SettingRow label="Supplement nudges" sub="While the app is open — background alerts need the iOS app" right={<Toggle value={notifSupps} onChange={v=>requestAndToggleNotif("supps",v,setNotifSupps)}/>}/>
      <SettingRow label="Calorie goal nudge" sub="While the app is open" right={<Toggle value={notifGoals} onChange={v=>requestAndToggleNotif("goals",v,setNotifGoals)}/>}/>
    </>);
    if(section==="appearance")return(<>
      <SectionHeader label="Theme"/>
      {!T.locked&&<SettingRow label="Dark mode" sub={isDark?"Midnight Purple":"Clean Slate"} right={<Toggle value={isDark} onChange={setIsDark}/>}/>}
      <SectionHeader label="Display"/>
      <SettingRow label="Compact mode" sub="Denser layout with smaller cards" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SettingRow label="Large text" sub="Increase font sizes throughout the app" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SettingRow label="Reduce motion" sub="Disable animations and transitions" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="Home screen"/>
      <SettingRow label="Show calorie ring" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Show macro bars" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Show shortcuts" right={<Toggle value={true} onChange={()=>{}}/>}/>
    </>);
    if(section==="units")return(<>
      <SectionHeader label="Measurements"/>
      {[["imperial","Imperial (lbs, miles)"],["metric","Metric (kg, km)"]].map(([val,label])=>(
        <SettingRow key={val} label={label} onClick={()=>setUnits(val)} right={units===val?<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>:<div style={{width:16,height:16,borderRadius:"50%",border:("1.5px solid "+T.border)}}/>}/>
      ))}
      <SectionHeader label="Nutrition display"/>
      <SettingRow label="Energy unit" sub="kcal" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Macro display" sub="Show grams and percentages" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SectionHeader label="Data and export"/>
      <SettingRow label="Export my data" sub="Download all your logs as CSV" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Import food history" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Health app integration"/>
      <HealthSyncSection T={T}/>
    </>);
    if(section==="privacy")return(<>
      <SectionHeader label="Data collection"/>
      <SettingRow label="Analytics" sub="Help improve WiFit with usage data" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Crash reporting" sub="Automatically send error reports" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Personalised ads" sub="Allow relevant ads in free tier" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="Visibility"/>
      <SettingRow label="Private profile" sub="Hide your stats from leaderboards" right={<Toggle value={privMode} onChange={setPrivMode}/>}/>
      <SettingRow label="Friend activity" sub="See what friends are logging" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="Legal"/>
      <SettingRow label="Privacy policy" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Terms of service" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
    </>);
    if(section==="advanced")return(<>
      <SectionHeader label="Debug"/>
      <SettingRow label="App version" sub="WiFit 1.0.0 (build 42)"/>
      <SettingRow label="Clear local cache" sub="Reset locally stored data" right={<span style={{fontSize:12,color:"#EF4444",fontWeight:600}}>Clear</span>}/>
      <SettingRow label="Force sync" sub="Re-fetch all data from Supabase" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Experimental"/>
      <SettingRow label="AI meal scanner" sub="Use camera to identify foods" right={<span style={{fontSize:10,fontWeight:700,color:T.accent,background:T.accentPill,padding:"2px 7px",borderRadius:10}}>BETA</span>}/>
      <SettingRow label="Smart workout suggestions" sub="Auto-plan based on recovery data" right={<span style={{fontSize:10,fontWeight:700,color:T.accent,background:T.accentPill,padding:"2px 7px",borderRadius:10}}>BETA</span>}/>
    </>);
  };
  return(
    <div style={{position:"fixed",inset:0,zIndex:310,background:T.appBg,display:"flex",flexDirection:"column",animation:"slideInRight 0.22s cubic-bezier(.4,0,.2,1)"}}>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <div style={{background:T.card,borderBottom:("1px solid "+T.border),padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <div onClick={onBack} style={{width:34,height:34,borderRadius:"50%",background:T.surface,border:("1px solid "+T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><polyline points="8,2 2,8 8,14" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{fontSize:17,fontWeight:700,color:T.text}}>Settings</div>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{width:140,borderRight:("1px solid "+T.border),background:T.card,display:"flex",flexDirection:"column",gap:2,padding:"12px 0",flexShrink:0,overflowY:"auto"}}>
          {navItems.map(n=>(
            <div key={n.id} onClick={()=>setSection(n.id)} style={{padding:"11px 16px",fontSize:13,fontWeight:section===n.id?700:400,color:section===n.id?T.accent:T.text,background:section===n.id?T.accentPill:"transparent",borderRight:section===n.id?("3px solid "+T.accent):"3px solid transparent",cursor:"pointer",transition:"all 0.12s"}}>{n.label}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>{renderSection()}</div>
      </div>
    </div>
  );
}

// ── PROFILE PAGE ──────────────────────────────────────────────────
function ProfilePage({goals,setGoals,userName,setUserName,isDark,setIsDark,themeFam,logWeight,onSignOut,onClose}){
  const T=useTheme();
  const [name,setName]=useState(userName||"");
  const [calGoal,setCalGoal]=useState(String(goals?.cal||2200));
  const [protGoal,setProtGoal]=useState(String(goals?.protein||140));
  const [carbGoal,setCarbGoal]=useState(String(goals?.carbs||180));
  const [fatGoal,setFatGoal]=useState(String(goals?.fat||78));
  // Body stats — loaded from Supabase on mount
  const [loadError,setLoadError]=useState(false);
  const [gender,setGender]=useState("male");
  const [age,setAge]=useState("");
  const [weightLbs,setWeightLbs]=useState("");
  const [heightFt,setHeightFt]=useState("5");
  const [heightIn,setHeightIn]=useState("9");
  const [activity,setActivity]=useState("moderate");
  const [goalRate,setGoalRate]=useState("maintain");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [saveError,setSaveError]=useState("");
  const initials=name?name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";

  const ACTIVITY_LABELS={
    bmr:"BMR only",sedentary:"Little/no exercise",light:"1–3×/week",
    moderate:"3–5×/week",active:"Daily intense",very_active:"6–7×/week",extremely:"Physical job daily",
  };
  const ACTIVITY_MULTS=ACTIVITY_MULTS_BY_ID; // one table for onboarding and profile — activityMults.test pins the seven values

  useEffect(()=>{
    const load=async()=>{
      const uid=sb.getUser()?.id;
      if(!uid)return;
      // selectAuth: a failed read must not render an EMPTY form — Save
      // upserts the whole profile, so a blank form saved is data loss.
      const {ok,rows}=await sb.selectAuth("profiles","id=eq."+uid);
      if(!ok){setLoadError(true);return;}
      setLoadError(false);
      if(rows?.length>0){
        const p=rows[0];
        if(p.gender)setGender(p.gender);
        if(p.age)setAge(String(p.age));
        if(p.weight_lbs)setWeightLbs(String(p.weight_lbs));
        if(p.height_in){const ft=Math.floor(p.height_in/12);setHeightFt(String(ft));setHeightIn(String(p.height_in%12));}
        if(p.activity_level)setActivity(p.activity_level);
        if(p.goal_rate)setGoalRate(p.goal_rate);
        else if(p.goal)setGoalRate(p.goal==="lose"?"lose_1":p.goal==="gain"?"gain_0.5":"maintain");
      }
    };
    load();
  },[]);

  // Live TDEE calc
  const calcTDEE=()=>{
    const w=parseFloat(weightLbs)||0;const h=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);const a=parseInt(age)||25;
    if(!w)return null;
    const wKg=w*0.453592;const hCm=h*2.54;
    const bmrVal=gender==="male"
      ?(13.397*wKg)+(4.799*hCm)-(5.677*a)+88.362
      :(9.247*wKg)+(3.098*hCm)-(4.330*a)+447.593;
    const tdee=Math.round(bmrVal*(ACTIVITY_MULTS[activity]||1.55));
    const cal=calcCalFromRate(tdee,goalRate);
    return{bmr:Math.round(bmrVal),tdee,cal};
  };
  const tdeeData=calcTDEE();

  // Auto-update calorie & macro inputs whenever body stats change
  useEffect(()=>{
    if(!tdeeData)return;
    setCalGoal(String(tdeeData.cal));
    const w=parseFloat(weightLbs)||0;
    if(w>0){
      const protein=Math.round(w*0.82);
      const fat=Math.round(tdeeData.cal*0.25/9);
      const carbs=Math.max(Math.round((tdeeData.cal-protein*4-fat*9)/4),50);
      setProtGoal(String(protein));
      setCarbGoal(String(carbs));
      setFatGoal(String(fat));
    }
  },[weightLbs,heightFt,heightIn,age,gender,activity,goalRate]);

  const save=async()=>{
    setSaving(true);
    const uid=sb.getUser()?.id;
    const g={cal:parseInt(calGoal)||2200,protein:parseInt(protGoal)||140,carbs:parseInt(carbGoal)||180,fat:parseInt(fatGoal)||78};
    const hin=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    setSaveError("");
    if(uid){
      const row=await sb.upsert("profiles",{id:uid,name:name.trim()||userName,gender,age:parseInt(age)||null,weight_lbs:parseFloat(weightLbs)||null,height_in:hin,activity_level:activity,goal_rate:goalRate,cal_goal:g.cal,protein_goal:g.protein,carbs_goal:g.carbs,fat_goal:g.fat,theme:themeFam+"_"+(isDark?"dark":"light"),bmr:tdeeData?.bmr||null,tdee:tdeeData?.tdee||null,updated_at:new Date().toISOString()});
      // Neither the ✓ nor the local goals may move until the row landed —
      // otherwise the app runs on numbers the database never received.
      if(!row){setSaving(false);setSaveError("Profile couldn't be saved. Check your connection and try again.");return;}
    }
    // profiles.weight_lbs is only "current weight" — record the day's entry in
    // body_weight_log too, or the weight chart never accumulates history.
    const wl=parseFloat(weightLbs);
    if(logWeight&&Number.isFinite(wl)&&wl>0)await logWeight(wl);
    setUserName(name.trim()||userName);setGoals(g);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  const inp=(val,set,ph,type="text",extra={})=>(
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
      style={{background:T.surface,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"11px 14px",fontSize:14,outline:"none",...extra}}/>
  );

  return(
    <PageShell title="Profile" onBack={onClose} footer={<>
      {saveError&&<div data-testid="profile-save-failed" style={{marginBottom:10,padding:"10px 14px",borderRadius:12,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.35)",color:T.red,fontSize:13,fontWeight:600}}>{saveError}</div>}
      <button onClick={save} disabled={saving||loadError} style={{width:"100%",background:saved?"#22C55E":(saving||loadError)?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer",transition:"background 0.2s"}}>{saved?"Saved ✓":saving?"Saving...":"Save changes"}</button>
    </>}>
      {loadError&&(
        <div data-testid="profile-failed" style={{margin:"12px 16px 0",padding:"10px 14px",borderRadius:12,background:T.accentPill,border:("1px solid "+T.border),fontSize:12,color:T.text}}>
          Couldn't load your profile. The fields below are NOT your saved values — reopen this page before saving.
        </div>
      )}
      {/* Banner */}
      <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),padding:"28px 20px 24px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:22,fontWeight:700,boxShadow:("0 4px 16px "+T.accentGlow),flexShrink:0}}>{initials}</div>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>{name||"Your name"}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginTop:3}}>{sb.getUser()?.email||"Not signed in"}</div>
          <div style={{fontSize:12,color:T.accent,fontWeight:600,marginTop:4,background:"rgba(255,255,255,0.1)",display:"inline-block",padding:"2px 10px",borderRadius:20}}>Plus</div>
        </div>
      </div>

      {/* Personal */}
      <SectionHeader label="Personal info"/>
      <div style={{padding:"0 20px 4px"}}>
        <div style={{fontSize:12,color:T.muted,marginBottom:6}}>Display name</div>
        {inp(name,setName,"Your name","text",{width:"100%",boxSizing:"border-box"})}
      </div>
      <div style={{padding:"12px 20px 4px",display:"flex",gap:10}}>
        {[["male","♂ Male"],["female","♀ Female"]].map(([v,l])=>(
          <div key={v} onClick={()=>setGender(v)} style={{flex:1,padding:"10px",borderRadius:10,textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,background:gender===v?T.accentPill:T.surface,border:("1.5px solid "+gender===v?T.accent:T.border),color:gender===v?T.accent:T.muted}}>{l}</div>
        ))}
      </div>
      <div style={{padding:"10px 20px",display:"flex",gap:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:5}}>Age</div>
          {inp(age,setAge,"25","number",{width:"100%",boxSizing:"border-box"})}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:5}}>Weight (lbs)</div>
          {inp(weightLbs,setWeightLbs,"165","number",{width:"100%",boxSizing:"border-box"})}
        </div>
      </div>
      <div style={{padding:"0 20px 4px"}}>
        <div style={{fontSize:11,color:T.muted,marginBottom:5}}>Height</div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1,position:"relative"}}>
            {inp(heightFt,setHeightFt,"5","number",{width:"100%",boxSizing:"border-box",paddingRight:28})}
            <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:T.muted}}>ft</div>
          </div>
          <div style={{flex:1,position:"relative"}}>
            {inp(heightIn,setHeightIn,"9","number",{width:"100%",boxSizing:"border-box",paddingRight:28})}
            <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:T.muted}}>in</div>
          </div>
        </div>
      </div>

      {/* Activity + Goal */}
      <SectionHeader label="Activity & goal"/>
      <div style={{padding:"0 20px 4px"}}>
        <div style={{fontSize:11,color:T.muted,marginBottom:6}}>Activity level</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[["sedentary","Little/no exercise"],["light","1–3×/week"],["moderate","3–5×/week"],["active","Daily intense exercise"],["very_active","6–7×/week intense"],["extremely","Physical job + daily training"]].map(([v,l])=>(
            <div key={v} onClick={()=>setActivity(v)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",background:activity===v?T.accentPill:T.surface,border:("1.5px solid "+activity===v?T.accent:T.border)}}>
              <div style={{width:16,height:16,borderRadius:"50%",border:("2px solid "+activity===v?T.accent:T.muted),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {activity===v&&<div style={{width:8,height:8,borderRadius:"50%",background:T.accent}}/>}
              </div>
              <div style={{fontSize:13,color:activity===v?T.accent:T.text,fontWeight:activity===v?600:400}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"0 20px 8px"}}>
        <div style={{fontSize:11,color:T.muted,marginBottom:8}}>Goal</div>
        <GoalRatePicker rate={goalRate} setRate={setGoalRate} tdee={tdeeData?.tdee||0}/>
      </div>

      {/* TDEE preview */}
      {tdeeData&&(
        <div style={{margin:"12px 20px 0",background:T.surface,border:("1px solid "+T.border),borderRadius:12,overflow:"hidden"}}>
          {[["BMR",tdeeData.bmr.toLocaleString()+" kcal/day","Calories at complete rest"],["TDEE",tdeeData.tdee.toLocaleString()+" kcal/day","Maintenance with your activity"],["Target",tdeeData.cal.toLocaleString()+" kcal/day","Your adjusted daily goal"]].map(([l,v,sub],i,arr)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:i<arr.length-1?"1px solid "+T.border:"none"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{l}</div><div style={{fontSize:11,color:T.muted}}>{sub}</div></div>
              <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Nutrition goals */}
      <SectionHeader label="Daily nutrition goals"/>
      <div style={{padding:"0 20px",display:"flex",flexDirection:"column",gap:10}}>
        {[["Calories",calGoal,setCalGoal,"kcal"],["Protein",protGoal,setProtGoal,"g"],["Carbs",carbGoal,setCarbGoal,"g"],["Fat",fatGoal,setFatGoal,"g"]].map(([label,val,set,unit])=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:13,color:T.text,width:72,flexShrink:0}}>{label}</div>
            <input type="number" value={val} onChange={e=>set(e.target.value)} style={{flex:1,background:T.surface,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>
            <div style={{fontSize:12,color:T.muted,width:28,flexShrink:0}}>{unit}</div>
          </div>
        ))}
      </div>

      {/* Account */}
      <SectionHeader label="Account"/>
      {[["Email",sb.getUser()?.email||"—"],["Member since","May 2026"]].map(([l,v])=>(
        <SettingRow key={l} label={l} right={<span style={{fontSize:13,color:T.muted}}>{v}</span>}/>
      ))}
      <div style={{padding:"12px 20px 0"}}>
        <div onClick={onSignOut} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:12,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:8}}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"><path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3"/><polyline points="11 11 14 8 11 5"/><line x1="14" y1="8" x2="6" y2="8"/></svg>
          <div style={{fontSize:14,fontWeight:600,color:"#EF4444"}}>Sign out</div>
        </div>
      </div>
    </PageShell>
  );
}

// ── PERSONALIZATION PAGE ──────────────────────────────────────────
const THEME_FAMILIES=[
  {id:"aurora", name:"Aurora",     darkBg:"#020B18", lightBg:"#F8F9FC", darkAccent:"#06B6D4", lightAccent:"#4F46E5", darkDesc:"Midnight Teal",   lightDesc:"Clean Indigo"},
  {id:"forest", name:"Forest",     darkBg:"#040D07", lightBg:"#F0FAF5", darkAccent:"#10B981", lightAccent:"#059669", darkDesc:"Deep Emerald",    lightDesc:"Fresh Sage"},
  {id:"ember",  name:"Ember",      darkBg:"#0F0700", lightBg:"#FFFBF0", darkAccent:"#F59E0B", lightAccent:"#D97706", darkDesc:"Warm Amber",      lightDesc:"Golden Hour"},
  {id:"rose",   name:"Rose",       darkBg:"#0D0409", lightBg:"#FFF5FA", darkAccent:"#EC4899", lightAccent:"#DB2777", darkDesc:"Midnight Blush",  lightDesc:"Soft Petal"},
  {id:"obsidian",name:"Obsidian",  darkBg:"#09090F", lightBg:"#F8F7FF", darkAccent:"#8B5CF6", lightAccent:"#7C3AED", darkDesc:"Dark Violet",    lightDesc:"Crisp Lavender"},
];

function PersonalizationPage({onBack,isDark,themeFam,setThemeFam}){
  const T=useTheme();
  const [fitnessGoal,setFitnessGoal]=useState("build_muscle");
  const [activityLevel,setActivityLevel]=useState("moderate");
  const [experience,setExperience]=useState("intermediate");
  const [focusAreas,setFocusAreas]=useState(["chest","back","legs"]);
  const [aiTone,setAiTone]=useState("motivational");
  const [pendingFam,setPendingFam]=useState(themeFam);
  const [saved,setSaved]=useState(false);

  const handleSave=()=>{setThemeFam(pendingFam);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const toggleFocus=f=>setFocusAreas(p=>p.includes(f)?p.filter(x=>x!==f):[...p,f]);

  return(
    <PageShell title="Personalization" onBack={onBack}>

      {/* ── THEME SECTION ── */}
      <SectionHeader label="App theme"/>
      <div style={{padding:"0 16px 8px"}}>
        <div style={{fontSize:12,color:T.muted,marginBottom:12}}>
          {LOCKED_FAMILIES.has(pendingFam)?"This palette has a fixed light or dark mode; the Dark Mode toggle is hidden while it is active.":"Choose a colour family. The dark/light variant follows your Dark Mode toggle in Settings."}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {THEME_FAMILIES.map(tf=>{
            const isActive=pendingFam===tf.id;
            const darkTh=THEMES[tf.id+"_dark"];
            const lightTh=THEMES[tf.id+"_light"];
            return(
              <div key={tf.id} onClick={()=>setPendingFam(tf.id)}
                style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"12px 14px",borderRadius:14,cursor:"pointer",
                  border:("2px solid "+(isActive?T.accent:T.border)),
                  background:isActive?T.accentPill:T.surface,
                  transition:"all 0.15s",
                }}>
                {/* Dark swatch */}
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div style={{width:42,height:42,borderRadius:10,background:darkTh.bg,border:("1.5px solid "+darkTh.border),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",top:6,left:6,right:6,height:8,borderRadius:2,background:darkTh.accent,opacity:0.9}}/>
                    <div style={{position:"absolute",bottom:6,left:6,right:6,display:"flex",gap:2}}>
                      {darkTh.macro.slice(0,3).map((c,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:c}}/>)}
                    </div>
                  </div>
                  {/* Light swatch */}
                  <div style={{width:42,height:42,borderRadius:10,background:lightTh.bg,border:("1.5px solid "+lightTh.border),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",top:6,left:6,right:6,height:8,borderRadius:2,background:lightTh.accent,opacity:0.9}}/>
                    <div style={{position:"absolute",bottom:6,left:6,right:6,display:"flex",gap:2}}>
                      {lightTh.macro.slice(0,3).map((c,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:c}}/>)}
                    </div>
                  </div>
                </div>
                {/* Labels */}
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:isActive?T.accent:T.text}}>{tf.name}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                    <span style={{color:darkTh.accent}}>●</span> {tf.darkDesc} &nbsp;·&nbsp;
                    <span style={{color:lightTh.accent}}>●</span> {tf.lightDesc}
                  </div>
                </div>
                {isActive&&(
                  <svg width="18" height="18" viewBox="0 0 18 18" style={{flexShrink:0}}>
                    <circle cx="9" cy="9" r="8" fill={T.accent}/>
                    <polyline points="4.5,9 7.5,12 13.5,6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        {/* Mode-locked palettes: one swatch each, grouped by the mode they lock to. */}
        {[["dark","Dark palettes"],["light","Light palettes"]].map(([mode,title])=>(
          <div key={mode} style={{marginTop:14}}>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{title}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {THEME_ORDER.filter(k=>THEME_META[k].mode===mode).map(k=>{
                const th=THEMES[k+"_"+mode];
                const isActive=pendingFam===k;
                return(
                  <div key={k} onClick={()=>setPendingFam(k)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,cursor:"pointer",border:("2px solid "+(isActive?T.accent:T.border)),background:isActive?T.accentPill:T.surface,transition:"all 0.15s"}}>
                    <div style={{width:42,height:42,borderRadius:10,background:th.appBg,border:("1.5px solid "+th.border),flexShrink:0,overflow:"hidden",position:"relative"}}>
                      <div style={{position:"absolute",top:6,left:6,right:6,height:8,borderRadius:2,background:th.accent,opacity:0.9}}/>
                      <div style={{position:"absolute",bottom:6,left:6,right:6,display:"flex",gap:2}}>
                        {th.macro.slice(0,3).map((c,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:c}}/>)}
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:isActive?T.accent:T.text}}>{THEME_META[k].label}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{THEME_META[k].blurb}</div>
                    </div>
                    {isActive&&(<svg width="18" height="18" viewBox="0 0 18 18" style={{flexShrink:0}}><circle cx="9" cy="9" r="8" fill={T.accent}/><polyline points="4.5,9 7.5,12 13.5,6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {pendingFam!==themeFam&&(
          <button onClick={handleSave} style={{width:"100%",marginTop:14,background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:12,padding:"13px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 16px "+T.accentGlow)}}>
            Apply {THEME_FAMILIES.find(f=>f.id===pendingFam)?.name||THEME_META[pendingFam]?.label} theme
          </button>
        )}
        {saved&&<div style={{textAlign:"center",fontSize:13,color:T.green,marginTop:8,fontWeight:600}}>✓ Theme applied!</div>}
      </div>

      {/* ── REST OF PERSONALIZATION ── */}
      <SectionHeader label="Primary fitness goal"/>
      {[["build_muscle","Build muscle","Hypertrophy-focused programming"],["lose_fat","Lose fat","Caloric deficit with cardio"],["maintain","Maintain and tone","Recomp at maintenance calories"],["performance","Athletic performance","Sport-specific strength and conditioning"]].map(([val,label,sub])=>(
        <div key={val} onClick={()=>setFitnessGoal(val)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",borderBottom:("1px solid "+T.border),cursor:"pointer",background:fitnessGoal===val?T.accentPill:"transparent"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:fitnessGoal===val?T.accent:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
          {fitnessGoal===val&&<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
      ))}
      <SectionHeader label="Activity level"/>
      {[["sedentary","Sedentary","Desk job, little movement"],["light","Lightly active","1-3 workouts/week"],["moderate","Moderately active","3-5 workouts/week"],["very","Very active","6+ workouts/week"]].map(([val,label,sub])=>(
        <div key={val} onClick={()=>setActivityLevel(val)} style={{display:"flex",alignItems:"center",padding:"13px 20px",borderBottom:("1px solid "+T.border),cursor:"pointer",gap:14,background:activityLevel===val?T.accentPill:"transparent"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:activityLevel===val?T.accent:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
          {activityLevel===val&&<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
      ))}
      <SectionHeader label="Training experience"/>
      <div style={{display:"flex",gap:10,padding:"4px 20px 16px"}}>
        {[["beginner","Beginner"],["intermediate","Intermediate"],["advanced","Advanced"]].map(([val,label])=>(
          <div key={val} onClick={()=>setExperience(val)} style={{flex:1,padding:"10px 6px",borderRadius:12,textAlign:"center",fontSize:12,fontWeight:600,cursor:"pointer",border:("1.5px solid "+experience===val?T.accent:T.border),background:experience===val?T.accentPill:"transparent",color:experience===val?T.accent:T.muted}}>{label}</div>
        ))}
      </div>
      <SectionHeader label="Focus muscle groups"/>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"4px 20px 20px"}}>
        {["Chest","Back","Shoulders","Arms","Core","Legs","Glutes","Cardio"].map(f=>{
          const key=f.toLowerCase();const on=focusAreas.includes(key);
          return <div key={key} onClick={()=>toggleFocus(key)} style={{padding:"8px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:("1.5px solid "+on?T.accent:T.border),background:on?T.accentPill:"transparent",color:on?T.accent:T.muted}}>{f}</div>;
        })}
      </div>
      <SectionHeader label="AI Coach tone"/>
      {[["motivational","Motivational","Hype, push-you-hard energy"],["calm","Calm and supportive","Steady, science-based guidance"],["technical","Technical","Detailed breakdowns and data"]].map(([val,label,sub])=>(
        <div key={val} onClick={()=>setAiTone(val)} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",borderBottom:("1px solid "+T.border),cursor:"pointer",background:aiTone===val?T.accentPill:"transparent"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:aiTone===val?T.accent:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
          {aiTone===val&&<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
      ))}
    </PageShell>
  );
}

// ── UPGRADE PAGE ──────────────────────────────────────────────────
function UpgradePage({onBack}){
  const T=useTheme();
  const [billing,setBilling]=useState("annual");
  const features=[["Unlimited AI Coach","No message limits, full workout planning"],["Advanced analytics","Trends, PRs, body comp tracking"],["Workout periodization","Auto-progressive overload plans"],["Wearable sync","Apple Watch, Garmin, WHOOP"],["Full meal planning","Week plans generated by AI"],["Supplement optimizer","Personalised stack recommendations"]];
  return(
    <PageShell title="Upgrade to Plus" onBack={onBack} footer={
      <button style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 6px 20px "+T.accentGlow)}}>
        {billing==="annual"?"Start Plus — $5.99/mo (billed annually)":"Start Plus — $9.99/month"}
      </button>
    }>
      <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),padding:"28px 20px 24px",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:6}}>&#11088;</div>
        <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>WiFit Plus</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.55)",marginTop:6}}>Unlock every feature. Train smarter.</div>
      </div>
      <div style={{display:"flex",gap:10,padding:"18px 20px 8px"}}>
        {[["annual","Annual — Save 40%"],["monthly","Monthly"]].map(([val,label])=>(
          <div key={val} onClick={()=>setBilling(val)} style={{flex:1,padding:"11px 10px",borderRadius:12,textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",border:("2px solid "+billing===val?T.accent:T.border),background:billing===val?T.accentPill:"transparent",color:billing===val?T.accent:T.muted}}>{label}</div>
        ))}
      </div>
      <div style={{padding:"8px 20px 20px"}}>
        <div style={{background:T.surface,borderRadius:14,border:("1px solid "+T.border),overflow:"hidden"}}>
          {features.map(([label,sub],i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<features.length-1?"1px solid "+T.border:"none"}}>
              <svg width="14" height="14" viewBox="0 0 14 14" style={{flexShrink:0}}><circle cx="7" cy="7" r="6" fill={T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

// ── HELP PAGE ─────────────────────────────────────────────────────
function HelpPage({onBack}){
  const T=useTheme();
  const [openFaq,setOpenFaq]=useState(null);
  const faqs=[
    ["How do I log food?","Tap the Food tab or use Quick Add in the nav bar. Search the USDA database or add custom foods. You can also tell your AI Coach what you ate and it will log it."],
    ["How does the AI Coach work?","The AI Coach is powered by Claude by Anthropic. It can answer fitness and nutrition questions, log food for you, and create full workout plans. Just describe what you need."],
    ["Can I sync with Apple Health?","Apple Health sync is coming in a future update. For now, manually log workouts and food directly in WiFit."],
    ["How do I track a workout?","Go to the Train tab, select a plan, and tap Start. Log your sets and reps live. When done, finish the session and it will appear in your history and on the Calendar."],
    ["How is my calorie goal calculated?","Your calorie goal is set in Profile. The default is 2,200 kcal. Adjust it to match your TDEE based on your activity level and goal."],
    ["Why is my Calendar not showing data?","The Calendar reflects food logged, workouts completed, and supplements taken. Make sure you are marking supplements taken in the Supps tab."],
  ];
  return(
    <PageShell title="Help and Support" onBack={onBack}>
      <div style={{padding:"20px 20px 16px",background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")")}}>
        <div style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:4}}>How can we help?</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.55)"}}>Find answers or get in touch with our team.</div>
      </div>
      <SectionHeader label="Quick actions"/>
      <SettingRow label="Chat with support" sub="Average response time: 2 hours" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Email us" sub="support@wifit.app" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Documentation" sub="Full guide to all features" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Frequently asked questions"/>
      {faqs.map(([q,a],i)=>(
        <div key={i} style={{borderBottom:("1px solid "+T.border)}}>
          <div onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{display:"flex",alignItems:"center",padding:"14px 20px",cursor:"pointer",gap:12}}>
            <div style={{flex:1,fontSize:14,fontWeight:500,color:T.text}}>{q}</div>
            <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:openFaq===i?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}><polyline points="1,3 6,9 11,3" stroke={T.muted} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
          </div>
          {openFaq===i&&<div style={{padding:"0 20px 16px",fontSize:13,color:T.muted,lineHeight:1.6}}>{a}</div>}
        </div>
      ))}
      <div style={{padding:"20px 20px 40px",textAlign:"center"}}>
        <div style={{fontSize:12,color:T.muted}}>WiFit v1.0.0 — Made with love for fitness lovers</div>
      </div>
    </PageShell>
  );
}

// ── PROFILE MENU (bottom sheet) ───────────────────────────────────
// ── THEME PICKER ──────────────────────────────────────────────────
function ProfileMenu({userName,isDark,onClose,onOpenProfile,onOpenSettings,onOpenPersonalization,onOpenUpgrade,onOpenHelp,onSignOut}){
  const T=useTheme();
  const initials=userName?userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";
  const rows=[
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><path d="M9 1l2 5h5l-4 3 1.5 5L9 11l-4.5 3L6 9 2 6h5z"/></svg>,label:"Upgrade plan",action:onOpenUpgrade,chevron:true},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 5v4l3 2"/></svg>,label:"Personalization",action:onOpenPersonalization,chevron:false},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="6" r="3"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>,label:"Profile",action:onOpenProfile,chevron:false},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="3"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.2 3.2l1.4 1.4M13.4 13.4l1.4 1.4M3.2 14.8l1.4-1.4M13.4 4.6l1.4-1.4"/></svg>,label:"Settings",action:onOpenSettings,chevron:false},
    {divider:true},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 6v3"/><circle cx="9" cy="13" r="0.5" fill={T.text}/></svg>,label:"Help",action:onOpenHelp,chevron:true},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"><path d="M7 16H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3"/><polyline points="12 13 16 9 12 5" stroke="#EF4444"/><line x1="16" y1="9" x2="7" y2="9" stroke="#EF4444"/></svg>,label:"Log out",action:onSignOut,chevron:false,red:true},
  ];
  return(
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(6px)"}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:T.card,borderRadius:"24px 24px 0 0",paddingBottom:34,boxShadow:"0 -8px 40px rgba(0,0,0,0.35)",border:("1px solid "+T.border),borderBottom:"none",animation:"slideUp 0.22s cubic-bezier(.4,0,.2,1)"}}>
        <div style={{display:"flex",justifyContent:"center",paddingTop:10,paddingBottom:4}}>
          <div style={{width:36,height:4,borderRadius:2,background:T.border}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px 14px",borderBottom:("1px solid "+T.border),cursor:"pointer"}} onClick={onOpenProfile}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,fontWeight:700,boxShadow:("0 3px 12px "+T.accentGlow),flexShrink:0}}>{initials}</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:T.text}}>{userName||"User"}</div>
              <div style={{fontSize:12,color:T.accent,fontWeight:600,marginTop:1}}>Plus</div>
            </div>
          </div>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><polyline points="2,2 8,8 2,14" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round"/></svg>
        </div>
        <div style={{padding:"8px 0"}}>
          {rows.map((r,i)=>{
            if(r.divider)return <div key={i} style={{height:1,background:T.border,margin:"6px 0"}}/>;
            return(
              <div key={i} onClick={r.action||undefined} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",cursor:r.action?"pointer":"default",transition:"background 0.1s"}}
                onMouseEnter={e=>r.action&&(e.currentTarget.style.background=T.surface)}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{width:28,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{r.icon}</div>
                <div style={{flex:1,fontSize:15,fontWeight:500,color:r.red?"#EF4444":T.text}}>{r.label}</div>
                {r.chevron&&<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ── In-progress workout snapshot ─────────────────────────────────
// An active workout is the only state in this app that is minutes of user input
// held purely in memory. Every tab renders as {tab===X && <Component/>}, so
// tapping Food between sets unmounted WorkoutTab and destroyed the session —
// per-set done flags, entered reps and weights, elapsed, accumulated PRs — with
// no warning. Persisting rather than lifting also covers the reload, the crash
// and the dropped phone, which in a gym are at least as likely as a tab switch.
//
// Keyed per user, matching the wifit_chat_<uid> precedent: four accounts exist,
// and an unkeyed snapshot would restore one person's workout for another on a
// shared device. handleSignOut clears these alongside the chat.
const WORKOUT_SNAPSHOT_MAX_AGE_MS=6*60*60*1000;
const workoutKey=(uid)=>uid?("wifit_workout_"+uid):null;

// No uid means no key, and no key means restore NOTHING. Reading or writing a
// bare "wifit_workout_undefined" would be a cross-account leak wearing a
// different name.
function readWorkoutSnapshot(key){
  if(!key)return null;
  try{
    const s=JSON.parse(localStorage.getItem(key)||"null");
    if(!s||!s.workout||!s.startedAt||!Array.isArray(s.sets))return null;
    // Staleness is measured from when the work started, not when it was last
    // saved: a session left open overnight must not resurrect. 6h is longer
    // than any real workout, and an age rule beats a calendar-day rule — the
    // latter would misfire on exactly the 11pm session that `today`-computed-
    // once already mishandles (known issue #8).
    if(Date.now()-s.startedAt>WORKOUT_SNAPSHOT_MAX_AGE_MS){localStorage.removeItem(key);return null;}
    return s;
  }catch{return null;}
}
function clearWorkoutSnapshot(key){if(key){try{localStorage.removeItem(key);}catch{}}}

const INITIAL_SUPPS=[
  {k:"a",name:"Whey Protein",sub:"30g · Post-workout",dot:"#A855F7"},
  {k:"b",name:"Creatine",sub:"5g · With breakfast",dot:"#06B6D4"},
  {k:"c",name:"Vitamin D3",sub:"2000 IU · Morning",dot:"#F59E0B"},
  {k:"d",name:"Omega-3",sub:"1000mg · With dinner",dot:"#10B981"},
  {k:"e",name:"Magnesium",sub:"400mg · Before bed",dot:"#F97316"},
  {k:"f",name:"Zinc",sub:"30mg · Before bed",dot:"#10B981"},
];

// ── PROGRESS PAGE ──────────────────────────────────────────────────
function ProgressPage({uid,goals,suppList=[],userName,log={},suppTaken={},workoutHistory=[],waterOz=0,weightLog=[],logWeight,onProfileOpen}){
  const T=useTheme();
  const [range,setRange]=useState("30d");
  const [dailyData,setDailyData]=useState([]);
  const [monthly,setMonthly]=useState([]); // weight_monthly rows, all time
  // Retry was setRange(r=>r): same value, React bails out, nothing re-ran.
  const [reloadKey,setReloadKey]=useState(0);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState(false);
  const [newWeight,setNewWeight]=useState("");
  const [savingWeight,setSavingWeight]=useState(false);

  const dayCount=range==="7d"?7:range==="30d"?30:90;

  useEffect(()=>{
    let cancel=false;
    (async()=>{
      setLoading(true);
      const today=new Date();
      const start=new Date();
      start.setDate(today.getDate()-(dayCount-1));
      const fmt=(d)=>localDate(d);
      const startStr=fmt(start);
      const endStr=fmt(today);
      try{
        const okEmpty={ok:true,rows:[]};
        // One definition per number: daily_summary (kcal/macros, workouts,
        // supps taken/due, weight) is computed in Postgres — the client only
        // keeps the date spine and joins by day. supplement_due_from gives the
        // denominator for days the view has no row for. weight_monthly is all
        // time and bounded by months, never by a row ceiling. exercise_pr_events
        // is which lifts beat every earlier session (#28).
        const thisMonthStart=localDate().slice(0,7)+"-01";
        const [dr,fr,mr,pr]=await Promise.all([
          uid?sb.selectAuth("daily_summary","user_id=eq."+uid+"&day=gte."+startStr+"&day=lte."+endStr,{order:"day.asc"}):okEmpty,
          uid?sb.selectAuth("supplement_due_from","user_id=eq."+uid):okEmpty,
          uid?sb.selectAuth("weight_monthly","user_id=eq."+uid,{order:"month.asc"}):okEmpty,
          uid?sb.selectAuth("exercise_pr_events","user_id=eq."+uid+"&completed_date=gte."+thisMonthStart+"&completed_date=lte."+endStr+"&select=completed_date,name",{limit:500}):okEmpty,
        ]);
        if(cancel)return;
        // Failed reads must not render as "0 avg calories, 0% adherence".
        if(!dr.ok||!fr.ok||!mr.ok||!pr.ok){setLoadError(true);setLoading(false);return;}
        setLoadError(false);
        const dueFrom=fr.rows.map(r=>r.due_from);
        const byDay=Object.fromEntries(dr.rows.map(r=>[r.day,r]));
        // Build per-day buckets
        const days=[];
        for(let i=dayCount-1;i>=0;i--){
          const d=new Date();d.setDate(today.getDate()-i);
          const key=fmt(d);
          const r=byDay[key];
          days.push({date:key,label:d.toLocaleDateString("en-US",{month:"numeric",day:"numeric"}),
            cal:r?r.kcal:0,protein:r?r.protein_g:0,carbs:r?r.carbs_g:0,fat:r?r.fat_g:0,
            workoutDone:!!r&&r.workout_count>0,workoutName:r?.workout_names||"",
            suppCount:r?r.supps_taken:0,
            // Same rule as the view's supps_due (created_at::date or first log,
            // whichever is earlier); the view has no row for an empty day.
            suppDue:r?r.supps_due:dueFrom.filter(df=>df<=key).length,
            prs:[],weight:r&&r.weight_lbs!==null&&r.weight_lbs!==undefined?Number(r.weight_lbs):null});
        }
        pr.rows.forEach(r=>{
          const day=days.find(d=>d.date===r.completed_date);
          if(day)day.prs.push(r.name);
        });
        setMonthly(mr.rows.map(m=>({month:m.month,first:Number(m.first_lbs),last:Number(m.last_lbs),entries:m.entries})));
        setDailyData(days);
      }catch(e){
        console.error("ProgressPage load error:",e);
        setLoadError(true);
      }
      setLoading(false);
    })();
    return()=>{cancel=true;};
  },[uid,range,dayCount,weightLog,reloadKey]);

  // Stats
  const stats=useMemo(()=>{
    const valid=dailyData;
    if(valid.length===0)return null;
    const totalCal=valid.reduce((a,d)=>a+d.cal,0);
    const daysWithCal=valid.filter(d=>d.cal>0).length;
    const avgCal=daysWithCal>0?Math.round(totalCal/daysWithCal):0;
    const workoutDays=valid.filter(d=>d.workoutDone).length;
    const totalSuppsTaken=valid.reduce((a,d)=>a+d.suppCount,0);
    // Denominator counts a supplement only from the day it was due (D2): adding
    // one on day 29 of a 30-day window no longer scores 29 misses.
    const totalSuppsDue=valid.reduce((a,d)=>a+d.suppDue,0);
    const suppAdherence=totalSuppsDue>0?Math.round((totalSuppsTaken/totalSuppsDue)*100):0;
    // Weight change (this range)
    const weighIns=valid.filter(d=>d.weight!==null).map(d=>({date:d.date,lbs:d.weight}));
    let weightChange=null,startW=null,endW=null;
    if(weighIns.length>=2){
      startW=weighIns[0].lbs;
      endW=weighIns[weighIns.length-1].lbs;
      weightChange=endW-startW;
    }
    // Best (biggest) change in a calendar month, all time — from weight_monthly
    let bestMonth=null,bestChange=0;
    monthly.forEach(m=>{
      if(m.entries>=2){
        const ch=m.last-m.first;
        if(Math.abs(ch)>Math.abs(bestChange)){bestChange=ch;bestMonth=m.month;}
      }
    });
    // All PRs in current month
    const thisMonth=localDate().slice(0,7);
    const monthPRs=[];
    valid.forEach(d=>{
      if(d.date.startsWith(thisMonth)&&d.prs&&d.prs.length>0){
        d.prs.forEach(pr=>monthPRs.push({date:d.date,name:typeof pr==="string"?pr:(pr.name||"PR")}));
      }
    });
    return{avgCal,workoutDays,suppAdherence,weightChange,startW,endW,bestMonth,bestChange,monthPRs};
  },[dailyData,monthly]);

  // Chart bounds
  const calMax=Math.max(...dailyData.map(d=>d.cal),goals.cal||2200,1)*1.1;
  const weights=dailyData.filter(d=>d.weight!==null).map(d=>d.weight);
  const wMin=weights.length>0?Math.min(...weights)-2:0;
  const wMax=weights.length>0?Math.max(...weights)+2:1;

  // No local range check: logWeight owns validation (finite, 0<w<=1500) and is
  // the only thing that can explain a rejection to the user. The guard here was
  // both silent and narrower than the owner's — 800 lbs did nothing at all, with
  // no message — and it cleared the input even when the save then failed.
  const handleLogWeight=async()=>{
    if(savingWeight)return;
    setSavingWeight(true);
    const ok=await logWeight(newWeight);
    setSavingWeight(false);
    if(!ok)return; // logWeight already surfaced the reason and rolled back
    setNewWeight("");
  };

  return(
    <div style={{paddingBottom:80,minHeight:"100vh",fontFamily:"-apple-system,sans-serif"}}>
      {loadError&&(
        <div data-testid="progress-failed" style={{margin:"12px 16px 0",padding:"10px 14px",borderRadius:12,background:T.accentPill,border:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{fontSize:12,color:T.text}}>Couldn't load this range — the numbers below are not yours.</div>
          <div onClick={()=>setReloadKey(k=>k+1)} style={{fontSize:12,fontWeight:700,color:T.accent,cursor:"pointer"}}>Retry</div>
        </div>
      )}
      {/* Sticky header */}
      <div style={{position:"sticky",top:0,zIndex:50,background:T.bg+"e8",backdropFilter:"blur(20px)",borderBottom:("1px solid "+T.border),padding:"16px 16px 12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,color:T.accentSoft,fontWeight:600,letterSpacing:2,textTransform:"uppercase",opacity:0.8,marginBottom:2}}>Your journey</div>
            <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>Progress 📈</div>
          </div>
          {onProfileOpen&&(
            <div onClick={onProfileOpen} style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>{(userName||"U").charAt(0).toUpperCase()}</div>
          )}
        </div>
      </div>

      <div style={{padding:"14px 16px"}}>
        {/* Range toggle */}
        <div style={{display:"flex",gap:6,background:T.surface,padding:4,borderRadius:12,marginBottom:16}}>
          {[["7d","7 Days"],["30d","30 Days"],["90d","90 Days"]].map(([id,label])=>(
            <div key={id} onClick={()=>setRange(id)} style={{flex:1,textAlign:"center",padding:"8px 0",borderRadius:9,cursor:"pointer",background:range===id?"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")":"transparent",color:range===id?"#fff":T.muted,fontSize:12,fontWeight:600,transition:"all 0.2s"}}>{label}</div>
          ))}
        </div>

        {/* Weight quick log */}
        <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:18}}>⚖️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Body weight</div>
              <div style={{fontSize:11,color:T.muted}}>{weightLog.length>0?"Last: "+weightLog[weightLog.length-1].lbs+" lbs":"No weigh-ins yet"}</div>
            </div>
            <input type="number" inputMode="decimal" placeholder="lbs" value={newWeight} onChange={e=>setNewWeight(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogWeight()}
              style={{width:70,padding:"8px 10px",background:T.surface,border:("1px solid "+T.border),borderRadius:10,color:T.text,fontSize:13,outline:"none",textAlign:"center"}}/>
            <button onClick={handleLogWeight} disabled={!newWeight||savingWeight} style={{padding:"8px 14px",background:newWeight?"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")":T.surface,border:"none",borderRadius:10,color:newWeight?"#fff":T.muted,fontSize:12,fontWeight:700,cursor:newWeight&&!savingWeight?"pointer":"not-allowed"}}>{savingWeight?"…":"Log"}</button>
          </div>
        </div>

        {loading?(
          <div style={{textAlign:"center",padding:40,color:T.muted,fontSize:13}}>Loading your progress…</div>
        ):(
          <>
            {/* Summary stat cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Avg calories</div>
                <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>{stats?.avgCal||0}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>kcal/day · goal {goals.cal||2200}</div>
              </div>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Workouts</div>
                <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>{stats?.workoutDays||0}<span style={{fontSize:13,color:T.muted}}>/{dayCount}</span></div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>days trained</div>
              </div>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Supp adherence</div>
                <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>{stats?.suppAdherence||0}<span style={{fontSize:13,color:T.muted}}>%</span></div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>of stack taken</div>
              </div>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Weight change</div>
                {stats?.weightChange!==null&&stats?.weightChange!==undefined?(
                  <>
                    <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.5px",color:stats.weightChange<0?"#22C55E":stats.weightChange>0?"#F59E0B":T.text}}>{stats.weightChange>0?"+":""}{stats.weightChange.toFixed(1)}<span style={{fontSize:13,color:T.muted}}> lbs</span></div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>{stats.startW}→{stats.endW} lbs</div>
                  </>
                ):(
                  <>
                    <div style={{fontSize:22,fontWeight:700,color:T.muted,letterSpacing:"-0.5px"}}>—</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>Need 2+ weigh-ins</div>
                  </>
                )}
              </div>
            </div>

            {/* Weight trend chart */}
            {weights.length>=2&&(
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.text}}>Weight trend</div>
                  <div style={{fontSize:10,color:T.muted}}>{wMin.toFixed(0)}–{wMax.toFixed(0)} lbs</div>
                </div>
                <svg viewBox="0 0 300 100" style={{width:"100%",height:100,display:"block"}}>
                  <polyline fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    points={dailyData.map((d,i)=>{
                      if(d.weight===null)return null;
                      const x=(i/(dailyData.length-1))*290+5;
                      const y=95-((d.weight-wMin)/(wMax-wMin||1))*85;
                      return x+","+y;
                    }).filter(Boolean).join(" ")}/>
                  {dailyData.map((d,i)=>{
                    if(d.weight===null)return null;
                    const x=(i/(dailyData.length-1))*290+5;
                    const y=95-((d.weight-wMin)/(wMax-wMin||1))*85;
                    return <circle key={i} cx={x} cy={y} r="2.5" fill={T.accent}/>;
                  })}
                </svg>
              </div>
            )}

            {/* Calorie bar chart */}
            <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text}}>Calories per day</div>
                <div style={{fontSize:10,color:T.muted}}>Goal: {goals.cal||2200}</div>
              </div>
              <div style={{display:"flex",gap:2,height:80,alignItems:"flex-end"}}>
                {dailyData.map((d,i)=>{
                  const h=calMax>0?(d.cal/calMax)*100:0;
                  const onGoal=d.cal>0&&Math.abs(d.cal-(goals.cal||2200))<=(goals.cal||2200)*0.1;
                  return(
                    <div key={i} title={d.label+": "+d.cal+" kcal"} style={{flex:1,height:"100%",display:"flex",alignItems:"flex-end"}}>
                      <div style={{width:"100%",height:h+"%",background:d.cal===0?T.surface:onGoal?"linear-gradient(180deg,"+T.accent+","+T.accentSoft+")":T.accent+"66",borderRadius:"3px 3px 0 0",minHeight:d.cal>0?2:0,transition:"all 0.2s"}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.muted,marginTop:6}}>
                <div>{dailyData[0]?.label}</div>
                <div>{dailyData[dailyData.length-1]?.label}</div>
              </div>
            </div>

            {/* Workout consistency */}
            <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Training consistency</div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {dailyData.map((d,i)=>(
                  <div key={i} title={d.label+(d.workoutDone?" · "+(d.workoutName||"Trained"):" · Rest")}
                    style={{width:"calc(100%/15 - 3px)",aspectRatio:"1",borderRadius:4,background:d.workoutDone?"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")":T.surface,border:("1px solid "+T.border),boxShadow:d.workoutDone?"0 0 6px "+T.accentGlow:"none"}}/>
                ))}
              </div>
            </div>

            {/* Monthly highlights */}
            <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>📅 This month's highlights</div>
              {/* Best weight change */}
              {stats?.bestMonth?(
                <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:18}}>{stats.bestChange<0?"📉":"📈"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.text}}>Best weight change · all time</div>
                    <div style={{fontSize:10,color:T.muted}}>{stats.bestMonth} · {stats.bestChange>0?"+":""}{stats.bestChange.toFixed(1)} lbs</div>
                  </div>
                </div>
              ):(
                <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,marginBottom:10,fontSize:11,color:T.muted}}>Log weight regularly to track monthly changes (all time)</div>
              )}
              {/* PRs this month */}
              <div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>🏆 Workout PRs · this month</div>
              {stats?.monthPRs?.length>0?stats.monthPRs.slice(0,5).map((pr,i)=>(
                <div key={i} style={{padding:"8px 12px",background:T.surface,borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{pr.name}</div>
                  <div style={{fontSize:10,color:T.muted}}>{pr.date.slice(5)}</div>
                </div>
              )):(
                <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,fontSize:11,color:T.muted}}>No PRs logged yet this month — keep training!</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────
export default function App(){
  const [authState,setAuthState]=useState("loading");
  const [isDark,setIsDarkState]=useState(false);
  const [themeFam,setThemeFamState]=useState(DEFAULT_THEME);
  const T=resolveTheme(themeFam+"_"+(isDark?"dark":"light")).T;

  // sb never throws, so the old try/catch here caught nothing. Check the row;
  // on failure put the previous theme back so the screen matches the database.
  const saveTheme=async(fam,dark,prev)=>{
    const uid=sb.getUser()?.id;
    if(!uid)return;
    const row=await sb.upsert("profiles",{id:uid,theme:fam+"_"+(dark?"dark":"light"),updated_at:new Date().toISOString()});
    if(!row){
      setThemeFamState(prev.fam);setIsDarkState(prev.dark);
      showError("Theme couldn't be saved — reverted.");
    }
  };

  // Mode-locked palettes ignore the toggle entirely: the toggles are hidden,
  // but a stale closure must not be able to persist "pastel_dark".
  const setIsDark=(valOrFn)=>{
    if(LOCKED_FAMILIES.has(themeFam))return;
    const next=resolveDark(isDark,valOrFn);
    setIsDarkState(next);saveTheme(themeFam,next,{fam:themeFam,dark:isDark});
  };
  const setThemeFam=(fam)=>{
    const next=LOCKED_FAMILIES.has(fam)?THEME_META[fam].mode==="dark":isDark;
    setThemeFamState(fam);setIsDarkState(next);saveTheme(fam,next,{fam:themeFam,dark:isDark});
  };
  const [tab,setTab]=useState("home");
  const [log,setLog]=useState(SEED);
  const [aiOpen,setAiOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  const [quickMode,setQuickMode]=useState("food");
  // Home: the six prior days of this Mon–Sun week, read once. null means the
  // read FAILED and the rail says so with a Retry — never rendered as empty,
  // which is how a 401 once became "new user". Today is always live.
  const [weekHistory,setWeekHistory]=useState({});
  const [profileCreatedAt,setProfileCreatedAt]=useState(null);
  const [pendingStartPlanId,setPendingStartPlanId]=useState(null);
  // Sections whose mount read failed (see loadUserData's read()). Non-empty
  // shows the top banner; writes that would be destructive against an empty
  // state check it. Retry re-runs the full load.
  const [loadFailures,setLoadFailures]=useState([]);
  const sectionFailed=(label)=>loadFailures.includes(label);
  const loadWeekHistory=async(forUid)=>{
    const u=forUid||sb.getUser()?.id; if(!u)return;
    const days=weekDays(new Date()); const mon=days[0].ds;
    const yd=new Date(); yd.setDate(yd.getDate()-1); const yday=localDate(yd);
    if(mon>yday){setWeekHistory({});return;} // Monday: nothing prior this week
    const range=(col)=>"user_id=eq."+u+"&"+col+"=gte."+mon+"&"+col+"=lte."+yday;
    const [f,w,sl]=await Promise.all([
      sb.selectAuth("food_log",range("logged_date")+"&select=logged_date,grams,per100_cal",{limit:1000}),
      sb.selectAuth("water_log",range("log_date")+"&select=log_date,oz",{limit:7}),
      sb.selectAuth("supplement_log",range("log_date")+"&select=log_date,taken",{limit:500}),
    ]);
    if(!f.ok||!w.ok||!sl.ok){setWeekHistory(null);return;} // any failure is null (Retry), never {}
    setWeekHistory(reduceWeekRows({food:f.rows,water:w.rows,supp:sl.rows}));
  };
  const [quickAction,setQuickAction]=useState(null);
  const onAddOpen=(key)=>{
    // Fan items that navigate: honest as long as they land where the user can act.
    if(key==="workout"||key==="session"){setTab("workout");return;} // QuickAddPanel has no workout section
    if(key==="newsupp"){setTab("supps");return;}
    setQuickMode(key==="water"?"water":key==="supp"?"supps":"food");
    setQuickAction(key==="scan"?"scan":null); // "Scan" opens the panel WITH the scanner up, not the search view
    setQuickOpen(true);
  };
  const [customFoods,setCustomFoods]=useState([]);
  const [suppList,setSuppList]=useState([]);
  const [suppTaken,setSuppTaken]=useState({});
  const [waterOz,setWaterOzState]=useState(0);
  const [weightLog,setWeightLog]=useState([]); // [{date:"2026-05-08",lbs:175}]
  const setWaterOz=async(valOrFn)=>{
    // The upsert REPLACES the day's oz. Against an unloaded 0 it would
    // overwrite a real 48 with 8.
    if(sectionFailed("water")){showError("Today's water didn't load — tap Retry at the top first.");return;}
    const next=typeof valOrFn==="function"?valOrFn(waterOz):valOrFn;
    const clamped=Math.min(GOAL_OZ,Math.max(0,next));
    const prevOz=waterOz;
    setWaterOzState(clamped);
    if(!uid)return;
    try{
      const row=await sb.upsert("water_log",{user_id:uid,log_date:today,oz:clamped},{onConflict:"user_id,log_date"});
      if(!row)throw new Error("upsert returned no row");
    }catch{
      setWaterOzState(prevOz);
      showError("Water couldn't be saved. Check your connection.");
    }
  };
  const [history,setHistory]=useState([]);
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);
  const [profilePageOpen,setProfilePageOpen]=useState(false);
  const [settingsPageOpen,setSettingsPageOpen]=useState(false);
  const [personalizationPageOpen,setPersonalizationPageOpen]=useState(false);
  const [upgradePageOpen,setUpgradePageOpen]=useState(false);
  const [helpPageOpen,setHelpPageOpen]=useState(false);
  const closeAll=()=>{setProfileMenuOpen(false);setProfilePageOpen(false);setSettingsPageOpen(false);setPersonalizationPageOpen(false);setUpgradePageOpen(false);setHelpPageOpen(false);};
  const [userName,setUserName]=useState("");
  const [goals,setGoals]=useState({cal:2200,protein:140,carbs:180,fat:78});

  const today=localDate();

  // Resolve the session to a definite state before any data load runs.
  useEffect(()=>{
    // Lets a mid-session refresh failure inside any sb.* call route to sign-in.
    setAuthLostHandler(()=>setAuthState("auth"));
    (async()=>{
      try{
        const res=await resolveSession();
        if(res.status==="logged-out"||!res.session?.user?.id){setAuthState("auth");return;}
        await loadUserData(res.session.user.id);
      }catch(e){
        // Without this the spinner would hang forever on an unexpected throw.
        console.error("session resolve failed:",e);
        setAuthState("auth");
      }
    })();
  },[]);

  const loadUserData=async(uid)=>{
    // Has identity been established? Decides where the catch below routes: a
    // failure after the profile loaded is a secondary-load problem and the app
    // stays usable; a failure before it means we never learned who this user is,
    // so sign-in — never onboarding, which is the one path that would overwrite
    // a real profile. Shared by both callers (mount and post-sign-in).
    let profileLoaded=false;
    try{
      // selectAuth, not select: select() turns a 401 into [], which reads as
      // "new user" and sends an expired session to the onboarding wizard.
      const {authError,rows:profiles}=await sb.selectAuth("profiles","id=eq."+uid);
      if(authError){setAuthState("auth");return;}
      if(profiles&&profiles.length>0){
        profileLoaded=true;
        // Every read below goes through selectAuth and keys on ok. null means
        // the read FAILED (any non-2xx or network) and the section is listed
        // in loadFailures — the banner offers Retry and the writes that would
        // be destructive against an empty state are guarded. [] means empty.
        const failed=[];
        const read=async(label,table,filter,opts)=>{const r=await sb.selectAuth(table,filter,opts);if(!r.ok){failed.push(label);return null;}return r.rows;};
        const p=profiles[0];
        setUserName(p.name||"");
        setProfileCreatedAt(p.created_at||null);
        loadWeekHistory(uid);
        setGoals({cal:p.cal_goal||2200,protein:p.protein_goal||140,carbs:p.carbs_goal||180,fat:p.fat_goal||78});
        if(p.theme){
          const r=resolveTheme(p.theme);
          setThemeFamState(r.family);
          setIsDarkState(r.dark);
        }
        // Food log for today
        const foodRows=await read("food","food_log","user_id=eq."+uid+"&logged_date=eq."+today);
        if(foodRows?.length>0){
          const nl={breakfast:[],lunch:[],dinner:[],snacks:[]};
          foodRows.forEach(r=>{
            const item={id:r.id,name:r.food_name,grams:r.grams,color:r.color||COLORS[0],per100:{cal:r.per100_cal,protein:r.per100_protein,carbs:r.per100_carbs,fat:r.per100_fat,fiber:r.per100_fiber||0,sugar:r.per100_sugar||0,sodium:r.per100_sodium||0}};
            if(nl[r.meal_slot])nl[r.meal_slot].push(item);
          });
          setLog(nl);
        }
        // Custom foods
        const cf=await read("custom foods","custom_foods","user_id=eq."+uid,{order:"created_at.desc"});
        if(cf?.length>0)setCustomFoods(cf.map(customFoodFromRow));
        // Supplement stack
        const suppRows=await read("supplements","supplement_stack","user_id=eq."+uid,{order:"sort_order.asc"});
        if(suppRows?.length>0){
          // Today's log must load with the stack: without it every capsule
          // shows untaken and a tap upserts taken:false over a true row.
          const suppLog=await read("supplements","supplement_log","user_id=eq."+uid+"&log_date=eq."+today);
          if(suppLog!==null){
            setSuppList(suppRows.map(s=>({k:s.id,name:s.name,sub:s.sub||"",dot:s.dot_color||"#888",category:s.category||null,note:s.note||null,reminderTime:s.reminder_time,reminderEnabled:s.reminder_enabled})));
            const taken={};
            suppRows.forEach(s=>{taken[s.id]=false;});
            suppLog.forEach(l=>{taken[l.supplement_id]=l.taken;});
            setSuppTaken(taken);
          }
        }
        // Workout history
        // selectAuth, not select: a failed read must NOT become an empty
        // history. Empty bests means every lift is "a first" and a genuine
        // PR is persisted as isPR:false — worse than no value. On failure the
        // status is "failed" and WorkoutTab blocks Start behind a Retry.
        const {ok:histOk,rows:sessions}=await sb.selectAuth("workout_sessions","user_id=eq."+uid,{order:"created_at.desc",limit:20});
        const bestsOk=histOk&&await loadBests(uid);
        setHistoryStatus(!histOk||!bestsOk?"failed":"ready");
        if(sessions?.length>0){
          setHistory(sessions.map(sessionFromRow));
        }
        // Water intake today
        const waterRows=await read("water","water_log","user_id=eq."+uid+"&log_date=eq."+today);
        if(waterRows?.length>0)setWaterOzState(waterRows[0].oz||0);
        // Weight log (last 30 days)
        // Newest 30, then reversed: asc+limit returned the OLDEST 30, so from
        // weigh-in #31 on, Home's strip and the coach froze on old data. This
        // read serves today's entry; range/all-time history is read where it
        // is displayed (Progress), never through a row ceiling.
        const weightRows=await read("weight","body_weight_log","user_id=eq."+uid,{order:"log_date.desc",limit:30});
        if(weightRows?.length>0)setWeightLog(weightRows.map(w=>({date:w.log_date,lbs:w.weight_lbs})).reverse());
        // Workout plans
        const planRows=await read("plans","workout_plans","user_id=eq."+uid,{order:"sort_order.asc"});
        // A failed plans read must NOT leave the INITIAL_WORKOUTS seed on screen
        // as if the user were new: editing a seed would PATCH id=eq.w1 at a
        // uuid, and the Home card would present starter content as theirs.
        if(planRows===null)setWorkouts([]);
        if(planRows?.length>0){
          setWorkouts(planRows.map(p=>({
            id:p.id,
            name:p.name,
            tag:p.tag||"Full Body",
            level:p.level||"Intermediate",
            estMin:p.est_min||45,
            scheduledDay:p.scheduled_day||null,
            exercises:p.exercises||[],
          })));
        }
        setLoadFailures(failed);
        setAuthState("app");
      }else{
        setAuthState("onboarding");
      }
    }catch(e){
      console.error("loadUserData error:",e);
      setAuthState(profileLoaded?"app":"auth");
    }
  };

  const handleAuth=(user,isNew)=>{
    if(user?.id==="demo"){
      // Demo mode — skip onboarding, go straight to app
      setUserName("Johnny");
      setGoals({cal:2200,protein:140,carbs:180,fat:78});
      setAuthState("app");
      return;
    }
    if(isNew)setAuthState("onboarding");
    else loadUserData(user.id);
  };

  const handleSignOut=async()=>{
    await sb.signOut();
    // Clear persisted chat and any in-progress workout. Both are keyed per user,
    // and on a shared device leaving either behind would hand the next person
    // the previous one's data.
    try{Object.keys(localStorage).filter(k=>k.startsWith("wifit_chat_")||k.startsWith("wifit_workout_")).forEach(k=>localStorage.removeItem(k));}catch{}
    setWorkoutInProgress(false);
    setAuthState("auth");
    setLog(SEED);
    setCustomFoods([]);
    setSuppList([]);
    setSuppTaken({});
    setHistory([]);
    setWaterOzState(0);
    setWeightLog([]);
    setWeekHistory({});setProfileCreatedAt(null);setPendingStartPlanId(null);
    setUserName("");
    setGoals({cal:2200,protein:140,carbs:180,fat:78});
    setIsDarkState(false);
    setThemeFamState(DEFAULT_THEME);
    setWorkouts(INITIAL_WORKOUTS);
    closeAll();
  };

  // DB-synced actions
  const uid=sb.getUser()?.id;

  const addFoodItem=async(slot,item)=>{
    // grams is NOT NULL in food_log, and JSON.stringify drops undefined keys —
    // an unparsed gram amount would 400 instead of saving. Reject it up front.
    const grams=Number(item?.grams);
    if(!item?.name||!item?.per100||!Number.isFinite(grams)||grams<=0){
      showError("Couldn't log "+(item?.name||"that food")+" — no valid gram amount.");
      return;
    }
    if(grams>MAX_FOOD_GRAMS){
      showError("Couldn't log "+item.name+" — "+grams+" g is over the "+MAX_FOOD_GRAMS+" g limit for one entry.");
      return;
    }
    setLog(p=>({...p,[slot]:[...p[slot],item]}));
    if(!uid)return;
    try{
      const row=await sb.insert("food_log",{user_id:uid,logged_date:today,meal_slot:slot,food_name:item.name,brand:item.brand||null,grams,per100_cal:item.per100.cal,per100_protein:item.per100.protein,per100_carbs:item.per100.carbs,per100_fat:item.per100.fat,per100_fiber:item.per100.fiber||0,per100_sugar:item.per100.sugar??null,per100_sodium:item.per100.sodium||0,color:item.color||COLORS[0]});
      if(!row)throw new Error("insert returned no row");
      // Carry the database id so a same-session delete can reach the row.
      setLog(p=>({...p,[slot]:withDbId(p[slot],item,row)}));
    }catch{
      setLog(p=>({...p,[slot]:p[slot].filter(i=>i!==item)}));
      showError("Food couldn't be saved. Check your connection.");
    }
  };

  // Returns whether the row landed. sb.insert never throws — the old try/catch
  // here was unreachable — so the caller's "saved" toast fired on a null.
  const addCustomFoodDB=async(food)=>{
    setCustomFoods(p=>[food,...p]);
    if(!uid)return true;
    try{
      const row=await sb.insert("custom_foods",{user_id:uid,name:food.name,brand:food.brand||null,serving_g:food.servingG,serving_qty:food.servingQty??null,serving_unit:food.servingUnit||"g",per100_cal:food.per100.cal,per100_protein:food.per100.protein,per100_carbs:food.per100.carbs,per100_fat:food.per100.fat,per100_fiber:food.per100.fiber||0,per100_sugar:food.per100.sugar||0,per100_sodium:food.per100.sodium||0});
      if(!row)throw new Error("insert returned no row");
      setCustomFoods(p=>withDbId(p,food,row)); // keep the uuid: edit/delete need it
      return true;
    }catch{
      setCustomFoods(p=>p.filter(f=>f!==food));
      showError("Custom food couldn't be saved. Check your connection.");
      return false;
    }
  };

  const addSuppToList=async(item)=>{
    const tempK=item.k||("s"+Date.now());
    // Optimistically add with temp key
    setSuppList(prev=>{if(prev.find(s=>s.k===tempK))return prev;return [...prev,{k:tempK,name:item.name,sub:item.sub||"",dot:item.dot||"#888",category:item.category||null,note:item.note||null,reminderEnabled:item.reminderEnabled||false,reminderTime:item.reminderTime||"08:00"}];});
    setSuppTaken(prev=>prev[tempK]!==undefined?prev:{...prev,[tempK]:false});
    if(!uid)return;
    try{
      const row=await sb.insert("supplement_stack",{user_id:uid,name:item.name,sub:(item.sub||"").trim()||null,dot_color:item.dot||"#888",category:item.category||null,note:item.note||null,sort_order:suppList.length,reminder_enabled:item.reminderEnabled||false,reminder_time:item.reminderTime||null}); // sub: blank is null, not ""
      if(!row)throw new Error("insert returned no row");
      if(row.id&&row.id!==tempK){
        // Replace temp key with real DB id
        setSuppList(prev=>prev.map(s=>s.k===tempK?{...s,k:row.id}:s));
        setSuppTaken(prev=>{const n={...prev};n[row.id]=n[tempK]||false;delete n[tempK];return n;});
      }
    }catch{
      setSuppList(prev=>prev.filter(s=>s.k!==tempK));
      setSuppTaken(prev=>{const n={...prev};delete n[tempK];return n;});
      showError("Supplement couldn't be saved. Check your connection.");
    }
  };

  const toggleSuppTaken=async(k,val)=>{
    if(sectionFailed("supplements")){showError("Your supplements didn't load — tap Retry at the top first.");return;}
    // A supplement still saving has a local key ("m…"/"s…"/"ai…"); supplement_id
    // is a uuid, so the upsert would 400. Refuse rather than launder (S1).
    if(!hasDbId({id:k})){showError("That supplement is still saving — try again in a moment.");return;}
    setSuppTaken(p=>({...p,[k]:val}));
    if(!uid)return;
    try{
      // UNIQUE is (supplement_id, log_date) — no user_id. Naming user_id here
      // would 42P10, since no unique constraint matches that column set.
      const row=await sb.upsert("supplement_log",{user_id:uid,supplement_id:k,log_date:today,taken:val},{onConflict:"supplement_id,log_date"});
      if(!row)throw new Error("upsert returned no row");
    }catch{
      setSuppTaken(p=>({...p,[k]:!val}));
      showError("Supplement couldn't be updated. Check your connection.");
    }
  };

  const logWeight=async(lbs)=>{
    // weight_lbs is NOT NULL; parseFloat garbage becomes NaN, which JSON
    // serializes as null → swallowed 400. Reject before touching state.
    const w=Number(lbs);
    if(!Number.isFinite(w)||w<=0||w>1500){showError("Couldn't log weight — enter your weight in lbs.");return false;}
    const prevEntry=weightLog.find(e=>e.date===today);
    const entry={date:today,lbs:w};
    setWeightLog(prev=>{const filtered=prev.filter(e=>e.date!==today);return[...filtered,entry].sort((a,b)=>a.date.localeCompare(b.date));});
    if(!uid)return true;
    try{
      const row=await sb.upsert("body_weight_log",{user_id:uid,log_date:today,weight_lbs:w},{onConflict:"user_id,log_date"});
      if(!row)throw new Error("upsert returned no row");
      return true;
    }catch{
      setWeightLog(prev=>{const filtered=prev.filter(e=>e.date!==today);return prevEntry?[...filtered,prevEntry].sort((a,b)=>a.date.localeCompare(b.date)):filtered;});
      showError("Weight couldn't be saved. Check your connection.");
      return false;
    }
  };
  const saveWorkoutSession=async(session)=>{
    // workout_name is NOT NULL — a nameless session would 400 after the
    // optimistic update and look saved.
    const wname=(session?.workoutName||"").trim();
    if(!wname){showError("Couldn't save workout — it has no name.");return;}
    setHistory(p=>[session,...p]);
    if(!uid)return;
    try{
      // completed_date is the day the work STARTED, carried on the session, not
      // `today` — which is computed once per App mount and would stamp a resumed
      // or past-midnight session with whatever day the app last mounted on.
      const completedDate=session.startedAt?localDate(new Date(session.startedAt)):today;
      const row=await sb.insert("workout_sessions",{user_id:uid,workout_name:wname,completed_date:completedDate,duration_secs:session.duration,sets_completed:session.setsCompleted,total_sets:session.totalSets,exercises:session.exercises||[]});
      if(!row)throw new Error("insert returned no row");
      // Carry the row's uuid into state (the food-delete lesson): a session
      // edit/delete (#25) needs it, and a local "h<ts>" id would 400 at a uuid.
      setHistory(p=>withDbId(p,session,row));
      // The row is the source of truth for bests; re-read the view rather than
      // bumping a client copy. A failed re-read pauses Start like any other.
      await loadBests(uid);
    }catch{
      setHistory(p=>p.filter(s=>s!==session));
      showError("Workout couldn't be saved. Check your connection.");
    }
  };

  const [workouts,setWorkouts]=useState(INITIAL_WORKOUTS);
  // bests is assigned ONLY from the exercise_bests view (mount, retry, after a
  // finish lands). No code path derives it from session data on the client —
  // a cache with its own writer is what made the PR bugs possible. A failed
  // read is "failed", never {}: {} means "new lifter" and would stamp a
  // genuine PR as false, permanently.
  const [bests,setBests]=useState({});
  const [historyStatus,setHistoryStatus]=useState("loading"); // loading | ready | failed
  // PR events (which session/exercise beat every earlier session) come from
  // the exercise_pr_events view, keyed by session id for the history cards.
  const [prEvents,setPrEvents]=useState({});
  const loadBests=async(u)=>{
    const [b,e]=await Promise.all([
      sb.selectAuth("exercise_bests","user_id=eq."+u+"&select=name,best_lbs",{limit:1000}),
      sb.selectAuth("exercise_pr_events","user_id=eq."+u+"&select=session_id,name",{limit:1000}),
    ]);
    if(!b.ok||!e.ok){setHistoryStatus("failed");return false;} // any failure, not just 401 — an empty read must mean "no history", never "unknown"
    setBests(bestsFromView(b.rows));
    setPrEvents(prEventsBySession(e.rows));
    return true;
  };
  const retryHistory=async()=>{
    const u=sb.getUser()?.id; if(!u)return;
    setHistoryStatus("loading");
    const {ok,rows}=await sb.selectAuth("workout_sessions","user_id=eq."+u,{order:"created_at.desc",limit:20});
    if(!ok){setHistoryStatus("failed");return;}
    setHistory(rows.map(sessionFromRow));
    if(await loadBests(u))setHistoryStatus("ready");
  };
  // ── Session edit / delete (#25) ──
  // Refresh contract: after any successful mutation, retryHistory() re-reads
  // history + exercise_bests + exercise_pr_events with the same ok-keyed
  // selectAuth; if that re-read fails, historyStatus is "failed" (Start
  // paused, list hidden) rather than a stale list rendered as truth. No
  // optimistic delete: a local filter would leave 19 rows while row 21 exists.
  const readSessionExercises=async(id)=>{
    const u=sb.getUser()?.id; if(!u||!hasDbId({id}))return null;
    // Re-read before editing so the editor starts from the current row, not
    // the mount-time copy (whole-array PATCH, last writer wins — see DECISIONS).
    const {ok,rows}=await sb.selectAuth("workout_sessions","id=eq."+id+"&user_id=eq."+u+"&select=exercises");
    if(!ok||!rows[0]){showError("Couldn't load that session to edit. Check your connection.");return null;}
    return normalizeExercises(rows[0].exercises);
  };
  const saveSessionExercises=async(id,exercises)=>{
    const u=sb.getUser()?.id; if(!u||!hasDbId({id}))return false;
    const ok=await sb.update("workout_sessions",{exercises:normalizeExercises(exercises)},{filter:"id=eq."+id+"&user_id=eq."+u});
    if(!ok){showError("Session couldn't be saved. Check your connection.");return false;}
    await retryHistory();
    return true;
  };
  const deleteSession=async(id)=>{
    const u=sb.getUser()?.id; if(!u||!hasDbId({id}))return false;
    const ok=await sb.delete("workout_sessions","id=eq."+id+"&user_id=eq."+u);
    if(!ok){showError("Session couldn't be deleted. Check your connection.");return false;}
    await retryHistory();
    return true;
  };
  // Drives the dot on the Train nav item. WorkoutTab keeps this in sync while
  // the app is running; this effect covers the case WorkoutTab cannot — after a
  // reload the user lands on Home, and without it the only tell that a session
  // is still live would be remembering to look.
  const [workoutInProgress,setWorkoutInProgress]=useState(false);
  useEffect(()=>{setWorkoutInProgress(!!readWorkoutSnapshot(workoutKey(uid)));},[uid]);
  const [errorBanner,setErrorBanner]=useState("");
  const errorTimerRef=useRef(null);
  const showError=(msg)=>{setErrorBanner(msg);if(errorTimerRef.current)clearTimeout(errorTimerRef.current);errorTimerRef.current=setTimeout(()=>setErrorBanner(""),3000);};

  const addWorkoutPlan=async(plan)=>{
    // AI-generated plans flow through here. name and exercises are NOT NULL —
    // a malformed plan must be rejected visibly, not 400 after the optimistic
    // add and leave a phantom plan on screen.
    const pname=(plan?.name||"").trim();
    const validExs=(Array.isArray(plan?.exercises)?plan.exercises:[]).filter(ex=>ex&&typeof ex.name==="string"&&ex.name.trim());
    if(!pname||validExs.length===0){
      showError("Couldn't add that workout plan — it's missing a name or exercises.");
      return null;
    }
    const tempId="w"+Date.now();
    const structured={
      id:tempId,
      name:pname,
      tag:plan.tag||"Full Body",
      level:plan.level||"Intermediate",
      estMin:plan.estMin||45,
      scheduledDay:plan.scheduledDay||null,
      exercises:validExs.map((ex,i)=>({
        id:"ex"+Date.now()+i,
        name:ex.name,
        sets:Array.from({length:ex.sets||3},()=>({reps:ex.reps||10,weight:ex.weight||0,done:false})),
      })),
    };
    setWorkouts(prev=>[structured,...prev]);
    if(uid){
      try{
        const row=await sb.insert("workout_plans",{
          user_id:uid,name:structured.name,tag:structured.tag,level:structured.level,
          est_min:structured.estMin,scheduled_day:structured.scheduledDay||null,
          exercises:structured.exercises,sort_order:workouts.length, // append, same as the manual path
        });
        if(!row)throw new Error("insert returned no row");
        if(row.id)setWorkouts(prev=>prev.map(w=>w.id===tempId?{...w,id:row.id}:w));
      }catch{
        setWorkouts(prev=>prev.filter(w=>w.id!==tempId));
        showError("Workout plan couldn't be saved. Check your connection.");
        return null;
      }
    }
    return structured;
  };

  const saveWorkoutPlanDB=async(plan,isNew)=>{
    if(!uid)return;
    if(sectionFailed("plans")){showError("Your plans didn't load — tap Retry at the top before editing.");return;}
    const pname=(plan?.name||"").trim();
    if(!pname||!Array.isArray(plan?.exercises)){
      showError("Couldn't save that workout plan — it's missing a name or exercises.");
      return;
    }
    if(isNew){
      const tempId=plan.id;
      try{
        const row=await sb.insert("workout_plans",{
          user_id:uid,name:pname,tag:plan.tag,level:plan.level,
          est_min:plan.estMin,scheduled_day:plan.scheduledDay||null,
          exercises:plan.exercises,sort_order:workouts.length,
        });
        if(!row)throw new Error("insert returned no row");
        if(row.id)setWorkouts(prev=>prev.map(w=>w.id===tempId?{...w,id:row.id}:w));
      }catch{
        setWorkouts(prev=>prev.filter(w=>w.id!==tempId));
        showError("Workout plan couldn't be saved. Check your connection.");
      }
    }else{
      try{
        const ok=await sb.update("workout_plans",{
          name:pname,tag:plan.tag,level:plan.level,
          est_min:plan.estMin,scheduled_day:plan.scheduledDay||null,
          exercises:plan.exercises,
        },{filter:"id=eq."+plan.id+"&user_id=eq."+uid});
        if(!ok)throw new Error("update failed");
      }catch{
        showError("Workout plan changes couldn't be saved. Check your connection.");
      }
    }
  };

  // Returns whether the row went. sb.delete never throws — the old try/catch{}
  // was unreachable and a failed delete left the plan gone from the UI and
  // back on reload (the food-delete shape).
  const deleteWorkoutPlanDB=async(id)=>{
    if(!uid)return true;
    const ok=await sb.delete("workout_plans","id=eq."+id+"&user_id=eq."+uid);
    if(!ok)showError("Couldn't delete that plan. Check your connection.");
    return ok;
  };

  const taken=suppList.filter(s=>suppTaken[s.k]).length;
  const total=suppList.length;

  // Loading state
  if(authState==="loading")return(
    <ThemeCtx.Provider value={T}>
      <div style={{minHeight:"100vh",background:T.appBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"-apple-system,sans-serif"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:("0 8px 28px "+T.accentGlow)}}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M6 14L11 19L22 9"/><circle cx="14" cy="14" r="12"/></svg>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.5px"}}>WiFit</div>
        <div style={{width:28,height:28,border:("2.5px solid "+T.border),borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      </div>
    </ThemeCtx.Provider>
  );

  if(authState==="auth")return(
    <ThemeCtx.Provider value={T}><GlobalStyle/><AuthScreen onAuth={handleAuth}/></ThemeCtx.Provider>
  );
  if(authState==="onboarding")return(
    <ThemeCtx.Provider value={T}><GlobalStyle/><OnboardingWizard userId={uid} onComplete={(g,n)=>{setGoals(g);setUserName(n);setProfileCreatedAt(new Date().toISOString());setWeekHistory({});setAuthState("app");}}/></ThemeCtx.Provider>
  );

  return(
    <ThemeCtx.Provider value={T}>
    <div style={{background:T.appBg,maxWidth:480,margin:"0 auto",minHeight:"100vh",fontFamily:"-apple-system,sans-serif",color:T.text,position:"relative",overflow:"hidden",transition:"background 0.25s,color 0.25s"}}>
      <GlobalStyle/>
      {loadFailures.length>0&&(
        <div data-testid="load-failed" style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,zIndex:998,background:T.accentPill,borderBottom:("1px solid "+T.border),padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,backdropFilter:"blur(6px)"}}>
          <div style={{fontSize:12,color:T.text}}>Couldn't load your {[...new Set(loadFailures)].join(", ")}. Some numbers may be missing.</div>
          <div onClick={()=>{const u=sb.getUser()?.id;if(u)loadUserData(u);}} style={{fontSize:12,fontWeight:700,color:T.accent,cursor:"pointer",flexShrink:0}}>Retry</div>
        </div>
      )}
      {errorBanner&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:T.red,color:"#fff",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:600,zIndex:999,maxWidth:340,textAlign:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.3)",pointerEvents:"none"}}>{errorBanner}</div>}
      {profileMenuOpen&&<ProfileMenu userName={userName} isDark={isDark} onClose={()=>setProfileMenuOpen(false)} onOpenProfile={()=>{closeAll();setProfilePageOpen(true);}} onOpenSettings={()=>{closeAll();setSettingsPageOpen(true);}} onOpenPersonalization={()=>{closeAll();setPersonalizationPageOpen(true);}} onOpenUpgrade={()=>{closeAll();setUpgradePageOpen(true);}} onOpenHelp={()=>{closeAll();setHelpPageOpen(true);}} onSignOut={handleSignOut}/>}
      {profilePageOpen&&<ProfilePage goals={goals} setGoals={setGoals} userName={userName} setUserName={setUserName} isDark={isDark} setIsDark={setIsDark} themeFam={themeFam} logWeight={logWeight} onSignOut={handleSignOut} onClose={()=>setProfilePageOpen(false)}/>}
      {settingsPageOpen&&<SettingsPage onBack={()=>setSettingsPageOpen(false)} isDark={isDark} setIsDark={setIsDark} onSignOut={handleSignOut} userName={userName}/>}
      {personalizationPageOpen&&<PersonalizationPage onBack={()=>setPersonalizationPageOpen(false)} isDark={isDark} themeFam={themeFam} setThemeFam={setThemeFam}/>}
      {upgradePageOpen&&<UpgradePage onBack={()=>setUpgradePageOpen(false)}/>}
      {helpPageOpen&&<HelpPage onBack={()=>setHelpPageOpen(false)}/>}
      {tab==="home"&&<TabErrorBoundary T={T} name="Home"><HomeTab setTab={setTab} log={log} suppList={suppList} suppTaken={suppTaken} workoutHistory={history} isDark={isDark} toggleTheme={()=>setIsDark(d=>!d)} userName={userName} goals={goals} onProfileOpen={()=>setProfileMenuOpen(true)} waterOz={waterOz} setWaterOz={setWaterOz} weightLog={weightLog} logWeight={logWeight}
        onCoachOpen={()=>setAiOpen(true)} onCalendarOpen={()=>setTab("calendar")} onProgressOpen={()=>setTab("progress")} onAddOpen={onAddOpen}
        todayPlan={todayPlanFor(workouts)} todayPlanSeeded={workouts===INITIAL_WORKOUTS} onStartPlan={(id)=>{setPendingStartPlanId(id);setTab("workout");}}
        toggleSuppTaken={toggleSuppTaken} weekHistory={weekHistory} onRetryWeek={()=>loadWeekHistory()} profileCreatedAt={profileCreatedAt}/></TabErrorBoundary>}
      {tab==="food"&&<TabErrorBoundary T={T} name="Food"><FoodTab log={log} setLog={setLog} uid={uid} onDeleteFailed={showError} customFoods={customFoods} addCustomFood={addCustomFoodDB} onAddItem={addFoodItem} goals={goals} waterOz={waterOz} setWaterOz={setWaterOz}/></TabErrorBoundary>}
      {tab==="workout"&&<TabErrorBoundary T={T} name="Train"><WorkoutTab workouts={workouts} setWorkouts={setWorkouts} history={history} prEvents={prEvents} onSessionComplete={saveWorkoutSession} bests={bests} onReadSession={readSessionExercises} onSaveSession={saveSessionExercises} onDeleteSession={deleteSession} onSavePlan={saveWorkoutPlanDB} onDeletePlan={deleteWorkoutPlanDB} uid={uid} onActiveChange={setWorkoutInProgress} historyStatus={sectionFailed("plans")?"failed":historyStatus} onRetryHistory={()=>{const u=sb.getUser()?.id;if(sectionFailed("plans")&&u)loadUserData(u);else retryHistory();}} pendingStartPlanId={pendingStartPlanId} onPendingConsumed={()=>setPendingStartPlanId(null)}/></TabErrorBoundary>}
      {tab==="supps"&&<TabErrorBoundary T={T} name="Supps"><SuppsTab suppList={suppList} setSuppList={setSuppList} suppTaken={suppTaken} setSuppTaken={toggleSuppTaken} taken={taken} total={total} uid={uid} addSuppToList={addSuppToList} onWriteFailed={showError}/></TabErrorBoundary>}
      {tab==="calendar"&&<TabErrorBoundary T={T} name="Calendar"><CalendarTab uid={uid} goals={goals} suppList={suppList} userName={userName} log={log} suppTaken={suppTaken} workoutHistory={history} waterOz={waterOz}/></TabErrorBoundary>}
      {tab==="progress"&&<TabErrorBoundary T={T} name="Progress"><ProgressPage uid={uid} goals={goals} suppList={suppList} userName={userName} log={log} suppTaken={suppTaken} workoutHistory={history} waterOz={waterOz} weightLog={weightLog} logWeight={logWeight} onProfileOpen={()=>setProfileMenuOpen(true)}/></TabErrorBoundary>}

      <TabBar active={tab} setTab={setTab} onAdd={onAddOpen} workoutInProgress={workoutInProgress}/>

      <div onClick={()=>setAiOpen(o=>!o)} style={{position:"fixed",right:aiOpen?"min(298px,80vw)":0,top:"50%",transform:"translateY(-50%)",background:"linear-gradient(180deg,"+T.accent+","+T.accentSoft+")",color:"#fff",borderRadius:"8px 0 0 8px",padding:"14px 7px",cursor:"pointer",zIndex:170,transition:"right 0.3s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,boxShadow:"-2px 0 16px "+T.accentGlow}}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" style={{transform:"rotate(90deg)"}}><rect x="1" y="3" width="14" height="10" rx="2"/><circle cx="5" cy="8" r="1.2" fill="white" stroke="none"/><circle cx="11" cy="8" r="1.2" fill="white" stroke="none"/></svg>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.5px",writingMode:"vertical-rl",textOrientation:"mixed",transform:"rotate(180deg)"}}>AI Coach</div>
      </div>

      <AISidePanel open={aiOpen} onClose={()=>setAiOpen(false)} onAddFood={addFoodItem} onAddWorkout={addWorkoutPlan} onAddWater={(oz)=>setWaterOz(w=>Math.min(GOAL_OZ,w+oz))} userName={userName} userId={uid||"demo"}
        liveContext={{
          calConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.cal||0)*(item.grams||0))/100),0),
          calGoal:goals.cal,
          protConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.protein||0)*(item.grams||0))/100),0),
          protGoal:goals.protein,
          carbConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.carbs||0)*(item.grams||0))/100),0),
          carbGoal:goals.carbs,
          fatConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.fat||0)*(item.grams||0))/100),0),
          fatGoal:goals.fat,
          waterOz:waterOz,
          workoutDone:!!history.find(w=>w.date===today),
          suppTaken:suppList.filter(s=>suppTaken[s.k]).length,
          suppTotal:suppList.length,
          suppList:suppList.map(s=>({k:s.k,name:s.name,sub:s.sub})),
          suppTakenMap:suppTaken,
          weightLog:weightLog,
        }}
        onAddSupp={addSuppToList}/>
      <QuickAddPanel initialMode={quickMode} initialAction={quickAction} open={quickOpen} onClose={()=>setQuickOpen(false)} onAddItem={addFoodItem} suppList={suppList} suppTaken={suppTaken} setSuppTaken={toggleSuppTaken} addSuppToList={addSuppToList} customFoods={customFoods} addCustomFood={addCustomFoodDB} waterOz={waterOz} setWaterOz={setWaterOz}/>
    </div>
    </ThemeCtx.Provider>
  );
}
