import { describe, it, expect } from "vitest";
import { parseActions, legacyFormatOf, MAX_ACTIONS } from "../App.jsx";

const water = (oz = 8) => ({ type: "water", oz });
const supp = () => ({ type: "supplement", items: [{ name: "Creatine", category: "performance" }] });
const food = () => ({ type: "food", items: [{ name: "Banana", grams: 120, cal: 107, protein: 1, carbs: 27, fat: 0 }] });
const wrap = (arr, msg = "Done.") => "ACTIONS:" + JSON.stringify(arr) + "|" + msg;

describe("parseActions — the multi-intent case", () => {
  it("keeps every valid action in order", () => {
    const r = parseActions(wrap([water(8), supp()]));
    expect(r.valid).toHaveLength(2);
    expect(r.valid.map(a => a.type)).toEqual(["water", "supplement"]);
    expect(r.dropped).toEqual([]);
    expect(r.msg).toBe("Done.");
  });

  it("reads the message after the first pipe, not the last", () => {
    // A message containing a pipe must not confuse the split.
    const r = parseActions(wrap([water()], "Nice | keep going"));
    expect(r.msg).toBe("Nice | keep going");
    expect(r.valid).toHaveLength(1);
  });
});

describe("parseActions — partial validity fails OPEN", () => {
  it("commits valid siblings and names the dropped one", () => {
    // The supplement lacks `category`, which ACTION_VALID requires.
    const bad = { type: "supplement", items: [{ name: "Magnesium" }] };
    const r = parseActions(wrap([water(12), bad, food()]));
    expect(r.valid.map(a => a.type)).toEqual(["water", "food"]);
    expect(r.dropped).toEqual(["supplement"]);
    expect(r.total).toBe(3);
  });

  it("labels an unrecognised type rather than silently discarding it", () => {
    const r = parseActions(wrap([water(), { type: "teleport" }]));
    expect(r.valid).toHaveLength(1);
    expect(r.dropped).toEqual(["teleport"]);
  });

  it("calls a typeless entry 'unknown'", () => {
    const r = parseActions(wrap([water(), { oz: 5 }]));
    expect(r.dropped).toEqual(["unknown"]);
  });

  it("rejects food with grams:0 — per100 would divide by zero", () => {
    const zero = { type: "food", items: [{ name: "Air", grams: 0, cal: 0 }] };
    const r = parseActions(wrap([zero]));
    expect(r.valid).toEqual([]);
    expect(r.dropped).toEqual(["food"]);
  });

  it("rejects water with a non-positive or non-numeric oz", () => {
    expect(parseActions(wrap([{ type: "water", oz: 0 }])).dropped).toEqual(["water"]);
    expect(parseActions(wrap([{ type: "water", oz: "lots" }])).dropped).toEqual(["water"]);
  });
});

describe("parseActions — the 10-action cap", () => {
  it("applies exactly MAX_ACTIONS and reports the overflow", () => {
    const twelve = Array.from({ length: 12 }, () => water(1));
    const r = parseActions(wrap(twelve));
    expect(MAX_ACTIONS).toBe(10);
    expect(r.valid).toHaveLength(10);
    expect(r.overflow).toBe(2);
    expect(r.total).toBe(12);
  });

  it("reports no overflow at exactly the limit", () => {
    const r = parseActions(wrap(Array.from({ length: 10 }, () => water(1))));
    expect(r.valid).toHaveLength(10);
    expect(r.overflow).toBe(0);
  });
});

describe("parseActions — corrupt input fails CLOSED", () => {
  it("returns null on unparseable JSON so nothing is half-executed", () => {
    expect(parseActions('ACTIONS:[{"type":"water","oz":8},{broken|Oops.')).toBeNull();
  });

  it("returns null when the payload is not an array", () => {
    expect(parseActions('ACTIONS:{"type":"water","oz":8}|Nope.')).toBeNull();
  });

  it("returns null for a non-ACTIONS reply, leaving it to the legacy path", () => {
    expect(parseActions("Just some coaching advice.")).toBeNull();
    expect(parseActions('WORKOUT_PLAN:{"name":"Push"}|Old.')).toBeNull();
  });

  it("treats an empty array as valid but actionless", () => {
    const r = parseActions("ACTIONS:[]|Nothing to do.");
    expect(r).not.toBeNull();
    expect(r.valid).toEqual([]);
    expect(r.msg).toBe("Nothing to do.");
  });
});

describe("legacyFormatOf — the C2 gate", () => {
  it("identifies each of the six pre-ACTIONS prefixes", () => {
    for (const p of ["MULTI_FOOD:", "MEAL_SUGGESTION:", "RECIPE:", "WATER_LOG:", "ADD_SUPP:", "WORKOUT_PLAN:"]) {
      expect(legacyFormatOf(p + "{}|msg")).toBe(p);
    }
  });

  it("returns null for ACTIONS and for plain text", () => {
    expect(legacyFormatOf(wrap([water()]))).toBeNull();
    expect(legacyFormatOf("Drink more water.")).toBeNull();
  });
});
