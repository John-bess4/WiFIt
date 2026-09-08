// The coach contract — what the model is shown, what it may say back, and how
// a reply becomes writes. Moved out of App.jsx (2026-09-08); the three
// functions that closed over the panel's props/state now take an explicit
// params object. No JSX, no state: the message-card objects returned here are
// plain data that AISidePanel renders.
//
//   buildContextBlock(liveContext, userName)
//   buildSystem({liveContext, userName})   the system prompt, incl. the ACTIONS:
//                                          format spec and the ACTION HYGIENE rules
//   buildContextMessages(history)          prior turns, applied-action cards
//                                          replayed as short assistant lines
//   buildRequestMessages(userMsg, history) context + the new user turn EXACTLY
//                                          ONCE (#17: sending it twice made the
//                                          model act twice)
//   callCoach(userMsg, history, {liveContext, userName})
//                                          POST /api/coach; throws with .status
//                                          and .userMessage on non-2xx
//   parseActions(reply)                    null unless "ACTIONS:[…]|msg"; corrupt
//                                          JSON fails CLOSED, individual invalid
//                                          actions fail OPEN and are named
//   applyActions(parsed, {onAddWater, onAddFood, onAddSupp})
//                                          runs the writes through the App
//                                          handlers and returns {messages, hasSupp}
//   coachHeaders() / coachErrorText()      bearer from the live session (read at
//                                          call time), honest failure text
//
// liveContext is the object App builds for the panel: calGoal, calConsumed,
// protGoal/protConsumed, carbGoal/carbConsumed, fatGoal/fatConsumed, waterOz,
// workoutDone, suppList[{k,name,sub}], suppTaken, suppTotal, suppTakenMap,
// weightLog[{date,lbs}]. The Swift client builds the same object.
import { sb } from "./supabase.js";
import { per100From } from "./nutrition.js";
import { COLORS, isSuppCategory } from "./constants.js";

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

// Headers for /api/coach. The token is read at call time, not captured, so a
// just-refreshed access_token is used rather than a stale one. If there is no
// session the request still goes out and the server answers 401 — the client
// never decides for itself whether a token is valid.
export function coachHeaders(){
  const t=sb._session?.access_token;
  return t?{"Content-Type":"application/json","Authorization":"Bearer "+t}
          :{"Content-Type":"application/json"};
}

// One place to turn a coach failure into something honest. 429 prefers the
// server's message because it carries the actual retry time.
export function coachErrorText(e,fallback){
  if(e?.status===401)return "Your session expired. Sign out and sign back in to keep using the coach.";
  if(e?.status===429)return e.userMessage||"You've reached the coach's usage limit. Try again later.";
  return fallback;
}

export function buildContextBlock(liveContext={},userName=""){
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
}

export function buildSystem({liveContext={},userName=""}={}){return `You are an expert fitness and nutrition AI coach built into a personal fitness tracking app.

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
${buildContextBlock(liveContext,userName)}

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
- level: Beginner / Intermediate / Advanced`;}

export async function callCoach(userMsg,history,{liveContext={},userName=""}={}){
  // isError bubbles are our own failure text, not something the coach said.
  // Replayed as assistant turns they poison every later request — and if one
  // lands first in the window, messages[0].role is "assistant" and Anthropic
  // 400s, so a single failure breaks the conversation permanently.
  const res=await fetch("/api/coach",{
    method:"POST",
    headers:coachHeaders(),
    body:JSON.stringify({max_tokens:1200,system:buildSystem({liveContext,userName}),messages:buildRequestMessages(userMsg,history)}),
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
}

// have a one-tap undo elsewhere in the app; supplement, workout_plan, recipe
// and meal_suggestion all render as proposals.
// recipe and workout_plan carry their payload flat on the action; the card
// renderers want it nested under .recipe / .plan without the discriminator.
const withoutType=(a)=>{const o={...a};delete o.type;return o;};

export function applyActions({valid,dropped,overflow,msg,total},{onAddWater,onAddFood,onAddSupp}={}){
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
  return{messages:out,hasSupp};
}
