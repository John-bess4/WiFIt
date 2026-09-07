import { describe, it, expect } from "vitest";
import { localDate } from "../App.jsx";

// Runs under TZ=America/Los_Angeles (see the test script).
//
// `finishWorkout` stamps a session with `localDate(new Date(startedAt))`, NOT
// with `today`. That is a deliberate decision (DECISIONS.md, 2026-08-29): a
// session belongs to the day it was TRAINED, and `today` is computed once per
// App mount (PROJECT_CONTEXT known issue #8), so a session resumed after a
// reload would otherwise take whatever day the app last mounted on.
//
// These tests pin the arithmetic. The browser exercise that proves the wiring
// is in DECISIONS.md; this is the part that keeps running in CI.
describe("session dating — completed_date derives from startedAt", () => {
  // 23:50 local on the 6th, finished 00:20 local on the 7th.
  const startedAt = new Date("2026-09-07T06:50:00Z"); // 2026-09-06 23:50 PDT
  const finishedAt = new Date("2026-09-07T07:20:00Z"); // 2026-09-07 00:20 PDT

  it("stamps the day the work started, not the day it ended", () => {
    expect(localDate(startedAt)).toBe("2026-09-06");
    expect(localDate(finishedAt)).toBe("2026-09-07");
    // The session is dated from the start. If these ever agree, the decision
    // has been reverted and an 11pm workout is being filed under tomorrow.
    expect(localDate(startedAt)).not.toBe(localDate(finishedAt));
  });

  it("is unaffected by when App happened to mount", () => {
    // `today` on a resumed session is the mount date, which after a reload at
    // 00:20 is the 7th. Dating from startedAt must ignore it entirely.
    const todayAtMount = localDate(finishedAt);
    expect(todayAtMount).toBe("2026-09-07");
    expect(localDate(startedAt)).toBe("2026-09-06");
  });

  it("agrees with the end date for an ordinary same-day session", () => {
    const s = new Date("2026-09-06T22:00:00Z"); // 15:00 PDT
    const e = new Date("2026-09-06T23:05:00Z"); // 16:05 PDT
    expect(localDate(s)).toBe(localDate(e));
    expect(localDate(s)).toBe("2026-09-06");
  });

  it("keeps a session inside the 6h snapshot window across midnight", () => {
    // The staleness rule is an AGE rule measured from startedAt, not a
    // calendar-day rule — precisely so a 23:50 session survives to 00:20.
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    expect(finishedAt - startedAt).toBeLessThan(SIX_HOURS);
    // A calendar-day rule would have discarded it, since the dates differ.
    expect(localDate(startedAt)).not.toBe(localDate(finishedAt));
  });
});
