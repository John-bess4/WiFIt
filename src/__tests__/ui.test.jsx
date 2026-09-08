// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mono, Card, SectionHeader, EmptyState, FailedState, MacroRow } from "../lib/ui.jsx";
import { THEMES } from "../lib/theme.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const T = THEMES.pastel_light;
let el, root;
beforeEach(() => { el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el); });
afterEach(() => { act(() => root.unmount()); el.remove(); });
const render = (node) => act(() => root.render(node));
const click = (node) => act(() => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("lib/ui primitives", () => {
  it("mono is the tracked monospace label", () => {
    expect(mono(10.5, 0.12)).toEqual({ font: "600 10.5px/1 ui-monospace,Menlo,monospace", letterSpacing: "0.12em" });
    expect(mono(9, 0.1, 700).font.startsWith("700 ")).toBe(true);
  });
  it("Card is the theme surface with the shipped shell values", () => {
    render(<Card T={T} data-testid="c">hi</Card>);
    const c = el.querySelector('[data-testid="c"]');
    expect(c.textContent).toBe("hi");
    expect(c.style.borderRadius).toBe("22px");
    expect(c.style.margin).toBe("12px 18px 0px");
    expect(c.style.border.replace(/\s+/g, "")).toBe(("1px solid " + T.border).replace(/\s+/g, ""));
  });
  it("SectionHeader: info right is not clickable, action right is", () => {
    const onRight = vi.fn();
    render(<div><SectionHeader T={T} title="A" right="INFO" rightTestId="info" /><SectionHeader T={T} title="B" right="GO" onRight={onRight} rightTestId="go" /></div>);
    expect(el.querySelector('[data-testid="info"]').style.cursor).toBe("");
    expect(el.querySelector('[data-testid="go"]').style.cursor).toBe("pointer");
    click(el.querySelector('[data-testid="go"]'));
    expect(onRight).toHaveBeenCalledTimes(1);
  });
  it("EmptyState and FailedState carry their copy and their single action", () => {
    const onAction = vi.fn(), onRetry = vi.fn();
    render(<div><EmptyState T={T} message="Nothing logged yet" action="LOG" onAction={onAction} /><FailedState T={T} message="Couldn't load this week" onRetry={onRetry} /></div>);
    expect(el.textContent).toContain("Nothing logged yet");
    expect(el.textContent).toContain("Couldn't load this week");
    expect(el.textContent).toContain("Retry");
    const spans = [...el.querySelectorAll("span")];
    click(spans.find((s) => s.textContent === "LOG")); click(spans.find((s) => s.textContent === "Retry"));
    expect(onAction).toHaveBeenCalledTimes(1); expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("MacroRow renders three macros with their goals", () => {
    render(<MacroRow T={T} macros={[{ label: "PROTEIN", value: 31, goal: 185 }, { label: "CARBS", value: 0, goal: 345 }, { label: "FAT", value: 4, goal: 79 }]} />);
    expect(el.textContent).toContain("31/185g"); expect(el.textContent).toContain("FAT");
  });
});
