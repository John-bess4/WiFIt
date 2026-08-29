import { describe, it, expect } from "vitest";
import { per100From } from "../App.jsx";

// food_log stores macros per 100g; the coach hands over absolute macros for a
// specific gram weight. This scaling was written out by hand in five places
// before it was extracted, which is how a rounding or field-name slip ships
// unnoticed — the exact bug class that kept food_log empty for months.
describe("per100From", () => {
  it("scales the values the browser run produced", () => {
    // Banana, 120 g: the ACTIONS-path food auto-commit checked end to end.
    const p = per100From({ name: "Banana", grams: 120, cal: 107, protein: 1, carbs: 27, fat: 0 });
    expect(p.cal).toBe(89); // 107/120*100 = 89.17
    expect(p.protein).toBe(1); // 0.83 rounds up
    expect(p.carbs).toBe(23); // 22.5 rounds up
    expect(p.fat).toBe(0);
  });

  it("is identity at exactly 100 g", () => {
    const p = per100From({ grams: 100, cal: 250, protein: 30, carbs: 12, fat: 8 });
    expect(p).toMatchObject({ cal: 250, protein: 30, carbs: 12, fat: 8 });
  });

  it("scales up for portions under 100 g", () => {
    const p = per100From({ grams: 50, cal: 100, protein: 10, carbs: 4, fat: 2 });
    expect(p).toMatchObject({ cal: 200, protein: 20, carbs: 8, fat: 4 });
  });

  it("always sets fiber and sodium, which the schema expects", () => {
    const p = per100From({ grams: 200, cal: 100, protein: 5, carbs: 5, fat: 5 });
    expect(p.fiber).toBe(0);
    expect(p.sodium).toBe(0);
  });

  it("never emits null or NaN for a well-formed item", () => {
    const p = per100From({ grams: 173, cal: 411, protein: 33, carbs: 17, fat: 9 });
    for (const v of Object.values(p)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
