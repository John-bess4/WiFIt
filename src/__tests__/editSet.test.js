import { describe, it, expect } from "vitest";
import { editSet, parseSetLabel } from "../lib/workouts.js";

// #25: an edit rewrites BOTH representations from the same numbers — the view
// reads setsData, History shows sets. They must never disagree.
const ex = [
  { name: "Bench", sets: ["8×135lbs", "6×145lbs"], setsData: [{ reps: 8, weight: 135 }, { reps: 6, weight: 145 }] },
  { name: "Squat", sets: ["5×225lbs"], setsData: [{ reps: 5, weight: 225 }] },
];

describe("editSet", () => {
  it("changes one set's numbers and its label together; nothing else moves", () => {
    const out = editSet(ex, 0, 1, { reps: "6", weight: "150" });
    expect(out[0].setsData[1]).toEqual({ reps: 6, weight: 150 });
    expect(out[0].sets[1]).toBe("6×150lbs");
    expect(out[0].setsData[0]).toEqual({ reps: 8, weight: 135 });
    expect(out[0].sets[0]).toBe("8×135lbs");
    expect(out[1]).toEqual(ex[1]);
    expect(ex[0].setsData[1].weight).toBe(145); // input untouched
  });
  it("every label agrees with its setsData entry after any edit", () => {
    const out = editSet(ex, 1, 0, { reps: 5, weight: 27.5 });
    for (const e of out) {
      expect(e.sets.length).toBe(e.setsData.length);
      e.sets.forEach((l, i) => expect(parseSetLabel(l)).toEqual(e.setsData[i]));
    }
  });
  it("never changes names or set counts", () => {
    const out = editSet(ex, 0, 0, { reps: 0, weight: 0 });
    expect(out.map((e) => e.name)).toEqual(["Bench", "Squat"]);
    expect(out.map((e) => e.setsData.length)).toEqual([2, 1]);
  });
  it("coerces garbage input to 0 rather than writing NaN", () => {
    const out = editSet(ex, 0, 0, { reps: "", weight: "abc" });
    expect(out[0].setsData[0]).toEqual({ reps: 0, weight: 0 });
    expect(out[0].sets[0]).toBe("0×0lbs");
  });
});
