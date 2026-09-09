import { describe, it, expect } from "vitest";
import { bmr, tdee, calcCalFromRate, macrosForCal, computeGoals } from "../lib/bodyMetrics.js";
import { ACTIVITY_MULTS_BY_ID, GOAL_RATES } from "../lib/constants.js";

// Value-for-value against the PRE-EXTRACTION inline math (App.jsx OnboardingWizard
// .calcGoals and ProfilePage.calcTDEE). These `expected*` fns are the exact
// formulas that were inline; if lib/bodyMetrics ever drifts from them, a user's
// calorie target — the number they live by for months — moved. Same discipline
// as activityMults.test.

const expectedBmr = (gender, w, h, a) => {
  const wKg = w * 0.453592, hCm = h * 2.54;
  return gender === "male"
    ? (13.397 * wKg) + (4.799 * hCm) - (5.677 * a) + 88.362
    : (9.247 * wKg) + (3.098 * hCm) - (4.330 * a) + 447.593;
};
const expectedGoals = (gender, w, h, a, act, rate) => {
  const b = expectedBmr(gender, w, h, a);
  const t = Math.round(b * (ACTIVITY_MULTS_BY_ID[act] || 1.55));
  const cal = Math.max(t + (GOAL_RATES.find((r) => r.id === rate) || GOAL_RATES[3]).delta, 1200);
  const protein = Math.round(w * 0.82);
  const fat = Math.round(cal * 0.25 / 9);
  const carbs = Math.max(Math.round((cal - protein * 4 - fat * 9) / 4), 50);
  return { bmr: Math.round(b), tdee: t, cal, protein, carbs, fat };
};

const ACTIVITIES = Object.keys(ACTIVITY_MULTS_BY_ID); // all 7
const CASES = [
  { gender: "male", w: 200, h: 70, a: 30 },
  { gender: "female", w: 150, h: 65, a: 28 },
  { gender: "male", w: 170, h: 69, a: 25 },     // the onboarding defaults
  { gender: "female", w: 250, h: 72, a: 45 },
];

describe("bodyMetrics — Revised Harris-Benedict, value-for-value", () => {
  it("bmr matches the inline formula for both genders across the case matrix", () => {
    for (const c of CASES) {
      expect(bmr({ gender: c.gender, weightLbs: c.w, heightIn: c.h, age: c.a }))
        .toBeCloseTo(expectedBmr(c.gender, c.w, c.h, c.a), 9);
    }
  });

  it("tdee matches round(bmr*mult) for ALL 7 activity levels x both genders", () => {
    for (const c of CASES) {
      for (const act of ACTIVITIES) {
        const stats = { gender: c.gender, weightLbs: c.w, heightIn: c.h, age: c.a };
        expect(tdee(stats, act)).toBe(Math.round(expectedBmr(c.gender, c.w, c.h, c.a) * ACTIVITY_MULTS_BY_ID[act]));
      }
    }
    expect(ACTIVITIES).toHaveLength(7);
  });

  it("computeGoals reproduces the full inline goal set for every activity x rate", () => {
    const rates = GOAL_RATES.map((r) => r.id);
    for (const c of CASES) {
      for (const act of ACTIVITIES) {
        for (const rate of rates) {
          const got = computeGoals({ gender: c.gender, weightLbs: c.w, heightIn: c.h, age: c.a, activityId: act, rateId: rate });
          expect(got).toEqual(expectedGoals(c.gender, c.w, c.h, c.a, act, rate));
        }
      }
    }
  });

  it("calcCalFromRate applies the delta and floors at 1200; unknown rate -> maintain", () => {
    expect(calcCalFromRate(2500, "maintain")).toBe(2500);
    expect(calcCalFromRate(2500, "lose_1")).toBe(2000);
    expect(calcCalFromRate(1500, "lose_2")).toBe(1200);   // floor
    expect(calcCalFromRate(2500, "nonsense")).toBe(2500); // -> GOAL_RATES[3] = maintain
  });

  it("macrosForCal: protein from bodyweight, fat 25% cals, carbs remainder floored at 50", () => {
    expect(macrosForCal(2000, 200)).toEqual({ protein: 164, fat: 56, carbs: Math.max(Math.round((2000 - 164 * 4 - 56 * 9) / 4), 50) });
    expect(macrosForCal(1200, 300).carbs).toBeGreaterThanOrEqual(50); // floor holds when protein+fat exceed cals
  });
});
