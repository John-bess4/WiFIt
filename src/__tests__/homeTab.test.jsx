// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import HomeTab from "../HomeTab.jsx";
import { ThemeCtx, THEMES } from "../lib/theme.js";
import { GOAL_OZ } from "../App.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The strings the export's DEMO object would print. If any of these appear
// with EMPTY props, a demo fallback survived the port. This is the test a
// component that still has fallbacks passes only when given real data.
const DEMO_STRINGS = ["790", "Push day", "Vitamin D3", "182.4", "Oats"];

const EMPTY = { log: { breakfast: [], lunch: [], dinner: [], snacks: [] }, suppList: [], weightLog: [], workoutHistory: [], goals: { cal: 2200, protein: 140, carbs: 180, fat: 78 } };

let container, root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = (props) => act(() => root.render(
  <ThemeCtx.Provider value={THEMES.pastel_light}>
    <HomeTab setTab={() => {}} {...props} />
  </ThemeCtx.Provider>
));
const text = () => container.textContent;

describe("HomeTab — no demo data reaches a real user", () => {
  it("renders every empty state and none of the demo numbers with empty props", async () => {
    await render({ ...EMPTY, weekHistory: {} });
    for (const s of DEMO_STRINGS) expect(text()).not.toContain(s);
    expect(text()).toContain("Nothing logged yet");
    expect(text()).toContain("No plan scheduled");
    expect(text()).toContain("ADD YOUR FIRST SUPPLEMENT");
    expect(text()).toContain("Not logged yet");
    expect(text()).toContain("0 EATEN");
  });

  it("shows the retry line when the week read failed, and not for a pre-creation week", async () => {
    await render({ ...EMPTY, weekHistory: null });
    expect(text()).toContain("Couldn't load this week");
    expect(text()).toContain("Retry");
    // fresh account: every prior day is before created_at — dim rings, NO retry
    await render({ ...EMPTY, weekHistory: {}, profileCreatedAt: new Date().toISOString() });
    expect(text()).not.toContain("Couldn't load this week");
  });

  it("Retry calls onRetryWeek", async () => {
    const onRetryWeek = vi.fn();
    await render({ ...EMPTY, weekHistory: null, onRetryWeek });
    const retry = [...container.querySelectorAll("span")].find((s) => s.textContent === "Retry");
    await act(async () => retry.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onRetryWeek).toHaveBeenCalledTimes(1);
  });
});

describe("HomeTab — one source of truth for eaten", () => {
  it("200g at per100 cal 100 -> hero 200 EATEN and Meals header 200 KCAL", async () => {
    const log = { ...EMPTY.log, lunch: [{ name: "Rice", grams: 200, per100: { cal: 100, protein: 2, carbs: 28, fat: 0.3 } }] };
    await render({ ...EMPTY, log, weekHistory: {} });
    expect(container.querySelector('[data-testid="hero-eaten"]').textContent).toBe("200 EATEN");
    expect(container.querySelector('[data-testid="meals-kcal"]').textContent).toBe("200 KCAL · 1 LOGGED");
  });
});

describe("HomeTab — writes go to the existing App handlers", () => {
  it("capsule click calls toggleSuppTaken(k, true) exactly once", async () => {
    const toggleSuppTaken = vi.fn();
    await render({ ...EMPTY, weekHistory: {}, suppList: [{ k: "s1", name: "Creatine" }], suppTaken: {}, toggleSuppTaken });
    const cap = container.querySelector('[data-testid="capsule-s1"]');
    await act(async () => cap.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(toggleSuppTaken).toHaveBeenCalledTimes(1);
    expect(toggleSuppTaken).toHaveBeenCalledWith("s1", true);
  });

  it("water +8 calls setWaterOz once, clamped at GOAL_OZ", async () => {
    const setWaterOz = vi.fn();
    await render({ ...EMPTY, weekHistory: {}, waterOz: GOAL_OZ - 4, setWaterOz });
    const add = container.querySelector('[data-testid="water-add"]');
    await act(async () => add.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(setWaterOz).toHaveBeenCalledTimes(1);
    expect(setWaterOz).toHaveBeenCalledWith(GOAL_OZ);
  });
});

describe("HomeTab — seeded starter plans are a suggestion, not a schedule", () => {
  const plan = { id: "w1", name: "Push Day", tag: "Upper Body", estMin: 55, exercises: [{ name: "Bench Press", sets: [{ reps: 8 }] }] };
  it("labels a seeded plan SUGGESTED and a user plan TODAY", async () => {
    await render({ ...EMPTY, weekHistory: {}, todayPlan: plan, todayPlanSeeded: true });
    expect(text()).toContain("SUGGESTED · UPPER BODY");
    expect(text()).not.toContain("TODAY · UPPER BODY");
    await render({ ...EMPTY, weekHistory: {}, todayPlan: plan, todayPlanSeeded: false });
    expect(text()).toContain("TODAY · UPPER BODY");
  });
});
