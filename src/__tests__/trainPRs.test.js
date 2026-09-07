import { describe, it, expect } from "vitest";
import { computePRs, bestDoneWeight, setWeightOf, bestsFromSessions } from "../App.jsx";

const ex = (name, sets) => ({ name, sets: sets.map(([w, done]) => ({ actualWeight: w, actualReps: 8, done })) });

describe("F1 — 2.5 lb increments survive every reader", () => {
  it("parses 27.5 from a stored set string and from a live set", () => {
    expect(setWeightOf("8×27.5lbs")).toBe(27.5);
    expect(bestDoneWeight(ex("Curl", [[27.5, true]]))).toBe(27.5);
    expect(bestsFromSessions([{ exercises: [{ name: "Curl", sets: ["8×27.5lbs", "8×25lbs"] }] }])).toEqual({ Curl: 27.5 });
  });
  it("27.5 beats a recorded 27 (parseInt would have called it a tie)", () => {
    expect(computePRs([ex("Curl", [[27.5, true]])], { Curl: 27 })).toEqual(["Curl"]);
  });
});

describe("F2 — PRs are computed once from FINAL state", () => {
  const hist = { Bench: 150 };
  it("tick at 100, edit to 200, finish -> PR reflects 200", () => {
    // tick-time state would have said no PR (100 < 150); the final state says yes
    expect(computePRs([ex("Bench", [[100, true]])], hist)).toEqual([]);
    expect(computePRs([ex("Bench", [[200, true]])], hist)).toEqual(["Bench"]);
  });
  it("tick a PR then un-tick -> no PR", () => {
    expect(computePRs([ex("Bench", [[200, true]])], hist)).toEqual(["Bench"]);
    expect(computePRs([ex("Bench", [[200, false]])], hist)).toEqual([]);
  });
  it("a first-ever lift is a baseline, not a record; bodyweight sets never count", () => {
    expect(computePRs([ex("Squat", [[315, true]])], {})).toEqual([]);
    expect(computePRs([ex("Pull-up", [[0, true]])], { "Pull-up": 0 })).toEqual([]);
  });
  it("test-the-test: the old incremental list would keep a PR after un-ticking", () => {
    const appendOnly = []; const push = (n) => { if (!appendOnly.includes(n)) appendOnly.push(n); };
    push("Bench"); // ticked at 200
    // un-tick: the old code did nothing here
    expect(appendOnly).toEqual(["Bench"]);
    expect(computePRs([ex("Bench", [[200, false]])], hist)).toEqual([]);
  });
});
