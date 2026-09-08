// Nutrition arithmetic — the numbers a user lives by. Moved out of App.jsx
// unchanged (2026-09-08). No JSX, no state, no fetch.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ HARD SWIFT REQUIREMENT                                                   │
// │ All macro arithmetic in the Swift client must use Decimal, not Double.   │
// │ JS doubles disagree with Postgres numeric on exact-.5 products (21 of    │
// │ 3,996 tested; 32.3 × 500 / 100 → 161 in JS, 162 in the view). A Double   │
// │ port reproduces the JS answer and disagrees with daily_summary, so the   │
// │ same day shows different totals depending on which side computed it.    │
// └──────────────────────────────────────────────────────────────────────────┘
//
// The JS side is the wrong one and stays wrong until the client reads
// daily_summary everywhere. Still PROVISIONAL — do not port these, read the
// view (migration 20260907_daily_summary_views.sql is the definition):
//   - reduceWeekRows        src/lib/weekSummary.js   (Home week rail)
//   - CalendarTab's bucket  App.jsx                  (Calendar month)
//   - calc() / totals()     this file                (today's meals on Home and Food)
//
// What is here:
//   calc(item)          one logged item → {cal, protein, carbs, fat, fiber, sugar,
//                       sodium} for its grams. round(per100 * grams / 100) per
//                       row — the same arithmetic as the view, in doubles.
//                       sugar null = unknown: counts as 0 in a total, stored as null.
//   totals(log)         the day, summed per slot.
//   per100From(item)    absolute macros for `grams` → per-100 g (coach/recipe
//                       path). Callers guarantee grams > 0.
//   customFoodFromRow   custom_foods row → in-memory food; keeps the uuid.
//   CF_UNIT_G etc.      custom-food serving → grams; only g/oz/ml are honest
//                       constants, everything else is user-supplied grams.

export function calc(item){
  const g=item.grams/100,m=item.per100;
  return{
    cal:Math.round(m.cal*g),
    protein:Math.round(m.protein*g*10)/10,
    carbs:Math.round(m.carbs*g*10)/10,
    fat:Math.round(m.fat*g*10)/10,
    fiber:Math.round(m.fiber*g*10)/10,
    sugar:Math.round((m.sugar||0)*g*10)/10, // null = unknown; counts as 0 in a total, but is stored as null
    sodium:Math.round(m.sodium*g),
  };
}

export function totals(log){
  return Object.values(log).flat().reduce((a,item)=>{
    const m=calc(item);
    return{cal:a.cal+m.cal,protein:Math.round((a.protein+m.protein)*10)/10,carbs:Math.round((a.carbs+m.carbs)*10)/10,fat:Math.round((a.fat+m.fat)*10)/10,fiber:Math.round((a.fiber+m.fiber)*10)/10,sugar:Math.round((a.sugar+m.sugar)*10)/10,sodium:a.sodium+m.sodium};
  },{cal:0,protein:0,carbs:0,fat:0,fiber:0,sugar:0,sodium:0});
}

// food_log stores macros per 100g; the coach and the recipe card both hand over
// absolute macros for a specific gram weight. This scaling was written out by
// hand in five places, which is exactly how a rounding or field-name slip ships
// unnoticed. Callers must guarantee grams>0 (ACTION_VALID.food does).
// Coach items arrive as totals for `grams`; convert to per-100 g. fiber,
// sodium and sugar used to be hardcoded 0 here, so every coach-logged food
// under-reported the Fiber tile and the sodium bar. The prompt now asks for
// them; absent values still fall back to 0 rather than NaN.
const per100Of=(v,g)=>Math.round(((Number(v)||0)/g)*100);
export const per100From=(item)=>{
  const g=Number(item.grams)||100;
  return {
    cal:per100Of(item.cal,g),
    protein:per100Of(item.protein,g),
    carbs:per100Of(item.carbs,g),
    fat:per100Of(item.fat,g),
    fiber:per100Of(item.fiber,g),
    sugar:per100Of(item.sugar,g),
    sodium:per100Of(item.sodium,g),
  };
};

// custom_foods row → in-memory food. Keeps the uuid; the loader used to drop
// it, so every custom food loaded from the database was un-deletable in place.
export const customFoodFromRow=(f)=>({id:f.id,name:f.name,brand:f.brand||null,servingG:f.serving_g,servingQty:f.serving_qty,servingUnit:f.serving_unit||"g",isCustom:true,per100:{cal:f.per100_cal,protein:f.per100_protein,carbs:f.per100_carbs,fat:f.per100_fat,fiber:f.per100_fiber||0,sugar:f.per100_sugar||0,sodium:f.per100_sodium||0}});

// Serving units we can turn into grams ourselves. g and oz are exact; ml is a
// disclosed water-density default the user can overwrite. cup/tbsp/piece are
// food-dependent — there is no honest constant, so the user supplies the grams.
export const CF_UNIT_G={g:1,oz:28.3495,ml:1};
export const CF_AUTO_UNITS=["g","oz"];
export const cfGramsFor=(qty,unit)=>{
  const f=CF_UNIT_G[unit];
  const n=parseFloat(qty);
  if(!f||!Number.isFinite(n)||n<=0)return"";
  return String(Math.round(n*f*10)/10);
};
