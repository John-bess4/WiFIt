// Home tab — the redesigned screen from design-export/HomeTab.jsx, ported with
// the export's seven defects fixed (see docs/DECISIONS.md, 2026-09-06):
// no DEMO data — every section takes real props or renders its empty state;
// GOAL_OZ not WATER_GOAL; nav lifted out (Phase 3); capsule tap goes to the
// existing toggleSuppTaken; no food-item time column; keyframes covered by the
// global reduced-motion rule.
//
// Every write on this screen goes through the same App-level handler it hit
// before: setWaterOz, toggleSuppTaken, logWeight. Nothing here talks to sb.
import React, { useEffect, useId, useMemo, useState } from "react";
import { KEYFRAMES } from "./themes.js";
import { useTheme, calc, totals, localDate, GOAL_OZ, SEED } from "./App.jsx";
import { weekDays, summarizeWeek, streakFrom } from "./lib/weekSummary.js";

function useHomeKeyframes() {
  useEffect(() => {
    if (document.getElementById("wifit-home-kf")) return;
    const el = document.createElement("style");
    el.id = "wifit-home-kf"; el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);
}

const mono = (size, spacing, weight = 600) => ({ font: weight + " " + size + "px/1 ui-monospace,Menlo,monospace", letterSpacing: spacing + "em" });
const greeting = (h = new Date().getHours()) => (h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening");
const fmtTime = (hhmm) => { if (!hhmm) return ""; const [h, m] = hhmm.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return ((h % 12) || 12) + ":" + String(m).padStart(2, "0") + " " + ap; };

/* ── header ─────────────────────────────────────────────────────────────── */
function Header({ T, userName, streak, isDark, toggleTheme, onProfileOpen, onCoachOpen, onCalendarOpen, onProgressOpen }) {
  const initial = (userName || "You").trim().charAt(0).toUpperCase();
  const stamp = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).replace(",", " ·").toUpperCase();
  const iconBtn = { width: 32, height: 32, borderRadius: 11, background: T.homeSurface, border: "1px solid " + T.border, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
  return (
    <div style={{ padding: "12px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ ...mono(9, 0.22), color: T.muted }}>{stamp}</span>
        <span style={{ fontSize: 21, fontWeight: 650, letterSpacing: "-.02em", color: T.text }}>{greeting()}{userName ? ", " + userName.split(" ")[0] : ""}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {streak !== null && (
          <span onClick={onProgressOpen} title="Progress" style={{ ...mono(11, 0), color: T.chip, background: T.chipBg, border: "1px solid " + T.chipBorder, padding: "6px 8px", borderRadius: 9, cursor: "pointer" }}>{streak}d</span>
        )}
        {!T.locked && (
          <div onClick={toggleTheme} style={iconBtn} title="Toggle light / dark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {isDark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></> : <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />}
            </svg>
          </div>
        )}
        <div onClick={onCoachOpen} style={iconBtn} title="AI Coach">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="1.7" strokeLinejoin="round"><path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6 10.1 12.8 4.3 10.9 10.1 9 12 3.2Z" /><path d="M18.6 16.4l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" /></svg>
        </div>
        <div onClick={onCalendarOpen} style={iconBtn} title="Calendar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="1.7" strokeLinejoin="round"><rect x="3.6" y="5.4" width="16.8" height="15" rx="3.2" /><path d="M8 3.4v3.4M16 3.4v3.4M3.6 10.4h16.8" /></svg>
        </div>
        <div onClick={onProfileOpen} title="Profile" style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", flexShrink: 0, background: "linear-gradient(150deg," + T.avatarFrom + "," + T.avatarTo + ")", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 650, color: T.onAccent }}>{initial}</div>
      </div>
    </div>
  );
}

/* ── week rail ──────────────────────────────────────────────────────────── */
function WeekRail({ T, summary, calGoal, onOpen, failed, onRetry }) {
  const { days, onTarget, eligible } = summary;
  const range = days.length ? days[0].label.toUpperCase() + " " + days[0].num + " — " + days[6].label.toUpperCase() + " " + days[6].num : "";
  return (
    <div style={{ margin: "10px 14px 0", padding: "7px 10px 6px", borderRadius: 18, background: T.homeSurface, border: "1px solid " + T.border, boxShadow: T.lift }}>
      <div onClick={onOpen} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 6px 6px", cursor: "pointer" }}>
        <span style={{ ...mono(8.5, 0.2), color: T.muted }}>{range}</span>
        <span style={{ ...mono(9.5, 0.1), color: T.accentText }}>{onTarget} / {eligible} ON TARGET</span>
      </div>
      <div onClick={onOpen} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, cursor: "pointer" }}>
        {days.map((d) => {
          const live = d.state === "day";
          const pct = live && calGoal > 0 ? Math.min(1, d.cal / calGoal) : 0;
          const ring = !live ? T.track : d.isToday ? T.arc[2] : d.onTarget ? T.accent : d.cal > calGoal * (1 + 0.1) ? T.macroPair[2][1] : T.border;
          const dots = live ? [d.foodLogged && T.macroPair[1][1], d.workout && T.accent, d.supps && T.supp].filter(Boolean) : [];
          const dim = d.state === "pre" || d.state === "future" || d.state === "unknown";
          return (
            <div key={d.ds} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0 3px", borderRadius: 11, background: d.isToday ? T.accentPill : "transparent", border: "1px solid " + (d.isToday ? T.borderStrong : "transparent"), opacity: dim ? 0.45 : 1 }}>
              <span style={{ ...mono(7.5, 0.08), color: d.isToday ? T.accentText : T.muted }}>{d.label.charAt(0)}</span>
              <div style={{ position: "relative", width: 26, height: 26 }}>
                <svg width="26" height="26" viewBox="0 0 34 34" style={{ position: "absolute", inset: 0 }}>
                  <circle cx="17" cy="17" r="14" stroke={T.track} strokeWidth="3.4" fill="none" />
                  {live && <circle cx="17" cy="17" r="14" stroke={ring} strokeWidth="3.4" fill="none" strokeLinecap="round" strokeDasharray="88" strokeDashoffset={(88 * (1 - pct)).toFixed(1)} transform="rotate(-90 17 17)" />}
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 650, color: d.isToday ? T.text : T.subtext }}>{d.num}</div>
              </div>
              <div style={{ display: "flex", gap: 2, height: 4, alignItems: "center" }}>{dots.map((c, i) => <div key={i} style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: c }} />)}</div>
            </div>
          );
        })}
      </div>
      {failed && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "7px 0 2px", ...mono(9, 0.1), color: T.muted }}>
          <span>Couldn't load this week</span><span>·</span>
          <span onClick={onRetry} style={{ color: T.accentText, cursor: "pointer" }}>Retry</span>
        </div>
      )}
    </div>
  );
}

