import { describe, it, expect } from "vitest";
import { normalizeExercises, sessionFromRow, setLabel, parseSetLabel } from "../App.jsx";

// The read-boundary guard. Whatever the row looks like, the reader gets
// {name, sets[], setsData[]} with sets.length === setsData.length, and the
// labels always agree with the numbers the views read.
describe("normalizeExercises", () => {
  it("passes a well-formed exercise through unchanged", () => {
    const ex = [{ name: "Bench", sets: ["8×135lbs", "6×145lbs"], setsData: [{ reps: 8, weight: 135 }, { reps: 6, weight: 145 }] }];
    expect(normalizeExercises(ex)).toEqual(ex);
  });
  it("returns [] for anything that is not an array, and drops non-object entries", () => {
    expect(normalizeExercises("not-an-array")).toEqual([]);
    expect(normalizeExercises(null)).toEqual([]);
    expect(normalizeExercises([null, 3, "x", [1], { name: "Row", setsData: [{ reps: 10, weight: 60 }] }])).toEqual([{ name: "Row", sets: ["10×60lbs"], setsData: [{ reps: 10, weight: 60 }] }]);
  });
  it("derives setsData from labels when only labels exist (pre-backfill shape)", () => {
    expect(normalizeExercises([{ name: "Squat", sets: ["5×225lbs", "5×27.5lbs"] }])).toEqual([{ name: "Squat", sets: ["5×225lbs", "5×27.5lbs"], setsData: [{ reps: 5, weight: 225 }, { reps: 5, weight: 27.5 }] }]);
  });
  it("derives labels from setsData when only numbers exist (the seed shape that crashed Train)", () => {
    expect(normalizeExercises([{ name: "Deadlift", setsData: [{ reps: 3, weight: 315 }] }])).toEqual([{ name: "Deadlift", sets: ["3×315lbs"], setsData: [{ reps: 3, weight: 315 }] }]);
  });
  it("rebuilds labels from setsData when the two disagree in length — the numbers win", () => {
    const out = normalizeExercises([{ name: "OHP", sets: ["5×95lbs"], setsData: [{ reps: 5, weight: 95 }, { reps: 5, weight: 100 }] }]);
    expect(out[0].sets).toEqual(["5×95lbs", "5×100lbs"]);
    expect(out[0].sets.length).toBe(out[0].setsData.length);
  });
  it("coerces garbage numbers to 0 and a missing name to 'Exercise'", () => {
    expect(normalizeExercises([{ setsData: [{ reps: "x", weight: null }] }])).toEqual([{ name: "Exercise", sets: ["0×0lbs"], setsData: [{ reps: 0, weight: 0 }] }]);
  });
  it("setLabel and parseSetLabel round-trip", () => {
    for (const d of [{ reps: 8, weight: 135 }, { reps: 12, weight: 27.5 }, { reps: 1, weight: 0 }]) expect(parseSetLabel(setLabel(d))).toEqual(d);
    expect(parseSetLabel("garbage")).toBeNull();
  });
});

describe("sessionFromRow", () => {
  it("maps a row and normalises its exercises", () => {
    const s = sessionFromRow({ id: "u1", workout_name: "Push", completed_date: "2026-09-01", duration_secs: 1800, sets_completed: 9, total_sets: 12, exercises: [{ name: "Bench", setsData: [{ reps: 8, weight: 135 }] }] });
    expect(s).toEqual({ id: "u1", workoutName: "Push", date: "2026-09-01", duration: 1800, setsCompleted: 9, totalSets: 12, exercises: [{ name: "Bench", sets: ["8×135lbs"], setsData: [{ reps: 8, weight: 135 }] }] });
  });
  it("survives a row with nulls everywhere", () => {
    const s = sessionFromRow({ id: "u2", workout_name: null, completed_date: null, duration_secs: null, exercises: "not-an-array" });
    expect(s).toEqual({ id: "u2", workoutName: "Workout", date: "", duration: 0, setsCompleted: 0, totalSets: 0, exercises: [] });
  });
});
