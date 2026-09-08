import { describe, it, expect } from "vitest";
import { per100From } from "../lib/nutrition.js";

// Coach-logged foods used to get fiber:0, sodium:0 and no sugar at all —
// confirmed in production: coach-logged chicken had sodium 0 while the same
// food from search had 50.
describe("per100From", () => {
  it("scales every field to per-100 g, including fiber, sugar and sodium", () => {
    const p = per100From({ grams: 200, cal: 330, protein: 62, carbs: 0, fat: 7, fiber: 2, sugar: 1, sodium: 148 });
    expect(p).toEqual({ cal: 165, protein: 31, carbs: 0, fat: 4, fiber: 1, sugar: 1, sodium: 74 });
  });
  it("falls back to 0, never NaN, when the model omits a field", () => {
    const p = per100From({ grams: 100, cal: 100, protein: 10, carbs: 10, fat: 1 });
    expect(p.fiber).toBe(0); expect(p.sugar).toBe(0); expect(p.sodium).toBe(0);
    expect(Object.values(p).every(Number.isFinite)).toBe(true);
  });
});
