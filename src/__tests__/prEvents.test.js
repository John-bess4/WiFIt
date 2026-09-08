import { describe, it, expect } from "vitest";
import { prEventsBySession } from "../lib/workouts.js";

// exercise_pr_events rows → {session_id: [exercise names]} for the history cards.
describe("prEventsBySession", () => {
  it("groups names by session and keeps sessions without events absent", () => {
    const m = prEventsBySession([
      { session_id: "s2", name: "Bench Press" },
      { session_id: "s4", name: "Deadlift" },
      { session_id: "s4", name: "Bench Press" },
    ]);
    expect(m).toEqual({ s2: ["Bench Press"], s4: ["Deadlift", "Bench Press"] });
    expect(m.s1).toBeUndefined();
  });
  it("is empty for no rows and for a null read", () => {
    expect(prEventsBySession([])).toEqual({});
    expect(prEventsBySession(null)).toEqual({});
  });
});
