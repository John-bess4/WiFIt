// The Supabase REST client and session handling. Moved out of App.jsx
// unchanged (2026-09-08). No JSX, no React. This is the contract the whole app
// is written against — do NOT add @supabase/supabase-js; the Swift client
// reimplements exactly this.
//
// ── The failure contract (nothing here throws) ─────────────────────────────
//   select()       → [] on ANY non-2xx. A 401, a 500 and "no rows" are
//                    indistinguishable. 15 call sites depend on this; do not
//                    change it. Use selectAuth where the difference matters.
//   selectAuth()   → {ok, authError, status, rows}. ok=false on ANY non-2xx or
//                    network failure; authError=true ONLY on 401/403 and is for
//                    ROUTING only (a 500 must never sign anyone out). Readers
//                    that must not launder a failure into an empty state key on
//                    ok, never on rows.length. rows is always an array.
//   insert/upsert  → the row, or null. A try/catch around them catches nothing;
//                    callers check the return value and surface the failure.
//   update/delete  → boolean.
//   Every failure logs "[sb.<method>] <table> <status>" — the grep browser
//   verification depends on.
//
// ── The per-read treatment ladder (what a caller does with a failed read) ──
//   1. Refuse to render the section and say so (Calendar month, Progress,
//      ProfilePage, Train history): the numbers below are not yours.
//   2. Render the section from state with a failed+Retry line (Home week rail):
//      null means failed, {} means empty — never conflated.
//   3. Banner + write guards (mount reads): loadFailures lists the section, the
//      writes that would be destructive against an empty state are blocked.
//   Never: render [] as "no data".
//
// ── Upserts: on_conflict must name the UNIQUE constraint ───────────────────
//   PostgREST infers the conflict target from the PRIMARY KEY unless told. A
//   surrogate-id table with a separate composite UNIQUE (water_log
//   (user_id,log_date), supplement_log (supplement_id,log_date),
//   body_weight_log (user_id,log_date)) needs onConflict with those columns or
//   the second same-day write 409s. profiles upserts on its PK and may omit it.
//
// ── Auth ───────────────────────────────────────────────────────────────────
//   _fetch retries a data request exactly once on 401, after one coalesced
//   refresh (single-use refresh_token rotated once, even under concurrent
//   401s). 403 is an RLS denial and is never retried. resolveSession runs
//   BEFORE any data load and yields valid | refreshed | logged-out. A refresh
//   that fails deep inside a write routes to "auth" via setAuthLostHandler —
//   never to onboarding, which would overwrite a real profile.
//
// ── Row identity ───────────────────────────────────────────────────────────
//   New items get a local id; the database gives them a uuid on insert and
//   withDbId writes it back. hasDbId gates every delete/update filter: a
//   local id at a uuid column is a 400 the old code swallowed.

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
const PERSONAL_TABLES=new Set(["food_log","custom_foods","saved_meals","saved_meal_items","water_log","body_weight_log","workouts","workout_plans","workout_sessions","supplement_stack","supplement_log","supplement_notes","health_quantity_log"]);
const generationKey=owner=>"wifit_data_generation_"+owner;
let onDataGenerationLost=null;
export function setDataGenerationLostHandler(handler){onDataGenerationLost=handler;}
const blockedGenerationResponse=()=>new Response(JSON.stringify({code:"WIFIT_GENERATION_CHANGED",message:"WiFit data was removed. Reload before creating new records."}),{status:409,headers:{"Content-Type":"application/json"}});
function blockDataGeneration(){
  sb._generationBlocked=true;
  if(onDataGenerationLost)onDataGenerationLost();
}
function storedGeneration(owner){
  const raw=localStorage.getItem(generationKey(owner));
  if(raw===null)return 0;
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<0)throw new Error("Unreadable data generation");
  return value;
}
function reconcileLocalGeneration(owner,generation){
  const previous=storedGeneration(owner);
  if(previous>generation)throw new Error("Data generation moved backwards");
  if(previous<generation){
    const key="wifit_workout_"+owner,raw=localStorage.getItem(key);
    if(raw){
      const draft=JSON.parse(raw),assignment=draft?.workout?.trainerAssignmentID||draft?.workout?.trainer_assignment_id;
      // Assigned recovery survives; malformed ownership stops cleanup.
      if(!draft||typeof draft!=="object"||!draft.workout)throw new Error("Review the saved workout before continuing");
      if(!UUID_RE.test(assignment||""))localStorage.removeItem(key);
    }
    localStorage.removeItem("wifit_chat_"+owner);
    // Publish the floor only after this account's old personal files are gone.
    localStorage.setItem(generationKey(owner),String(generation));
  }
}
export function observeDataGenerationChange(event){
  const context=sb._dataContext;
  if(!context||event.key!==generationKey(context.owner))return;
  try{if(storedGeneration(context.owner)!==context.generation)blockDataGeneration();}
  catch{blockDataGeneration();}
}

