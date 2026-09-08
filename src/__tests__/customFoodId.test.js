import { describe, it, expect } from "vitest";
import { customFoodFromRow } from "../lib/nutrition.js";
import { withDbId, hasDbId } from "../lib/supabase.js";

// custom_foods has no edit/delete UI yet (#5), so the only place the uuid is
// observable is state. These pin the two paths that put it there.
const row = {
  id: "8b1c2d3e-0000-4000-8000-000000000001", user_id: "u", name: "Overnight oats",
  brand: null, serving_g: 250, serving_qty: 1, serving_unit: "bowl",
  per100_cal: 120, per100_protein: 5, per100_carbs: 18, per100_fat: 3,
  per100_fiber: null, per100_sugar: 6, per100_sodium: null,
};

describe("custom_foods id in memory", () => {
  it("loader keeps the row id and the seven macro fields", () => {
    const f = customFoodFromRow(row);
    expect(f.id).toBe(row.id);
    expect(hasDbId(f)).toBe(true);
    expect(f).toMatchObject({ name: "Overnight oats", brand: null, servingG: 250, servingQty: 1, servingUnit: "bowl", isCustom: true });
    expect(f.per100).toEqual({ cal: 120, protein: 5, carbs: 18, fat: 3, fiber: 0, sugar: 6, sodium: 0 });
  });

  it("addCustomFoodDB's write-back gives the optimistic item the inserted id", () => {
    // Same sequence of state updates addCustomFoodDB performs:
    // prepend the local item, then withDbId once the insert returns.
    const food = { name: "Overnight oats", brand: null, servingG: 250, servingQty: 1, servingUnit: "bowl", isCustom: true, per100: { cal: 120 } };
    const existing = customFoodFromRow({ ...row, id: "8b1c2d3e-0000-4000-8000-000000000002", name: "Other" });
    let state = [existing];
    state = [food, ...state];
    expect(hasDbId(state[0])).toBe(false);
    state = withDbId(state, food, row);
    expect(state[0].id).toBe(row.id);
    expect(state[0].name).toBe("Overnight oats");
    expect(state[1]).toBe(existing); // untouched
    expect(state.every(hasDbId)).toBe(true);
  });
});
