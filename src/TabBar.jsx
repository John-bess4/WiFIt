// Bottom tab bar with the raised quick-add button and its fan, lifted from the
// design export's HomeNav. Rendered once by App for every tab; replaces the
// old fixed nav. Keys are the App's tab keys. No colour is hardcoded — every
// value comes from the theme, including the fan's bubble surfaces.
import { useEffect, useId, useState } from "react";
import { useTheme } from "./lib/theme.js";

const NAV_ITEMS = [
  { key: "home", label: "Home", path: "M4 10.4 12 4l8 6.4V20h-5.4v-5.2H9.4V20H4z", join: true },
  { key: "food", label: "Food", path: "M12 8v4.2l3 1.8", circle: true },
  { key: "workout", label: "Train", path: "M5 9v6M8 7v10M16 7v10M19 9v6M8 12h8", cap: true },
  { key: "supps", label: "Supps", pill: true },
];

// [label, glyph, accent index, onAddOpen key]. Only items that map to something
// that exists today; "Session" and "New supp" navigate, which is honest as long
// as they land where the user can act immediately. Cut: Recipe, Exercise,
// Cardio, New PR, Reminder (needs a supplement first), Refill.
export const QUICK_ADD = {
  home:    [["Meal", "+", 1, "meal"], ["Water", "~", 0, "water"], ["Dose", "/", 2, "supp"], ["Workout", "↑", 3, "workout"]],
  food:    [["Meal", "+", 1, "meal"], ["Scan", "|||", 0, "scan"], ["Water", "~", 0, "water"]],
  workout: [["Session", "↑", 3, "session"]],
  supps:   [["Dose", "/", 2, "supp"], ["New supp", "+", 2, "newsupp"]],
};

