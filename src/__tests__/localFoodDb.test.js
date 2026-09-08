import { describe, it, expect } from "vitest";
import { LOCAL_FOOD_DB } from "../lib/constants.js";
import { calc } from "../App.jsx";

// The seed catalogue had no sugar field, so every seed food wrote
// per100_sugar = 0 — the entry path the owner hits most. Every entry must now
// carry sugar: a number where known, null where not. Never absent.
describe("LOCAL_FOOD_DB sugar", () => {
  it("every entry has a sugar key that is a number or null", () => {
    const bad = LOCAL_FOOD_DB.filter((f) => !("sugar" in f.per100) || !(f.per100.sugar === null || Number.isFinite(f.per100.sugar)));
    expect(bad.map((f) => f.name)).toEqual([]);
    expect(LOCAL_FOOD_DB.length).toBeGreaterThan(40);
  });
  it("unknown sugar (null) scales to 0 in a total without becoming NaN", () => {
    const f = LOCAL_FOOD_DB.find((x) => x.per100.sugar === null) || { per100: { cal: 1, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: null, sodium: 0 } };
    expect(calc({ ...f, grams: 100 }).sugar).toBe(0);
  });
});