/* ── calorie hero (no burned slot: the app has no source until HealthKit) ── */
function CalorieHero({ T, consumed, goal }) {
  const uid = useId().replace(/[:]/g, "");
  const left = Math.max(0, goal - consumed);
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const DASH = 455.5;
  return (
    <div style={{ position: "relative", margin: "10px 14px 0", borderRadius: 28, padding: 2.5, overflow: "hidden", boxShadow: "0 0 46px " + T.glowSoft }}>
      <div style={{ position: "absolute", top: "-120%", left: "-30%", width: "160%", height: "340%", background: "conic-gradient(from 0deg,transparent 0deg,transparent 232deg," + T.tracer[0] + " 268deg," + T.tracer[0] + " 296deg," + T.tracer[1] + " 314deg," + T.tracer[0] + " 332deg,transparent 350deg,transparent 360deg)", filter: "blur(.4px)", animation: "wfTrace 3.4s linear infinite" }} />
      <div style={{ position: "relative", borderRadius: 27, background: T.heroBg, border: "1px solid " + T.border }}>
        <div style={{ position: "relative", height: 248 }}>
          <svg width="356" height="196" viewBox="0 0 330 182" fill="none" style={{ position: "absolute", top: 10, left: 1 }}>
            <defs><linearGradient id={"arc" + uid} x1="0" y1="1" x2="1" y2="0"><stop stopColor={T.arc[0]} /><stop offset="0.55" stopColor={T.arc[1]} /><stop offset="1" stopColor={T.arc[2]} /></linearGradient></defs>
            <path d="M20 162 A 145 145 0 0 1 310 162" stroke={T.track} strokeWidth="17" strokeLinecap="round" />
            <path d="M20 162 A 145 145 0 0 1 310 162" stroke={"url(#arc" + uid + ")"} strokeWidth="17" strokeLinecap="round" strokeDasharray={DASH} strokeDashoffset={DASH * (1 - pct)} style={{ filter: "drop-shadow(0 0 14px " + T.glow + ")", transition: "stroke-dashoffset .6s ease" }} />
          </svg>
          <div style={{ position: "absolute", top: 74, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 86, fontWeight: 700, letterSpacing: "-.05em", lineHeight: 0.86, color: T.text }}>{left.toLocaleString()}</span>
            <span style={{ ...mono(10, 0.24), color: T.muted }}>KCAL LEFT</span>
            <span style={{ ...mono(11.5, 0.1), color: T.accentText }}>{Math.round(pct * 100)}% OF {goal.toLocaleString()}</span>
          </div>
          <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", ...mono(9.5, 0.16), color: T.muted }}><span data-testid="hero-eaten">{consumed} EATEN</span></div>
        </div>
      </div>
    </div>
  );
}

