import { describe, it, expect } from "vitest";
import { ACTIVITY, ACTIVITY_MULTS_BY_ID, GOAL_RATES, MEAL_SLOTS, SEED } from "../lib/constants.js";
import { calcCalFromRate } from "../lib/bodyMetrics.js";

// ProfilePage used to carry its own literal copy of the seven multipliers.
// This is that literal, kept as the expected value: if the shared table ever
// drifts from it, a user's TDEE — the number they live by for months — moves.
const PROFILE_PAGE_LITERAL = { bmr: 1.0, sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9, extremely: 2.0 };

describe("ACTIVITY multipliers are one table", () => {
  it("derives exactly the seven values ProfilePage had, value for value", () => {
    expect(ACTIVITY_MULTS_BY_ID).toEqual(PROFILE_PAGE_LITERAL);
    expect(Object.keys(ACTIVITY_MULTS_BY_ID)).toHaveLength(7);
    for (const a of ACTIVITY) expect(a.mult).toBe(PROFILE_PAGE_LITERAL[a.id]);
  });
  it("calcCalFromRate applies the delta and floors at 1200", () => {
    expect(calcCalFromRate(2500, "maintain")).toBe(2500);
    expect(calcCalFromRate(2500, "lose_1")).toBe(2000);
    expect(calcCalFromRate(1500, "lose_2")).toBe(1200);
    expect(calcCalFromRate(2500, "not-a-rate")).toBe(2500); // unknown -> maintain
    expect(GOAL_RATES.map((r) => r.id)).toContain("maintain");
  });
  it("MEAL_SLOTS matches SEED's slots in order", () => {
    expect(MEAL_SLOTS.map((s) => s.id)).toEqual(Object.keys(SEED));
  });
});
