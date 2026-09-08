import { describe, it, expect } from "vitest";
import { nameMatchesQuery } from "../lib/search.js";

// OFF v2 returns unrelated products for a no-match query; the filter is what
// makes the empty state reachable. Barcode lookup does not go through it.
describe("nameMatchesQuery", () => {
  it("rejects the junk OFF returns for a nonsense query", () => {
    for (const n of ["Sidi Ali", "Perly", "Fromage Blanc Nature"]) expect(nameMatchesQuery(n, "qwzxjvkplm")).toBe(false);
  });
  it("matches case-insensitively, ignoring accents and punctuation", () => {
    expect(nameMatchesQuery("Fromage Blanc Nature", "fromage")).toBe(true);
    expect(nameMatchesQuery("Crème Fraîche", "creme")).toBe(true);
    expect(nameMatchesQuery("Trader Joe's Almond Butter", "trader joes")).toBe(true);
    expect(nameMatchesQuery("Ben & Jerry's", "ben & jerry")).toBe(true);
  });
  it("matches on any token of a multi-word query", () => {
    expect(nameMatchesQuery("Whole Milk", "fairlife whole milk")).toBe(true);
    expect(nameMatchesQuery("Greek Yogurt", "chicken rice")).toBe(false);
  });
  it("ignores single-character tokens and empty input", () => {
    expect(nameMatchesQuery("Apple", "a")).toBe(false);
    expect(nameMatchesQuery("", "apple")).toBe(false);
    expect(nameMatchesQuery("Apple", "")).toBe(false);
  });
});
