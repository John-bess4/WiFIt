// Body metrics — BMR, TDEE, calorie target, and the macro split. Moved out of
// App.jsx (2026-09-09). No JSX, no state. This is the ONE place a formula
// produces a number the user lives by for months, so a Swift divergence here is
// worse than anywhere else: it is part of the shared data-layer package and has
// a value-for-value test (bodyMetrics.test.js) against the pre-extraction inline
// results — the same discipline as the ACTIVITY multipliers.
//
// BMR uses the **Revised Harris-Benedict** (Roza & Shizgal, 1984) equations in
// metric units. Inputs are already-resolved NUMBERS: the empty-field defaults
// (170 lb, 5'9", 25) are a UI concern and stay at the call sites, not here.
import { GOAL_RATES, ACTIVITY_MULTS_BY_ID } from "./constants.js";

const LB_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

// Raw (unrounded) BMR in kcal/day. Callers round at the point of display.
export const bmr = ({ gender, weightLbs, heightIn, age }) => {
  const wKg = (Number(weightLbs) || 0) * LB_TO_KG;
  const hCm = (Number(heightIn) || 0) * IN_TO_CM;
  const a = Number(age) || 0;
  return gender === "male"
    ? (13.397 * wKg) + (4.799 * hCm) - (5.677 * a) + 88.362
    : (9.247 * wKg) + (3.098 * hCm) - (4.330 * a) + 447.593;
};

// TDEE = round(BMR × activity multiplier). Unknown activity falls back to 1.55.
export const tdee = (stats, activityId) =>
  Math.round(bmr(stats) * (ACTIVITY_MULTS_BY_ID[activityId] || 1.55));

// Daily calorie target from TDEE and a weekly-rate option, floored at 1200.
export function calcCalFromRate(tdeeVal, rateId) {
  const rate = GOAL_RATES.find((r) => r.id === rateId) || GOAL_RATES[3];
  return Math.max(tdeeVal + rate.delta, 1200);
}

// The macro split for a calorie target: protein from bodyweight, fat 25% of
// calories, carbs the remainder (floored at 50 g). Identical in onboarding and
// profile before this extraction.
export const macrosForCal = (cal, weightLbs) => {
  const protein = Math.round((Number(weightLbs) || 0) * 0.82);
  const fat = Math.round((cal * 0.25) / 9);
  const carbs = Math.max(Math.round((cal - protein * 4 - fat * 9) / 4), 50);
  return { protein, carbs, fat };
};

// The full goal set the onboarding wizard computes.
export const computeGoals = ({ gender, weightLbs, heightIn, age, activityId, rateId }) => {
  const stats = { gender, weightLbs, heightIn, age };
  const bmrVal = bmr(stats);
  const tdeeVal = Math.round(bmrVal * (ACTIVITY_MULTS_BY_ID[activityId] || 1.55));
  const cal = calcCalFromRate(tdeeVal, rateId);
  return { bmr: Math.round(bmrVal), tdee: tdeeVal, cal, ...macrosForCal(cal, weightLbs) };
};
