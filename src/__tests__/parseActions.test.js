import { describe, it, expect } from "vitest";
import { parseActions, legacyFormatOf, MAX_ACTIONS, SUPP_CATEGORY_DOTS, isSuppCategory, toSuppCategory } from "../App.jsx";

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

describe("supplement category is checked against the enum", () => {
  const withCat = (category) => ({ type: "supplement", items: [{ name: "Creatine", category }] });

  it("accepts each of the eight documented categories", () => {
    for (const c of Object.keys(SUPP_CATEGORY_DOTS)) {
      expect(parseActions(wrap([withCat(c)])).valid).toHaveLength(1);
    }
    expect(Object.keys(SUPP_CATEGORY_DOTS)).toHaveLength(8);
  });

  it("drops a category outside the enum instead of storing it", () => {
    // Previously this passed validation, was written, and rendered as an
    // anonymous grey dot — a bad value stored as though it were real.
    const r = parseActions(wrap([withCat("nootropic")]));
    expect(r.valid).toEqual([]);
    expect(r.dropped).toEqual(["supplement"]);
  });

  it("is case-sensitive — the manual path's capitalised vocabulary is not valid here", () => {
    expect(parseActions(wrap([withCat("Protein")])).dropped).toEqual(["supplement"]);
    expect(parseActions(wrap([withCat("Creatine")])).dropped).toEqual(["supplement"]);
  });

  it("drops a missing, null or non-string category", () => {
    for (const c of [undefined, null, "", 7, {}]) {
      expect(parseActions(wrap([withCat(c)])).dropped).toEqual(["supplement"]);
    }
  });

  it("drops the supplement but keeps valid siblings", () => {
    const r = parseActions(wrap([water(8), withCat("bogus"), food()]));
    expect(r.valid.map(a => a.type)).toEqual(["water", "food"]);
    expect(r.dropped).toEqual(["supplement"]);
  });

  it("every valid category has a dot colour — the two cannot drift", () => {
    for (const c of Object.keys(SUPP_CATEGORY_DOTS)) {
      expect(isSuppCategory(c)).toBe(true);
      expect(SUPP_CATEGORY_DOTS[c]).toMatch(/^#[0-9A-F]{6}$/i);
    }
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

describe("toSuppCategory — the manual path's product types map to purpose", () => {
  it("maps every category present in SUPP_DB", () => {
    const inSuppDb = ["Vitamins", "Protein", "Pre-Workout", "Omega-3", "Multivitamin",
                      "Electrolytes", "Creatine", "Sleep", "Probiotic", "Collagen",
                      "BCAAs", "Greens/Multi"];
    for (const t of inSuppDb) {
      const mapped = toSuppCategory(t);
      expect(mapped, t + " must map").not.toBeNull();
      // Whatever it maps to must be a category the coach path would also accept.
      expect(isSuppCategory(mapped), t + " -> " + mapped).toBe(true);
    }
  });

  it("maps every value in the create picker", () => {
    for (const t of ["Protein", "Vitamins", "Creatine", "Omega-3", "Pre-Workout", "Sleep"]) {
      expect(isSuppCategory(toSuppCategory(t))).toBe(true);
    }
  });

  it("sends the I-don't-know option to null rather than guessing a purpose", () => {
    expect(toSuppCategory("Supplement")).toBeNull();
  });

  it("returns null for anything unmapped — never a passthrough", () => {
    // A passthrough would recreate the two-vocabulary split this fixes.
    for (const t of ["Nootropic", "", null, undefined, "protein"]) {
      expect(toSuppCategory(t)).toBeNull();
    }
  });

  it("collapses the performance family onto one value", () => {
    expect(toSuppCategory("Creatine")).toBe("performance");
    expect(toSuppCategory("Pre-Workout")).toBe("performance");
    expect(toSuppCategory("BCAAs")).toBe("performance");
  });
});
