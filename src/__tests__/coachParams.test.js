import { describe, it, expect, vi } from "vitest";
import { buildContextBlock, buildSystem, applyActions, parseActions } from "../lib/coach.js";

// The three functions that used to close over AISidePanel's props now take an
// explicit params object. These pin the shape the Swift client builds.
const live = { calGoal: 2000, calConsumed: 500, protGoal: 150, protConsumed: 40, carbGoal: 200, carbConsumed: 60, fatGoal: 70, fatConsumed: 20, waterOz: 32, workoutDone: false, suppList: [{ k: "a", name: "Creatine", sub: "5 g" }], suppTakenMap: { a: true }, suppTaken: 1, suppTotal: 1, weightLog: [{ date: "2026-09-01", lbs: 240 }, { date: "2026-09-07", lbs: 235 }] };

describe("coach params", () => {
  it("buildContextBlock reads only its arguments", () => {
    const b = buildContextBlock(live, "Jo");
    expect(b).toContain("Name: Jo");
    expect(b).toContain("Remaining: 1500 kcal");
    expect(b).toContain("Protein: 110g left");
    expect(b).toContain("Creatine (5 g) ✅");
    expect(b).toContain("down 5.0lbs");
    expect(buildContextBlock({}, "Jo")).toBe(""); // no calGoal → no block
  });
  it("buildSystem embeds the block and the ACTIONS contract", () => {
    const sys = buildSystem({ liveContext: live, userName: "Jo" });
    expect(sys).toContain("Name: Jo");
    expect(sys).toContain("ACTIONS:");
    expect(buildSystem()).not.toContain("Name:");
  });
  it("applyActions runs the writes through the handlers and returns the cards", () => {
    const onAddWater = vi.fn(), onAddFood = vi.fn(), onAddSupp = vi.fn();
    const parsed = parseActions('ACTIONS:[{"type":"water","oz":16},{"type":"food","items":[{"name":"Egg","grams":50,"cal":78,"protein":6,"carbs":1,"fat":5,"slot":"breakfast"}]},{"type":"bogus"}]|Done.');
    const { messages, hasSupp } = applyActions(parsed, { onAddWater, onAddFood, onAddSupp });
    expect(onAddWater).toHaveBeenCalledWith(16);
    expect(onAddFood).toHaveBeenCalledTimes(1);
    expect(onAddFood.mock.calls[0][0]).toBe("breakfast");
    expect(onAddFood.mock.calls[0][1].per100.cal).toBe(156);
    expect(onAddSupp).not.toHaveBeenCalled();
    expect(hasSupp).toBe(false);
    expect(messages.map((m) => m.type || "text")).toEqual(["water_logged", "multi_food_logged", "text"]);
    expect(messages[2].text).toContain("Couldn't apply 1 of 3 actions (bogus)");
  });
});