/* ── macros ─────────────────────────────────────────────────────────────── */
function MacroRow({ T, macros }) {
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

/* ── today's session ────────────────────────────────────────────────────── */
function SessionCard({ T, plan, onStart, onBrowse }) {
  const card = { margin: "10px 18px 0", padding: "14px 18px", borderRadius: 22, background: T.sessionBg, border: "1px solid " + T.border, position: "relative", overflow: "hidden" };
  if (!plan) return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...mono(8.5, 0.2), color: T.accentText }}>TODAY</span>
          <span style={{ fontSize: 16, fontWeight: 650, color: T.text }}>No plan scheduled</span>
        </div>
        <div onClick={onBrowse} style={{ padding: "10px 16px", borderRadius: 14, cursor: "pointer", background: T.pillBg, color: T.accentText, fontSize: 13, fontWeight: 650 }}>Browse plans</div>
      </div>
    </div>
  );
  const sets = (plan.exercises || []).reduce((a, e) => a + (e.sets || []).length, 0);
  const moves = (plan.exercises || []).slice(0, 2).map((e) => e.name.toUpperCase() + " " + (e.sets || []).length + "×" + ((e.sets || [])[0]?.reps ?? ""));
  const more = Math.max(0, (plan.exercises || []).length - 2);
  return (
    <div style={card}>
      <div style={{ position: "absolute", right: -46, top: -56, width: 170, height: 170, borderRadius: "50%", background: "radial-gradient(circle," + T.glow + ",transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ ...mono(8.5, 0.2), color: T.accentText }}>TODAY{plan.tag ? " · " + plan.tag.toUpperCase() : ""}</span>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", color: T.text }}>{plan.name}</span>
          <span style={{ fontSize: 11.5, color: T.subtext }}>{(plan.exercises || []).length} exercises · {sets} sets{plan.estMin ? " · ~" + plan.estMin + " min" : ""}</span>
        </div>
        <div onClick={() => onStart(plan.id)} style={{ padding: "10px 18px", borderRadius: 14, cursor: "pointer", background: T.startBg, color: T.startText, fontSize: 13, fontWeight: 650, boxShadow: "0 8px 22px " + T.glowSoft }}>Start</div>
      </div>
      <div style={{ position: "relative", display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
        {[...moves, ...(more ? ["+" + more + " MORE"] : [])].map((m) => <span key={m} style={{ ...mono(9.5, 0.06), color: T.subtext, background: T.pillBg, padding: "6px 9px", borderRadius: 9 }}>{m}</span>)}
      </div>
    </div>
  );
}

/* ── water ──────────────────────────────────────────────────────────────── */
function WaterCard({ T, oz, onAdd }) {
  const uid = useId().replace(/[:]/g, "");
  const pct = Math.min(100, Math.round((oz / GOAL_OZ) * 100));
  return (
    <div style={{ margin: "12px 18px 0", padding: "13px 16px", borderRadius: 22, background: T.homeSurface, border: "1px solid " + T.waterBorder, boxShadow: "0 0 22px " + T.waterGlow + "," + T.lift, display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="19" height="24" viewBox="0 0 24 30" fill="none" style={{ flex: "none" }}>
        <defs><clipPath id={"drop" + uid}><path d="M12 1C12 1 3 12 3 19a9 9 0 0 0 18 0C21 12 12 1 12 1Z" /></clipPath></defs>
        <g clipPath={"url(#drop" + uid + ")"}><rect x="0" y={(30 - 30 * (pct / 100)).toFixed(1)} width="24" height="30" fill={T.water} style={{ transition: "y .45s ease" }} /></g>
        <path d="M12 1C12 1 3 12 3 19a9 9 0 0 0 18 0C21 12 12 1 12 1Z" stroke={T.waterBorder} strokeWidth="1.4" />
      </svg>
      <span style={{ fontSize: 14.5, color: T.text }}>Water</span>
      <div style={{ flex: 1, position: "relative", height: 12, borderRadius: 7, background: T.track, border: "1px solid " + T.waterBorder, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", borderRadius: 7, background: "linear-gradient(90deg," + T.waterDeep + "," + T.water + ")", boxShadow: "0 0 14px " + T.waterGlow, transition: "width .45s ease" }} />
      </div>
      <span style={{ ...mono(11, 0.06), color: T.waterText, flex: "none" }}>{oz}/{GOAL_OZ}</span>
      <span data-testid="water-add" onClick={() => onAdd(8)} style={{ fontSize: 13, fontWeight: 600, color: T.waterText, cursor: "pointer", flex: "none" }}>+8</span>
    </div>
  );
}

/* ── supplement stack ───────────────────────────────────────────────────── */
function SuppStack({ T, supps, taken, onToggle, onLog, onEmpty }) {
  const card = { margin: "12px 18px 0", padding: "14px 16px 13px", borderRadius: 22, background: T.homeSurface, border: "1px solid " + T.suppBorder, boxShadow: T.lift };
  if (!supps.length) return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 650, color: T.text }}>Supplement stack</span>
        <span onClick={onEmpty} style={{ ...mono(10.5, 0.12), color: T.suppText, cursor: "pointer" }}>ADD YOUR FIRST SUPPLEMENT</span>
      </div>
    </div>
  );
  const total = supps.length;
  const done = supps.filter((s) => taken[s.k]).length;
  const pct = Math.round((done / total) * 100);
  const nextDue = supps.filter((s) => !taken[s.k] && s.reminderEnabled && s.reminderTime).sort((a, b) => a.reminderTime.localeCompare(b.reminderTime))[0];
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-.01em", color: T.text }}>Supplement stack</span>
        <span style={{ ...mono(10.5, 0.1), color: T.suppText }}>{done} of {total} · {pct}%</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(5, total) + ",1fr)", gap: 9 }}>
        {supps.slice(0, 5).map((s) => {
          const on = !!taken[s.k];
          return (
            <div key={s.k} data-testid={"capsule-" + s.k} onClick={() => onToggle(s.k, !on)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer" }}>
              <div style={{ position: "relative", width: "100%", height: 38, borderRadius: 13, overflow: "hidden", background: on ? T.accentPill : T.pillBg, border: "1px solid " + (on ? T.suppBorder : T.border) }}>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: on ? "100%" : "0%", background: "linear-gradient(180deg," + T.supp + "," + T.suppDeep + ")", transition: "height .32s cubic-bezier(.4,0,.2,1)" }} />
                <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: T.pillLine }} />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.15, textAlign: "center", color: on ? T.suppText : T.muted }}>{s.name}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 11, borderTop: "1px solid " + T.border }}>
        <span style={{ ...mono(9, 0.14), color: T.muted }}>{total - done} LEFT{nextDue ? " · NEXT " + nextDue.name.toUpperCase() + " AT " + fmtTime(nextDue.reminderTime) : ""}</span>
        <span onClick={onLog} style={{ ...mono(10.5, 0.12), color: T.suppText, cursor: "pointer" }}>LOG</span>
      </div>
    </div>
  );
}

