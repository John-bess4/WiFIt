// The last line, not the guard. One malformed row took the whole Train tab
// down (e.sets.length on a row without sets) and the legacy-theme blank screen
// in Home Phase 1 was the same shape: a render throw with no way back except a
// reload. This turns that into a card that names the tab and the error and
// offers a remount — the other tabs keep working.
//
// The fallback is LOUD on purpose. It must never look like a valid state:
// "No workout history yet" on a crash would be the laundering bug in its worst
// form. Rows are normalised at the read boundary (normalizeSession et al.);
// this exists for whatever that misses.
//
// A class because error boundaries can only be classes. T comes in as a prop
// rather than through ThemeCtx: App.jsx imports this file, so reading the
// context object at class-definition time would race the circular import.
import React from "react";

export default class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // The grep the browser-side verification depends on, same shape as [sb.*].
    console.error("[tab-crash]", this.props.name, error?.message || String(error), info?.componentStack || "");
  }
  retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  render() {
    const { T = {}, name = "This tab", children } = this.props;
    const { error, attempt } = this.state;
    if (error) {
      const msg = error?.message || String(error);
      return (
        <div data-testid="tab-crash" style={{ padding: "16px", minHeight: "60vh" }}>
          <div style={{ background: T.card || "#fff", border: "1px solid " + (T.red || "#EF4444"), borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.red || "#EF4444", marginBottom: 6 }}>{name} couldn't render.</div>
            <div style={{ fontSize: 12, color: T.text || "#111", marginBottom: 4 }}>This is an app error, not an empty state — your data is unchanged.</div>
            <div data-testid="tab-crash-message" style={{ fontSize: 11, color: T.muted || "#666", fontFamily: "ui-monospace, monospace", wordBreak: "break-word", marginBottom: 12 }}>{msg}</div>
            <button type="button" onClick={this.retry} style={{ background: T.accent || "#4F46E5", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Retry</button>
          </div>
        </div>
      );
    }
    // attempt in the key remounts the subtree on Retry instead of re-rendering
    // the same instance into the same throw.
    return <React.Fragment key={attempt}>{children}</React.Fragment>;
  }
}
