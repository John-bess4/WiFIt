// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TabErrorBoundary from "../TabErrorBoundary.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let shouldThrow = true;
function Child() {
  if (shouldThrow) throw new Error("Cannot read properties of undefined (reading 'length')");
  return <div data-testid="ok">No workout history yet</div>;
}

describe("TabErrorBoundary", () => {
  let el, root, errSpy;
  beforeEach(() => { el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el); errSpy = vi.spyOn(console, "error").mockImplementation(() => {}); shouldThrow = true; });
  afterEach(() => { act(() => root.unmount()); el.remove(); errSpy.mockRestore(); });

  it("renders a loud fallback naming the tab and the error — never an empty state", () => {
    act(() => { root.render(<TabErrorBoundary T={{}} name="Train"><Child /></TabErrorBoundary>); });
    const crash = el.querySelector('[data-testid="tab-crash"]');
    expect(crash).not.toBeNull();
    expect(crash.textContent).toContain("Train couldn't render.");
    expect(el.querySelector('[data-testid="tab-crash-message"]').textContent).toContain("reading 'length'");
    // The thing this exists to prevent: a crash that reads like a valid state.
    expect(el.textContent).not.toContain("No workout history yet");
    // The grep-able console line, same discipline as [sb.*].
    expect(errSpy.mock.calls.some((c) => c[0] === "[tab-crash]" && c[1] === "Train")).toBe(true);
  });

  it("Retry remounts the subtree", () => {
    act(() => { root.render(<TabErrorBoundary T={{}} name="Train"><Child /></TabErrorBoundary>); });
    expect(el.querySelector('[data-testid="tab-crash"]')).not.toBeNull();
    shouldThrow = false;
    act(() => { el.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(el.querySelector('[data-testid="tab-crash"]')).toBeNull();
    expect(el.querySelector('[data-testid="ok"]')).not.toBeNull();
  });
});