export const sb={
  _url:SUPABASE_URL,_key:SUPABASE_ANON,_session:null,_dataContext:null,_generationBlocked:false,_pageDataGenerations:new Map(),
  dataContext(){return this._dataContext;},
  isDataContextCurrent(context){
    try{return !!context&&!this._generationBlocked&&this.getUser()?.id===context.owner&&this._dataContext===context&&storedGeneration(context.owner)<=context.generation;}
    catch{return false;}
  },
  async loadDataGeneration(owner){
    try{
      if(this.getUser()?.id!==owner)return{ok:false,reason:"account"};
      const r=await this._fetch("/rest/v1/rpc/wifit_data_generation",{method:"POST",body:"{}",cache:"no-store"});
      const body=await r.json().catch(()=>null);
      // Compatibility before the separately reviewed removal migration only.
      // A network error, forbidden call or other missing resource is not zero.
      const missing=r.status===404&&body?.code==="PGRST202";
      const generation=missing?0:body;
      if((!r.ok&&!missing)||!Number.isSafeInteger(generation)||generation<0)return{ok:false,reason:"unavailable"};
      if(this.getUser()?.id!==owner)return{ok:false,reason:"account"};
      if((this._pageDataGenerations.has(owner)&&this._pageDataGenerations.get(owner)!==generation)
        ||(this._dataContext?.owner===owner&&this._generationBlocked)){
        blockDataGeneration();return{ok:false,reason:"changed"};
      }
      reconcileLocalGeneration(owner,generation);
      if(this._dataContext?.owner!==owner)this._dataContext=Object.freeze({owner,generation});
      this._pageDataGenerations.set(owner,generation);
      this._generationBlocked=false;
      return{ok:true,context:this._dataContext};
    }catch{return{ok:false,reason:"unavailable"};}
  },
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
    const owner=this.getUser()?.id;
    const table=path.match(/^\/rest\/v1\/([^/?]+)/)?.[1];
    const write=PERSONAL_TABLES.has(table)&&["POST","PATCH","DELETE"].includes((init.method||"GET").toUpperCase());
    // Capture once. Neither refresh nor a late response may adopt a newer
    // generation and replay a draft created before removal.
    const context=this._dataContext;
    if(write&&(this._generationBlocked||(context&&!this.isDataContextCurrent(context)))){
      blockDataGeneration();return blockedGenerationResponse();
    }
    const headers=write?{...extra,"x-wifit-data-generation":String(context?.generation??0)}:extra;
    const inspect=async response=>{
      if(write&&response.status===409){
        const error=await response.clone().json().catch(()=>null);
        if(error?.code==="PT409"&&error?.message?.includes("WiFit data was removed"))blockDataGeneration();
      }
      return response;
    };
    const r=await fetch(this._url+path,{...init,headers:this.headers(headers)});
    if(r.status!==401)return inspect(r);
    if(!(await reauth(sent)))return r;
    if(this.getUser()?.id!==owner||(write&&(this._generationBlocked||context!==this._dataContext)))return write?blockedGenerationResponse():r;
    console.warn("[sb] access_token expired mid-session — refreshed, retrying",path.split("?")[0]);
    return inspect(await fetch(this._url+path,{...init,headers:this.headers(headers)}));
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
    this._session=null;this._dataContext=null;this._generationBlocked=false;localStorage.removeItem("sb_session");
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
