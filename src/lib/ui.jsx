// Shared UI primitives — the card shell, section header, empty/failed states
// and the macro row that every redesigned screen (Home now; Food, Train, Supps
// next) is built from. One implementation, so three screens cannot drift.
//
// Everything takes the theme object T explicitly (no context read here), and
// every colour comes from T — no hex in this file. Values are the ones the
// shipped Home uses; do not invent new ones on a screen, pass them in.
//
//   mono(size, spacing, weight)  the label typeface: ui-monospace, tracked
//   Card                          borderRadius 18–22, T.homeSurface, 1px T.border,
//                                 T.lift — the container for every section
//   SectionHeader                 title left (14/650), info or action right in
//                                 mono(10.5); an action is clickable and tracked
//                                 a little wider
//   EmptyState                    one line: message left, single action right.
//                                 Renders ONLY when the section has no data —
//                                 a failed read renders FailedState, never this
//   FailedState                   "Couldn't load …" · Retry — the WeekRail
//                                 pattern. null means failed, [] means empty
//   MacroRow                      the three-macro accent surface from Home


export const mono = (size, spacing, weight = 600) => ({ font: weight + " " + size + "px/1 ui-monospace,Menlo,monospace", letterSpacing: spacing + "em" });

export function Card({ T, radius = 22, margin = "12px 18px 0", padding, border, shadow, background, style, children, ...rest }) {
  return (
    <div style={{ margin, padding, borderRadius: radius, background: background ?? T.homeSurface, border: "1px solid " + (border ?? T.border), boxShadow: shadow ?? T.lift, ...style }} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({ T, title, right, onRight, rightColor, rightTestId, align = "baseline", marginBottom = 12, titleStyle, style }) {
  const action = typeof onRight === "function";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: align, marginBottom, ...style }}>
      <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-.01em", color: T.text, ...titleStyle }}>{title}</span>
      {right !== undefined && right !== null && (
        <span data-testid={rightTestId} onClick={onRight} style={{ ...mono(10.5, action ? 0.12 : 0.1), color: rightColor ?? T.accentText, cursor: action ? "pointer" : undefined }}>{right}</span>
      )}
    </div>
  );
}

export function EmptyState({ T, message, action, onAction, actionColor, padding = "10px 0 8px", style, testId }) {
  return (
    <div data-testid={testId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding, ...style }}>
      <span style={{ fontSize: 13, color: T.muted }}>{message}</span>
      {action && <span onClick={onAction} style={{ ...mono(10.5, 0.12), color: actionColor ?? T.accentText, cursor: "pointer" }}>{action}</span>}
    </div>
  );
}

export function FailedState({ T, message, onRetry, padding = "7px 0 2px", style, testId }) {
  return (
    <div data-testid={testId} style={{ display: "flex", justifyContent: "center", gap: 8, padding, ...mono(9, 0.1), color: T.muted, ...style }}>
      <span>{message}</span><span>·</span>
      <span onClick={onRetry} style={{ color: T.accentText, cursor: "pointer" }}>Retry</span>
    </div>
  );
}

export function MacroRow({ T, macros }) {
  return (
    <div style={{ margin: "2px 18px 0", padding: "16px 18px 14px", borderRadius: 22, background: T.accentSurface, border: "1px solid " + T.borderStrong, boxShadow: "0 0 26px " + T.glowSoft + ",inset 0 0 26px " + T.glowInner }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {macros.map((m, i) => (
          <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}><span style={{ fontSize: 17, fontWeight: 650, color: T.text }}>{Math.round(m.value)}</span><span style={{ fontSize: 11, color: T.muted }}>/{m.goal}g</span></div>
            <div style={{ height: 4, borderRadius: 3, background: T.track }}><div style={{ width: Math.min(100, m.goal > 0 ? (m.value / m.goal) * 100 : 0) + "%", height: "100%", borderRadius: 3, background: "linear-gradient(90deg," + T.macroPair[i][0] + "," + T.macroPair[i][1] + ")", boxShadow: i === 0 ? "0 0 10px " + T.glow : "none", transition: "width .5s ease" }} /></div>
            <span style={{ ...mono(8.5, 0.2), color: T.macro[i] }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
