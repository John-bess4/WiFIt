import { describe, it, expect } from "vitest";
import { searchStatus } from "../App.jsx";

// A non-ok USDA/OFF response must never render as "no results". DEMO_KEY's
// 429 did exactly that for months and looked like a plausible empty state.
describe("searchStatus", () => {
  it("is 'none' only when every source answered and nothing matched", () => {
    expect(searchStatus({ results: [], failed: [] })).toBe("none");
  });
  it("is 'failed' when nothing came back and a source failed", () => {
    expect(searchStatus({ results: [], failed: ["USDA"] })).toBe("failed");
  });
  it("is 'partial' when one source failed but others matched", () => {
    expect(searchStatus({ results: [{ name: "x" }], failed: ["Open Food Facts"] })).toBe("partial");
  });
  it("is 'ok' when results came back and nothing failed", () => {
    expect(searchStatus({ results: [{ name: "x" }], failed: [] })).toBe("ok");
  });
});
