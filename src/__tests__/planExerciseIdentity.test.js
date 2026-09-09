import { describe, it, expect } from "vitest";
import { withPlanExerciseIDs } from "../lib/workouts.js";

describe("imported workout exercise identity",()=>{
  it("keeps separate same-name exercises editable without mutating incoming data",()=>{
    const source=[{name:"Squat",sets:[{reps:8}]},{name:"Squat",sets:[{reps:12}]}];
    const rows=withPlanExerciseIDs(source);
    expect(new Set(rows.map(e=>e.id)).size).toBe(2);
    expect(rows.filter(e=>e.id!==rows[0].id)).toEqual([rows[1]]);
    expect(rows.map(exercise=>({name:exercise.name,sets:exercise.sets}))).toEqual(source);
    expect(source.every(e=>!("id" in e))).toBe(true);
    expect(withPlanExerciseIDs(source)).toEqual(rows);
  });
  it("preserves existing IDs and avoids collisions with generated or repeated IDs",()=>{
    const rows=withPlanExerciseIDs([{id:"plan-exercise-1",name:"A"},{name:"B"},{id:"same",name:"C"},{id:"same",name:"D"},{id:0,name:"E"}]);
    expect(rows[0].id).toBe("plan-exercise-1");
    expect(rows[2].id).toBe("same");
    expect(rows[4].id).toBe(0);
    expect(new Set(rows.map(e=>e.id)).size).toBe(5);
    expect(withPlanExerciseIDs(rows)).toEqual(rows);
  });
  it("handles plans without an exercise list",()=>{
    expect(withPlanExerciseIDs(null)).toEqual([]);
  });
});
