import { describe, it, expect } from "vitest";
import { weekDays, reduceWeekRows, summarizeWeek, streakFrom, isOnTarget, todayPlanFor } from "../lib/weekSummary.js";

// A fixed week: Mon 2026-08-31 .. Sun 2026-09-06, "today" = Sat 2026-09-05.
const TODAY = "2026-09-05";
const days = weekDays(new Date(2026, 8, 5));
const hist = (cals) => Object.fromEntries(days.slice(0, 5).map((d, i) => [d.ds, { cal: cals[i], foodLogged: cals[i] > 0, waterOz: 0, suppsTaken: 0 }]));

describe("weekDays", () => {
  it("is Mon..Sun containing today, matching the old WeekStrip", () => {
    expect(days.map((d) => d.ds)).toEqual(["2026-08-31","2026-09-01","2026-09-02","2026-09-03","2026-09-04","2026-09-05","2026-09-06"]);
    expect(days[0].label).toBe("Mon");
  });
});

describe("summarizeWeek — on-target count", () => {
  it("counts logged days within ±10% of goal; denominator is Monday..today", () => {
    // 2000 goal: 1850 in, 2150 in, 1700 out, 2300 out, 0 (not logged)
    const s = summarizeWeek({ days, history: hist([1850, 2150, 1700, 2300, 0]), today: { cal: 2050 }, todayStr: TODAY, goalCal: 2000 });
    expect(s.eligible).toBe(6);   // Mon..Sat
    expect(s.onTarget).toBe(3);   // Mon, Tue, today
    expect(s.days[6].state).toBe("future");
  });

  it("excludes days before account creation from the denominator", () => {
    const s = summarizeWeek({ days, history: hist([1900, 1900, 1900, 1900, 1900]), today: { cal: 1900 }, todayStr: TODAY, goalCal: 2000, createdAt: "2026-09-03T10:00:00Z" });
    expect(s.days.slice(0, 3).map((d) => d.state)).toEqual(["pre", "pre", "pre"]);
    expect(s.eligible).toBe(3);   // Thu, Fri, Sat
    expect(s.onTarget).toBe(3);
  });

  it("judges created_at as a LOCAL date — an evening signup is not pre-creation on its own first day", () => {
    // 2026-09-06 23:50 PDT is 2026-09-07 06:50Z. Today (Sat 09-05 in this fixture) must still be eligible
    // when created_at is 2026-09-05T23:50 PDT = 2026-09-06T06:50Z.
    const s = summarizeWeek({ days, history: {}, today: { cal: 300 }, todayStr: TODAY, goalCal: 2000, createdAt: "2026-09-06T06:50:00Z" });
    expect(s.days[5].state).toBe("day");
    expect(s.eligible).toBe(1);
    expect(s.days[4].state).toBe("pre");
  });

  it("renders prior days as unknown (not empty) when history is null", () => {
    const s = summarizeWeek({ days, history: null, today: { cal: 500 }, todayStr: TODAY, goalCal: 2000 });
    expect(s.days.slice(0, 5).every((d) => d.state === "unknown")).toBe(true);
    expect(s.days[5].state).toBe("day");
    expect(s.eligible).toBe(1);
  });

  it("test-the-test: at ±0% tolerance the count changes", () => {
    expect(isOnTarget(1850, 2000)).toBe(true);
    expect(isOnTarget(1850, 2000, 0)).toBe(false);
    const s = summarizeWeek({ days, history: hist([1850, 2150, 1700, 2300, 0]), today: { cal: 2050 }, todayStr: TODAY, goalCal: 2000 });
    expect(s.onTarget).not.toBe(0);
  });
});

describe("streakFrom", () => {
  const run = (todayLogged) => summarizeWeek({ days, history: hist([2000, 2000, 2000, 2000, 2000]), today: { cal: todayLogged ? 1200 : 0 }, todayStr: TODAY, goalCal: 2000 }).days;
  it("5-day run with today unlogged -> 5 (an unlogged morning is not a broken streak)", () => {
    expect(streakFrom(run(false), TODAY)).toBe(5);
  });
  it("5-day run with today logged -> 6", () => {
    expect(streakFrom(run(true), TODAY)).toBe(6);
  });
  it("stops at a gap", () => {
    const d = summarizeWeek({ days, history: hist([2000, 0, 2000, 2000, 2000]), today: { cal: 0 }, todayStr: TODAY, goalCal: 2000 }).days;
    expect(streakFrom(d, TODAY)).toBe(3);
  });
  it("is null when prior days are unknown, so the chip can hide", () => {
    const d = summarizeWeek({ days, history: null, today: { cal: 0 }, todayStr: TODAY, goalCal: 2000 }).days;
    expect(streakFrom(d, TODAY)).toBeNull();
  });
});

describe("reduceWeekRows", () => {
  it("sums cal with calc()'s arithmetic and marks foodLogged", () => {
    const m = reduceWeekRows({ food: [{ logged_date: "2026-09-01", grams: 200, per100_cal: 100 }, { logged_date: "2026-09-01", grams: 50, per100_cal: 400 }], water: [{ log_date: "2026-09-01", oz: 40 }], supp: [{ log_date: "2026-09-01", taken: true }, { log_date: "2026-09-01", taken: false }] });
    expect(m["2026-09-01"]).toEqual({ cal: 400, foodLogged: true, waterOz: 40, suppsTaken: 1 });
  });
});

describe("todayPlanFor", () => {
  it("matches scheduledDay by weekday name, else the first plan", () => {
    const plans = [{ id: "a", scheduledDay: "Monday" }, { id: "b", scheduledDay: "Saturday" }];
    expect(todayPlanFor(plans, new Date(2026, 8, 5)).id).toBe("b");   // Saturday
    expect(todayPlanFor(plans, new Date(2026, 8, 2)).id).toBe("a");   // Wednesday -> first
    expect(todayPlanFor([], new Date())).toBeNull();
  });
});