/* ── weight ─────────────────────────────────────────────────────────────── */
// The log form is the existing WeightLogWidget, moved here unchanged in
// behaviour: it calls logWeight(lbs) and lets App own validation and rollback.
function WeightLogWidget({ T, weightLog = [], onLog, onDone }) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const handleLog = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onLog(input);
    setSaving(false);
    if (!ok) return; // logWeight already surfaced the reason and rolled back
    setInput(""); onDone && onDone();
  };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
      <input type="number" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLog()} placeholder="Log today's weight" style={{ flex: 1, background: T.inputBg, color: T.text, border: "1px solid " + T.border, borderRadius: 10, padding: "7px 10px", fontSize: 13, outline: "none" }} />
      <div style={{ fontSize: 11, color: T.muted }}>lbs</div>
      <div onClick={handleLog} style={{ background: T.accent, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: T.onAccent, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "…" : "Log"}</div>
    </div>
  );
}
function WeightStrip({ T, weightLog, onLog }) {
  const [open, setOpen] = useState(false);
  const last = weightLog[weightLog.length - 1];
  const prev = weightLog[weightLog.length - 2];
  const delta = last && prev ? last.lbs - prev.lbs : null;
  return (
    <div style={{ margin: "12px 18px 0", padding: "11px 16px", borderRadius: 18, background: T.homeSurface, border: "1px solid " + T.border, boxShadow: T.lift }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ ...mono(9, 0.16), color: T.muted, flex: 1 }}>WEIGHT</span>
        {last ? <><span style={{ fontSize: 15, fontWeight: 650, color: T.text }}>{last.lbs.toFixed(1)}</span><span style={{ fontSize: 11, color: T.muted }}>lbs</span></> : <span style={{ fontSize: 12, color: T.muted }}>Not logged yet</span>}
        {delta !== null && <span style={{ ...mono(10, 0.06), color: delta <= 0 ? T.green : T.red }}>{delta <= 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)}</span>}
        <span onClick={() => setOpen((o) => !o)} style={{ ...mono(10.5, 0.12), color: T.accentText, cursor: "pointer" }}>{open ? "CLOSE" : "LOG"}</span>
      </div>
      {open && <WeightLogWidget T={T} weightLog={weightLog} onLog={onLog} onDone={() => setOpen(false)} />}
    </div>
  );
}

