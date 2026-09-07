// Pure helpers behind the Home week rail. No React, no DOM, no fetch.
// Tested in src/__tests__/weekSummary.test.js.
//
// The Mon–Sun builder is lifted from the old WeekStrip so the rail derives its
// week the same way the rest of the app does (Calendar, WeekStrip before it),
// rather than "7 days ending today".

export const ON_TARGET_TOLERANCE = 0.10;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const iso = (d) => d.toLocaleDateString("en-CA");

// Mon..Sun containing `today`. Each: { ds, label, num }.
export function weekDays(today = new Date()) {
  const dow = today.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today); monday.setDate(today.getDate() + diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return { ds: iso(d), label: DOW[i], num: d.getDate() };
  });
}

// Reduces the three range reads into { [date]: {cal, foodLogged, waterOz, suppsTaken} }.
// cal uses the same per-row arithmetic as calc(): round(per100_cal * grams / 100).
export function reduceWeekRows({ food = [], water = [], supp = [] }) {
  const out = {};
  const day = (ds) => (out[ds] ||= { cal: 0, foodLogged: false, waterOz: 0, suppsTaken: 0 });
  food.forEach((r) => { const d = day(r.logged_date); d.cal += Math.round(((r.per100_cal || 0) * (r.grams || 0)) / 100); d.foodLogged = true; });
  water.forEach((r) => { day(r.log_date).waterOz = r.oz || 0; });
  supp.forEach((r) => { if (r.taken) day(r.log_date).suppsTaken += 1; });
  return out;
}

export const isOnTarget = (cal, goal, tol = ON_TARGET_TOLERANCE) =>
  goal > 0 && Math.abs(cal - goal) <= goal * tol;

/**
 * Builds the rail. `history` is the reduced week map for PRIOR days, or null
 * when the read failed — null is rendered as "couldn't load", never as empty.
 * `today` is always live from props.
 *
 * Day states: "pre" (before account creation), "future", "unknown" (history
 * null), "day". Only "day" and today count toward the on-target denominator.
 */
export function summarizeWeek({ days, history, today, todayStr, workoutDates = new Set(), createdAt = null, goalCal = 2200, suppsTotal = 0 }) {
  // profiles.created_at is a UTC timestamptz. A 7pm PDT signup is already
  // "tomorrow" in UTC, so slicing the string would make the account's own
  // first day pre-creation. Compare LOCAL dates, like every date in the app.
  const created = createdAt ? iso(new Date(createdAt)) : null;
  const out = days.map((d) => {
    const isToday = d.ds === todayStr;
    const base = { ...d, isToday, workout: workoutDates.has(d.ds), cal: 0, foodLogged: false, water: false, supps: false, onTarget: false };
    if (d.ds > todayStr) return { ...base, state: "future" };
    if (created && d.ds < created) return { ...base, state: "pre" };
    if (isToday) {
      const t = today || {};
      return { ...base, state: "day", cal: t.cal || 0, foodLogged: (t.cal || 0) > 0, water: (t.waterOz || 0) > 0, supps: suppsTotal > 0 && (t.suppsTaken || 0) >= suppsTotal, onTarget: (t.cal || 0) > 0 && isOnTarget(t.cal, goalCal) };
    }
    if (history === null) return { ...base, state: "unknown" };
    const h = history[d.ds] || { cal: 0, foodLogged: false, waterOz: 0, suppsTaken: 0 };
    return { ...base, state: "day", cal: h.cal, foodLogged: h.foodLogged, water: h.waterOz > 0, supps: suppsTotal > 0 && h.suppsTaken >= suppsTotal, onTarget: h.foodLogged && isOnTarget(h.cal, goalCal) };
  });
  const eligible = out.filter((d) => d.state === "day");
  return { days: out, onTarget: eligible.filter((d) => d.onTarget).length, eligible: eligible.length };
}

// Consecutive foodLogged days ending YESTERDAY, plus today only if logged —
// so an unlogged morning does not read as a broken streak. null when the
// prior days are unknown (history failed), so the chip can hide.
export function streakFrom(daysSummary, todayStr) {
  const idx = daysSummary.findIndex((d) => d.ds === todayStr);
  if (idx < 0) return 0;
  if (daysSummary.slice(0, idx).some((d) => d.state === "unknown")) return null;
  let n = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (daysSummary[i].state === "day" && daysSummary[i].foodLogged) n++; else break;
  }
  if (daysSummary[idx].foodLogged) n++;
  return n;
}

// The plan for today's weekday, or the first plan — the lookup WorkoutTab does.
export function todayPlanFor(workouts = [], date = new Date()) {
  const name = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  return workouts.find((w) => w.scheduledDay === name) || workouts[0] || null;
}
