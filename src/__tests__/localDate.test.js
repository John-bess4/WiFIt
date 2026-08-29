import { describe, it, expect } from "vitest";
import { localDate } from "../App.jsx";

// Runs under TZ=America/Los_Angeles (see the test script). Every date column in
// the app stores the user's LOCAL day; toISOString() returns the UTC day, which
// is already tomorrow for anyone west of UTC logging in the evening.
describe("localDate", () => {
  it("returns the local calendar day, not the UTC day", () => {
    // 03:00Z on the 16th is 20:00 on the 15th in Los Angeles.
    const evening = new Date("2026-08-16T03:00:00Z");
    expect(localDate(evening)).toBe("2026-08-15");
  });

  it("differs from toISOString() exactly where the old bug was", () => {
    const evening = new Date("2026-08-16T03:00:00Z");
    // This is the value the code used to write. Locking in the difference is
    // the point of the test — if these ever agree, the fix has been reverted.
    expect(evening.toISOString().slice(0, 10)).toBe("2026-08-16");
    expect(localDate(evening)).not.toBe(evening.toISOString().slice(0, 10));
  });

  it("agrees with UTC during local daytime", () => {
    const midday = new Date("2026-08-15T19:00:00Z"); // 12:00 local
    expect(localDate(midday)).toBe("2026-08-15");
  });

  it("emits YYYY-MM-DD with zero padding", () => {
    expect(localDate(new Date("2026-01-05T18:00:00Z"))).toBe("2026-01-05");
  });

  it("handles the year boundary in local terms", () => {
    // 2027-01-01T04:00Z is still 2026-12-31 in Los Angeles.
    expect(localDate(new Date("2027-01-01T04:00:00Z"))).toBe("2026-12-31");
  });
});