export default function TabBar({ active, setTab, onAdd, workoutInProgress = false }) {
  const T = useTheme();
  const uid = useId().replace(/[:]/g, "");
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [active]); // fan closes on tab change

  const idx = Math.max(0, NAV_ITEMS.findIndex((i) => i.key === active));
  const slot = idx < 2 ? idx : idx + 1;
  const accents = [T.water, T.macroPair[1][1], T.supp, T.accent];
  const items = QUICK_ADD[active] || QUICK_ADD.home;
  const angles = items.length === 1 ? [0] : items.length === 2 ? [-24, 24] : items.length === 3 ? [-40, 0, 40] : [-54, -18, 18, 54];
  const actions = items.map(([label, mark, tone, key], i) => {
    const deg = (angles[i] * Math.PI) / 180;
    return { label, mark, key, color: accents[tone], dx: Math.round(108 * Math.sin(deg)), dy: Math.round(-108 * Math.cos(deg)), delay: (open ? i * 45 : (items.length - 1 - i) * 30) + "ms" };
  });

  return (
    <div style={{ position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 99, padding: "0 12px calc(10px + env(safe-area-inset-bottom))", pointerEvents: "none" }}>
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: T.navShadow ? "rgba(7,5,12,.55)" : "rgba(7,5,12,.55)", backdropFilter: "blur(6px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .3s ease" }} />
      <div style={{ position: "relative", height: 104, pointerEvents: "auto" }}>
        <svg viewBox="0 0 366 76" preserveAspectRatio="none" fill="none" style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 76, filter: "drop-shadow(" + T.navShadow + ")" }}>
          <defs>
            <linearGradient id={"navFill" + uid} x1="0" y1="0" x2="0" y2="1"><stop stopColor={T.navA} /><stop offset="1" stopColor={T.navB} /></linearGradient>
            <linearGradient id={"navEdge" + uid} x1="0" y1="0" x2="1" y2="0"><stop stopColor="rgba(0,0,0,0)" /><stop offset="0.3" stopColor={T.fab[0]} /><stop offset="0.5" stopColor={T.fab[0]} /><stop offset="0.7" stopColor={T.fab[2]} /><stop offset="1" stopColor="rgba(0,0,0,0)" /></linearGradient>
          </defs>
          <path d="M22 10 H148 A35 35 0 0 0 218 10 H344 A22 22 0 0 1 366 32 V54 A22 22 0 0 1 344 76 H22 A22 22 0 0 1 0 54 V32 A22 22 0 0 1 22 10 Z" fill={"url(#navFill" + uid + ")"} />
          <path d="M22 10 H148 A35 35 0 0 0 218 10 H344" stroke={"url(#navEdge" + uid + ")"} strokeWidth="1.5" strokeLinecap="round" style={{ animation: "wfNavBreathe 4.6s ease-in-out infinite" }} />
        </svg>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 66, display: "grid", gridTemplateColumns: "repeat(5,1fr)", alignItems: "center" }}>
          <div style={{ position: "absolute", top: 6, left: "calc(" + (slot + 0.5) * 20 + "% - 26px)", width: 52, height: 54, borderRadius: 18, background: "linear-gradient(180deg," + T.glow + ",transparent)", border: "1px solid " + T.borderStrong, boxShadow: "0 0 26px " + T.glowSoft, transition: "left .44s cubic-bezier(.5,1.5,.4,1)" }} />
          <div style={{ position: "absolute", bottom: -4, left: "calc(" + (slot + 0.5) * 20 + "% - 26px)", width: 52, display: "grid", placeItems: "center", transition: "left .44s cubic-bezier(.5,1.5,.4,1)" }}>
            <div style={{ width: 26, height: 3, borderRadius: 3, background: T.fab[0], boxShadow: "0 0 14px " + T.glow }} />
          </div>
          {NAV_ITEMS.map((item, i) => {
            const on = item.key === active;
            const node = (
              <div key={item.key} data-tab={item.key} onClick={() => setTab(item.key)} style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={on ? T.navOn : T.navOff} strokeWidth="1.8" strokeLinejoin={item.join ? "round" : undefined} strokeLinecap={item.cap ? "round" : undefined} style={{ transform: on ? "scale(1.12) translateY(-1px)" : "scale(1)", transition: "transform .34s cubic-bezier(.5,1.5,.4,1)" }}>
                  {item.circle && <circle cx="12" cy="12" r="8" />}
                  {item.pill && <><rect x="3.4" y="8.6" width="17" height="7" rx="3.5" transform="rotate(-38 12 12)" /><path d="M9.4 14.6 14.6 9.4" /></>}
                  {item.path && <path d={item.path} />}
                </svg>
                <span style={{ fontSize: 9, fontWeight: on ? 650 : 500, color: on ? T.navOn : T.navOff, transition: "color .3s" }}>{item.label}</span>
                {item.key === "workout" && workoutInProgress && <div data-testid="workout-dot" style={{ position: "absolute", top: -2, right: 4, width: 8, height: 8, borderRadius: "50%", background: T.accent, boxShadow: "0 0 6px " + T.accentGlow }} />}
              </div>
            );
            return i === 2 ? [<div key="gap" />, node] : node;
          })}
        </div>

        {actions.map((a, i) => (
          <div key={a.key + i} data-fan={a.key} onClick={() => { setOpen(false); onAdd(a.key); }} style={{ position: "absolute", left: "calc(50% + " + (a.dx - 27) + "px)", top: -75 + a.dy, width: 54, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, zIndex: 4, cursor: "pointer", opacity: open ? 1 : 0, transform: open ? "scale(1) translateY(0)" : "scale(.3) translateY(26px)", transition: "transform .34s cubic-bezier(.4,1.5,.4,1) " + a.delay + ",opacity .26s ease " + a.delay, pointerEvents: open ? "auto" : "none" }}>
            <div style={{ width: 54, height: 54, borderRadius: 20, background: "linear-gradient(165deg," + T.navA + "," + T.navB + ")", border: "1px solid " + a.color, boxShadow: "0 10px 24px " + T.glowSoft + ",0 0 22px " + a.color, display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: a.color }}>{a.mark}</span>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: T.navOn, whiteSpace: "nowrap" }}>{a.label}</span>
          </div>
        ))}

        <div data-testid="quick-add" onClick={() => setOpen((o) => !o)} style={{ position: "absolute", left: "50%", bottom: 37, width: 58, height: 58, marginLeft: -29, zIndex: 5, cursor: "pointer" }}>
          <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "radial-gradient(circle," + T.glow + " 0%," + T.glowSoft + " 45%,transparent 72%)", filter: "blur(7px)", animation: "wfFabHalo 3.6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", padding: 2, overflow: "hidden", background: "conic-gradient(from 210deg," + T.fab[0] + "," + T.fab[1] + " 45%," + T.fab[2] + " 75%," + T.fab[0] + ")", boxShadow: "0 10px 22px " + T.glowSoft + ",0 0 18px " + T.glow, transform: open ? "scale(1.06)" : "scale(1)", transition: "transform .34s cubic-bezier(.5,1.5,.4,1)" }}>
            <div style={{ position: "absolute", top: "-50%", left: "-50%", width: "200%", height: "200%", background: "conic-gradient(from 0deg,transparent 0deg,transparent 232deg," + T.tracer[0] + " 268deg," + T.tracer[0] + " 296deg," + T.tracer[1] + " 314deg," + T.tracer[0] + " 332deg,transparent 350deg,transparent 360deg)", filter: "blur(.4px)", animation: "wfTrace 3.4s linear infinite" }} />
            <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", background: "linear-gradient(160deg," + T.fab[1] + "," + T.fabBase + ")", display: "grid", placeItems: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.fabInk} strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? "rotate(135deg)" : "rotate(0deg)", transition: "transform .34s cubic-bezier(.5,1.5,.4,1)" }}><path d="M12 5v14M5 12h14" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
