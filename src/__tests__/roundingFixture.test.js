import { describe, it, expect } from "vitest";
import fixture from "../../docs/port/rounding-fixture.json";

// docs/port/rounding-fixture.json is the day-one test for the Swift port: the
// expected values are round(per100*grams/100) from Postgres NUMERIC (the
// daily_summary definition). The Swift Decimal implementation must reproduce
// every one. Here we (a) keep the file well-formed and (b) prove it still
// discriminates — a naive JS Double (what a Double port does) must get several
// wrong, or the fixture has lost its teeth.
describe("rounding-fixture.json (port artifact)", () => {
  it("every case is well-formed with an integer expected", () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(25);
    for (const c of fixture.cases) {
      expect(typeof c.per100).toBe("number");
      expect(typeof c.grams).toBe("number");
      expect(Number.isInteger(c.expected)).toBe(true);
    }
  });

  it("still discriminates: a naive Double disagrees with the numeric expected on the divergence cases", () => {
    const diverge = fixture.cases.filter((c) => Math.round((c.per100 * c.grams) / 100) !== c.expected);
    expect(diverge.length).toBeGreaterThanOrEqual(10);
    // and the canonical worked example is in the set
    const canon = fixture.cases.find((c) => c.per100 === 32.3 && c.grams === 500);
    expect(canon.expected).toBe(162);
    expect(Math.round((32.3 * 500) / 100)).toBe(161); // the Double answer, for the record
  });
});
