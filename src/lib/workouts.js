// Workout session shapes and the one PR rule. Moved out of App.jsx unchanged
// (2026-09-08). No JSX, no state, no fetch.
//
// Where PRs live now (2026-09-07, #24/#28): the BASELINE is the exercise_bests
// view and the EVENTS are the exercise_pr_events view — both computed in
// Postgres from workout_sessions.exercises[].setsData, never stored. The one
// PR computation left on the client is computePRs: ActiveWorkout's live
// in-session banner compares the session in progress against the baseline
// loaded at Start. It cannot be a view because the session is not saved yet.
// A deliberate exception, not a leftover — and it applies the SAME rule as the
// view (strictly greater than a recorded best; a first-ever lift is a baseline,
// not a record; weight 0 never counts). If the rule changes, change both.
//
// Shapes:
//   exercises[]  {name, sets:["8×135lbs",…], setsData:[{reps,weight},…]}, same
//                length. setsData is authoritative (the views read it); sets is
//                the display label and is rebuilt from setsData when missing or
//                mismatched. normalizeExercises is the read-boundary guard —
//                every path that puts a session into state goes through it.
//   sessionFromRow  workout_sessions row → the in-memory session.
//   editSet         one set's numbers change; both representations rewritten
//                   from the same numbers (#25).
//   bestsFromView / prEventsBySession  view rows → the lookups the UI uses.

// Personal records. Both readers of a stored set string ("8×27.5lbs") and the
// live comparison go through these, so 2.5 lb increments survive (parseInt
// truncated 27.5 to 27 everywhere) and there is ONE definition of "a PR".
//
// A PR beats a RECORDED best (best>0): a first-ever lift is a baseline, not a
// record. PRs are computed from the FINAL state of a session, never
// incrementally at tick time — editing a weight after ticking, or un-ticking,
// used to leave a stale entry in an append-only list that then persisted.
export const setWeightOf=(setStr)=>parseFloat(String(setStr).split("×")[1])||0;
export const bestDoneWeight=(ex)=>Math.max(0,...(ex.sets||[]).filter(s=>s.done).map(s=>parseFloat(s.actualWeight)||0));
export const computePRs=(sets,bests={})=>(sets||[]).filter(ex=>{const w=bestDoneWeight(ex);const best=bests[ex.name]||0;return w>0&&best>0&&w>best;}).map(ex=>ex.name);
// Structured per-set data stored ALONGSIDE the display strings, so the PR
// baseline (the exercise_bests view) never depends on render format.
export const setsDataOf=(ex)=>(ex.sets||[]).filter(s=>s.done).map(s=>({reps:parseFloat(s.actualReps)||0,weight:parseFloat(s.actualWeight)||0}));
// ── Session rows: normalised at the read boundary ──────────────────────
// One malformed row must not take a tab down (TabErrorBoundary is the last
// line, this is the guard) and the two set representations must never
// disagree: setsData is what the views read, sets is what History shows.
// setsData is authoritative — when the labels are missing or their count
// differs, they are rebuilt from the numbers. Every path that puts a session
// into state (mount, Retry, finish) and the editor before it writes go
// through here, so the reader can only ever see this shape:
//   {name, sets:["8×135lbs",…], setsData:[{reps,weight},…]}  (same length)
const numOr0=(x)=>{const n=parseFloat(x);return Number.isFinite(n)?n:0;};
export const setLabel=(d)=>numOr0(d?.reps)+"×"+numOr0(d?.weight)+"lbs";
export const parseSetLabel=(str)=>{const m=/^(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)lbs$/.exec(String(str||"").trim());return m?{reps:parseFloat(m[1]),weight:parseFloat(m[2])}:null;};
export const normalizeExercises=(arr)=>{
  if(!Array.isArray(arr))return[];
  return arr.filter(e=>e&&typeof e==="object"&&!Array.isArray(e)).map(e=>{
    const name=typeof e.name==="string"&&e.name.trim()?e.name:"Exercise";
    const labels=Array.isArray(e.sets)?e.sets.map(x=>String(x)):null;
    let data=Array.isArray(e.setsData)?e.setsData.map(d=>({reps:numOr0(d?.reps),weight:numOr0(d?.weight)})):null;
    if(!data)data=(labels||[]).map(l=>parseSetLabel(l)||{reps:0,weight:0});
    const sets=labels&&labels.length===data.length?labels:data.map(setLabel);
    return{name,sets,setsData:data};
  });
};
// Session edit (#25): one set's numbers change; BOTH representations are
// rewritten from the same numbers by normalizeExercises. Name and set count
// are never touched — name is the views' group key, count changes the
// stored sets_completed/total_sets (out of scope for v1).
export const editSet=(exercises,exIdx,setIdx,{reps,weight})=>normalizeExercises(exercises).map((ex,i)=>{
  if(i!==exIdx)return ex;
  const setsData=ex.setsData.map((d,j)=>j===setIdx?{reps:numOr0(reps),weight:numOr0(weight)}:d);
  return{name:ex.name,sets:setsData.map(setLabel),setsData};
});
export const sessionFromRow=(s)=>({id:s?.id,workoutName:typeof s?.workout_name==="string"&&s.workout_name?s.workout_name:"Workout",date:s?.completed_date||"",duration:numOr0(s?.duration_secs),setsCompleted:numOr0(s?.sets_completed),totalSets:numOr0(s?.total_sets),exercises:normalizeExercises(s?.exercises)});

export const bestsFromView=(rows)=>Object.fromEntries((rows||[]).map(r=>[r.name,Number(r.best_lbs)||0]));
export const prEventsBySession=(rows)=>(rows||[]).reduce((m,r)=>{(m[r.session_id]||(m[r.session_id]=[])).push(r.name);return m;},{});