/* ── meals today ────────────────────────────────────────────────────────── */
function MealsToday({ T, meals, more, totalKcal, onMore, onLog }) {
  return (
    <div style={{ margin: "12px 18px 0", padding: "14px 16px 8px", borderRadius: 22, background: T.homeSurface, border: "1px solid " + T.borderStrong, boxShadow: "0 0 20px " + T.glowInner + "," + T.lift }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-.01em", color: T.text }}>Meals today</span>
        <span data-testid="meals-kcal" style={{ ...mono(10.5, 0.1), color: T.macro[1] }}>{totalKcal} KCAL · {meals.length + more} LOGGED</span>
      </div>
      {meals.length === 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 8px" }}>
          <span style={{ fontSize: 13, color: T.muted }}>Nothing logged yet</span>
          <span onClick={onLog} style={{ ...mono(10.5, 0.12), color: T.accentText, cursor: "pointer" }}>LOG</span>
        </div>
      )}
      {meals.map((m, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid " + T.border }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 13.5, color: T.text }}>{m.name}</span>
            <span style={{ ...mono(8.5, 0.14), color: T.muted }}>{m.slot.toUpperCase()} · P{m.p} C{m.c} F{m.f}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 650, color: T.text }}>{m.cal}</span>
        </div>
      ))}
      {more > 0 && (
        <div onClick={onMore} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0 11px", cursor: "pointer" }}>
          <span style={{ ...mono(10, 0.14), color: T.accentText }}>+ {more} MORE LOGGED</span>
        </div>
      )}
    </div>
  );
}

/* ── the tab ────────────────────────────────────────────────────────────── */
export default function HomeTab({
  setTab, log, suppList = [], suppTaken = {}, workoutHistory = [], isDark, toggleTheme, userName = "",
  goals = { cal: 2200, protein: 140, carbs: 180, fat: 78 }, onProfileOpen, waterOz = 0, setWaterOz, weightLog = [], logWeight,
  // new
  onCoachOpen, onCalendarOpen, onProgressOpen, onAddOpen, todayPlan = null, onStartPlan,
  toggleSuppTaken, weekHistory = null, onRetryWeek, profileCreatedAt = null,
}) {
  const T = useTheme();
  useHomeKeyframes();
  const todayStr = localDate();
  const eaten = useMemo(() => totals(log || SEED), [log]);

  const week = useMemo(() => {
    const days = weekDays(new Date());
    return summarizeWeek({
      days, history: weekHistory, todayStr, goalCal: goals.cal, createdAt: profileCreatedAt, suppsTotal: suppList.length,
      workoutDates: new Set((workoutHistory || []).map((w) => w.date)),
      today: { cal: eaten.cal, waterOz, suppsTaken: suppList.filter((s) => suppTaken[s.k]).length },
    });
  }, [weekHistory, todayStr, goals.cal, profileCreatedAt, suppList, suppTaken, workoutHistory, eaten.cal, waterOz]);
  const streak = streakFrom(week.days, todayStr);

  const meals = useMemo(() => Object.keys(SEED).flatMap((slot) => (log?.[slot] || []).map((it) => { const m = calc(it); return { name: it.name, slot, cal: m.cal, p: Math.round(m.protein), c: Math.round(m.carbs), f: Math.round(m.fat) }; })), [log]);

  return (
    <div style={{ position: "relative", minHeight: "100vh", paddingBottom: 132, color: T.text, fontFamily: "-apple-system,'SF Pro Text',system-ui,sans-serif" }}>
      <Header T={T} userName={userName} streak={streak} isDark={isDark} toggleTheme={toggleTheme} onProfileOpen={onProfileOpen} onCoachOpen={onCoachOpen} onCalendarOpen={onCalendarOpen} onProgressOpen={onProgressOpen} />
      <WeekRail T={T} summary={week} calGoal={goals.cal} onOpen={onCalendarOpen} failed={weekHistory === null} onRetry={onRetryWeek} />
      <CalorieHero T={T} consumed={eaten.cal} goal={goals.cal} />
      <MacroRow T={T} macros={[{ label: "PROTEIN", value: eaten.protein, goal: goals.protein }, { label: "CARBS", value: eaten.carbs, goal: goals.carbs }, { label: "FAT", value: eaten.fat, goal: goals.fat }]} />
      <SessionCard T={T} plan={todayPlan} onStart={(id) => onStartPlan && onStartPlan(id)} onBrowse={() => setTab("workout")} />
      <WaterCard T={T} oz={waterOz} onAdd={(n) => setWaterOz && setWaterOz(Math.min(GOAL_OZ, waterOz + n))} />
      <SuppStack T={T} supps={suppList} taken={suppTaken} onToggle={(k, val) => toggleSuppTaken && toggleSuppTaken(k, val)} onLog={() => setTab("supps")} onEmpty={() => setTab("supps")} />
      <WeightStrip T={T} weightLog={weightLog} onLog={(lbs) => (logWeight ? logWeight(lbs) : Promise.resolve(false))} />
      <MealsToday T={T} meals={meals.slice(0, 2)} more={Math.max(0, meals.length - 2)} totalKcal={eaten.cal} onMore={() => setTab("food")} onLog={() => onAddOpen && onAddOpen("meal")} />
    </div>
  );
}
