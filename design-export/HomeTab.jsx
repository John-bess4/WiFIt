/* ============================================================================
 * WiFIt — HomeTab (redesign)
 * ----------------------------------------------------------------------------
 * Drop-in replacement for the existing HomeTab in App.jsx.
 *
 * • Same prop signature as before, plus four optional additions:
 *     theme          the resolved theme object (pass the App's `T`)
 *     onCoachOpen    opens the AI coach side panel
 *     onAddOpen      called with a quick-add key: "meal" | "water" | "supp" | "workout"
 *     onCalendarOpen opens the full calendar view
 *
 * • Inline styles only, matching App.jsx house style. No CSS files, no deps.
 * • Keyframes are injected once, on mount.
 *
 * Themes come from ./themes.js — see MIGRATION.md.
 * ========================================================================== */

import React, { useEffect, useId, useMemo, useState } from "react";

/* ── one-time keyframe injection ──────────────────────────────────────────── */

const HOME_CSS = `
@keyframes wifitTrace { to { transform: rotate(360deg); } }
@keyframes wifitHalo  { 0%,100% { opacity:.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.06); } }
@keyframes wifitEdge  { 0%,100% { opacity:.5; } 50% { opacity:1; } }
`;

function useHomeKeyframes() {
  useEffect(() => {
    if (document.getElementById("wifit-home-css")) return;
    const el = document.createElement("style");
    el.id = "wifit-home-css";
    el.textContent = HOME_CSS;
    document.head.appendChild(el);
  }, []);
}

/* ── demo data (used only when the matching prop is empty) ────────────────── */

const DEMO = {
  week: [
    { day: 20, dow: "M", cal: 2040, food: 1, workout: 1, supp: 1 },
    { day: 21, dow: "T", cal: 1880, food: 1, workout: 0, supp: 1 },
    { day: 22, dow: "W", cal: 2210, food: 1, workout: 1, supp: 1 },
    { day: 23, dow: "T", cal: 1640, food: 1, workout: 0, supp: 0 },
    { day: 24, dow: "F", cal: 2150, food: 1, workout: 1, supp: 1 },
    { day: 25, dow: "S", cal: 1960, food: 1, workout: 1, supp: 0 },
    { day: 26, dow: "S", cal: 790, food: 1, workout: 0, supp: 1, today: true },
  ],
  supps: [
    { k: "d3", name: "Vitamin D3" },
    { k: "omega", name: "Omega-3" },
    { k: "creat", name: "Creatine" },
    { k: "mag", name: "Magnesium" },
    { k: "zinc", name: "Zinc" },
  ],
  meals: [
    { time: "8:20 AM", name: "Oats, whey & blueberries", slot: "Breakfast", cal: 340, p: 32, c: 48, f: 9 },
    { time: "12:05 PM", name: "Chicken rice bowl", slot: "Lunch", cal: 450, p: 64, c: 70, f: 32 },
  ],
  session: { title: "Push day", at: "6:00 PM", meta: "6 exercises · 20 sets · ~58 min", moves: ["BENCH 4×8", "OHP 4×6", "+4 MORE"] },
  weight: 182.4,
  weightDelta: -1.2,
};

const WATER_GOAL = 80;

/* ── tiny helpers ─────────────────────────────────────────────────────────── */

const mono = (size, spacing, weight = 600) => ({
  font: weight + " " + size + "px/1 ui-monospace,Menlo,monospace",
  letterSpacing: spacing + "em",
});

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
};

/* ── section: header ──────────────────────────────────────────────────────── */

function Header({ T, userName, streak, isDark, toggleTheme, onProfileOpen, onCoachOpen, onCalendarOpen }) {
  const initial = (userName || "You").trim().charAt(0).toUpperCase();
  const today = new Date();
  const stamp = today
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .replace(",", " ·")
    .toUpperCase();

  const iconBtn = {
    width: 32, height: 32, borderRadius: 11,
    background: T.homeSurface, border: "1px solid " + T.border,
    display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
  };

  return (
    <div style={{ padding: "12px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ ...mono(9, 0.22), color: T.muted }}>{stamp}</span>
        <span style={{ fontSize: 21, fontWeight: 650, letterSpacing: "-.02em", color: T.text }}>
          {greeting()}{userName ? ", " + userName.split(" ")[0] : ""}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...mono(11, 0), color: T.chip, background: T.chipBg, border: "1px solid " + T.chipBorder, padding: "6px 8px", borderRadius: 9 }}>
          {streak}d
        </span>

        <div onClick={toggleTheme} style={iconBtn} title="Toggle light / dark">
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="1.8" strokeLinejoin="round">
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
            </svg>
          )}
        </div>

        <div onClick={onCoachOpen} style={iconBtn} title="AI Coach">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="1.7" strokeLinejoin="round">
            <path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6 10.1 12.8 4.3 10.9 10.1 9 12 3.2Z" />
            <path d="M18.6 16.4l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
          </svg>
        </div>

        <div onClick={onCalendarOpen} style={iconBtn} title="Calendar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="1.7" strokeLinejoin="round">
            <rect x="3.6" y="5.4" width="16.8" height="15" rx="3.2" />
            <path d="M8 3.4v3.4M16 3.4v3.4M3.6 10.4h16.8" />
          </svg>
        </div>

        <div
          onClick={onProfileOpen}
          style={{
            width: 34, height: 34, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
            background: "linear-gradient(150deg," + T.avatarFrom + "," + T.avatarTo + ")",
            display: "grid", placeItems: "center",
            fontSize: 13, fontWeight: 650, color: T.onAccent,
          }}
        >
          {initial}
        </div>
      </div>
    </div>
  );
}

/* ── section: week rail (condensed calendar + streak dots) ────────────────── */

function WeekRail({ T, days, calGoal, onOpen }) {
  const closed = days.filter((d) => !d.today);
  const onTarget = closed.filter((d) => d.cal >= calGoal * 0.9 && d.cal <= calGoal * 1.06).length;
  const range = days.length
    ? "JUL " + days[0].day + " — " + days[days.length - 1].day
    : "";

  return (
    <div
      onClick={onOpen}
      style={{
        margin: "10px 14px 0", padding: "7px 10px 6px", borderRadius: 18,
        background: T.homeSurface, border: "1px solid " + T.border,
        boxShadow: T.lift, cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 6px 6px" }}>
        <span style={{ ...mono(8.5, 0.2), color: T.muted }}>{range}</span>
        <span style={{ ...mono(9.5, 0.1), color: T.accentText }}>
          {onTarget} / {closed.length} ON TARGET
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {days.map((d) => {
          const pct = Math.min(1, d.cal / calGoal);
          const ring = d.today ? T.arc[2] : d.cal > calGoal * 1.06 ? T.macroPair[2][1] : d.cal >= calGoal * 0.9 ? T.accent : T.border;
          const dots = [d.food && T.macroPair[1][1], d.workout && T.accent, d.supp && T.supp[1]].filter(Boolean);

          return (
            <div
              key={d.day}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "4px 0 3px", borderRadius: 11,
                background: d.today ? T.accentPill : "transparent",
                border: "1px solid " + (d.today ? T.borderStrong : "transparent"),
              }}
            >
              <span style={{ ...mono(7.5, 0.08), color: d.today ? T.accentText : T.muted }}>{d.dow}</span>

              <div style={{ position: "relative", width: 26, height: 26 }}>
                <svg width="26" height="26" viewBox="0 0 34 34" style={{ position: "absolute", inset: 0 }}>
                  <circle cx="17" cy="17" r="14" stroke={T.track} strokeWidth="3.4" fill="none" />
                  <circle
                    cx="17" cy="17" r="14" stroke={ring} strokeWidth="3.4" fill="none" strokeLinecap="round"
                    strokeDasharray="88" strokeDashoffset={(88 * (1 - pct)).toFixed(1)}
                    transform="rotate(-90 17 17)"
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 650, color: d.today ? T.text : T.subtext }}>
                  {d.day}
                </div>
              </div>

              <div style={{ display: "flex", gap: 2, height: 4, alignItems: "center" }}>
                {dots.map((c, i) => (
                  <div key={i} style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: c }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── section: calories left (hero) ────────────────────────────────────────── */

function CalorieHero({ T, consumed, burned, goal }) {
  const uid = useId().replace(/[:]/g, "");
  const left = Math.max(0, goal - consumed + burned);
  const pct = goal > 0 ? Math.min(1, (goal - left) / goal) : 0;
  const DASH = 455.5;

  return (
    <div
      style={{
        position: "relative", margin: "10px 14px 0", borderRadius: 28,
        padding: 2.5, overflow: "hidden", boxShadow: "0 0 46px " + T.glowSoft,
      }}
    >
      {/* rotating comet tracer */}
      <div
        style={{
          position: "absolute", top: "-120%", left: "-30%", width: "160%", height: "340%",
          background:
            "conic-gradient(from 0deg,transparent 0deg,transparent 232deg," +
            T.tracer[0] + " 268deg," + T.tracer[0] + " 296deg," + T.tracer[1] + " 314deg," +
            T.tracer[0] + " 332deg,transparent 350deg,transparent 360deg)",
          filter: "blur(.4px)", animation: "wifitTrace 3.4s linear infinite",
        }}
      />

      <div style={{ position: "relative", borderRadius: 27, background: T.heroBg, border: "1px solid " + T.border }}>
        <div style={{ position: "relative", height: 248 }}>
          <svg width="356" height="196" viewBox="0 0 330 182" fill="none" style={{ position: "absolute", top: 10, left: 1 }}>
            <defs>
              <linearGradient id={"arc" + uid} x1="0" y1="1" x2="1" y2="0">
                <stop stopColor={T.arc[0]} />
                <stop offset="0.55" stopColor={T.arc[1]} />
                <stop offset="1" stopColor={T.arc[2]} />
              </linearGradient>
            </defs>
            <path d="M20 162 A 145 145 0 0 1 310 162" stroke={T.track} strokeWidth="17" strokeLinecap="round" />
            <path
              d="M20 162 A 145 145 0 0 1 310 162"
              stroke={"url(#arc" + uid + ")"} strokeWidth="17" strokeLinecap="round"
              strokeDasharray={DASH} strokeDashoffset={DASH * (1 - pct)}
              style={{ filter: "drop-shadow(0 0 14px " + T.glow + ")", transition: "stroke-dashoffset .6s ease" }}
            />
          </svg>

          <div style={{ position: "absolute", top: 74, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 86, fontWeight: 700, letterSpacing: "-.05em", lineHeight: 0.86, color: T.text }}>
              {left.toLocaleString()}
            </span>
            <span style={{ ...mono(10, 0.24), color: T.muted }}>KCAL LEFT</span>
            <span style={{ ...mono(11.5, 0.1), color: T.accentText }}>
              {Math.round(pct * 100)}% OF {goal.toLocaleString()}
            </span>
          </div>

          <div style={{ position: "absolute", bottom: 10, left: 56, right: 56, display: "flex", justifyContent: "space-between", ...mono(9.5, 0.16), color: T.muted }}>
            <span>{consumed} EATEN</span>
            <span>{burned} BURNED</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── section: macros ──────────────────────────────────────────────────────── */

function MacroRow({ T, macros }) {
  return (
    <div
      style={{
        margin: "2px 18px 0", padding: "16px 18px 14px", borderRadius: 22,
        background: T.accentSurface, border: "1px solid " + T.borderStrong,
        boxShadow: "0 0 26px " + T.glowSoft + ",inset 0 0 26px " + T.glowInner,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {macros.map((m, i) => (
          <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 650, color: T.text }}>{Math.round(m.value)}</span>
              <span style={{ fontSize: 11, color: T.muted }}>/{m.goal}g</span>
            </div>
            <div style={{ height: 4, borderRadius: 3, background: T.track }}>
              <div
                style={{
                  width: Math.min(100, (m.value / m.goal) * 100) + "%", height: "100%", borderRadius: 3,
                  background: "linear-gradient(90deg," + T.macroPair[i][0] + "," + T.macroPair[i][1] + ")",
                  boxShadow: i === 0 ? "0 0 10px " + T.glow : "none",
                  transition: "width .5s ease",
                }}
              />
            </div>
            <span style={{ ...mono(8.5, 0.2), color: T.muted }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── section: next session ────────────────────────────────────────────────── */

function SessionCard({ T, session, onStart }) {
  return (
    <div
      style={{
        margin: "10px 18px 0", padding: "14px 18px", borderRadius: 22,
        background: T.sessionBg, border: "1px solid " + T.border,
        position: "relative", overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute", right: -46, top: -56, width: 170, height: 170, borderRadius: "50%",
          background: "radial-gradient(circle," + T.glow + ",transparent 65%)",
          pointerEvents: "none", zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ ...mono(8.5, 0.2), color: T.accentText }}>UP NEXT · {session.at}</span>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", color: T.text }}>{session.title}</span>
          <span style={{ fontSize: 11.5, color: T.subtext }}>{session.meta}</span>
        </div>
        <div
          onClick={onStart}
          style={{
            padding: "10px 18px", borderRadius: 14, cursor: "pointer",
            background: T.startBg, color: T.startText, fontSize: 13, fontWeight: 650,
            boxShadow: "0 8px 22px " + T.glowSoft,
          }}
        >
          Start
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 6, marginTop: 14 }}>
        {session.moves.map((m) => (
          <span key={m} style={{ ...mono(9.5, 0.06), color: T.subtext, background: T.pillBg, padding: "6px 9px", borderRadius: 9 }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── section: water ───────────────────────────────────────────────────────── */

function WaterCard({ T, oz, onAdd }) {
  const uid = useId().replace(/[:]/g, "");
  const pct = Math.min(100, Math.round((oz / WATER_GOAL) * 100));

  return (
    <div
      style={{
        margin: "12px 18px 0", padding: "13px 16px", borderRadius: 22,
        background: T.homeSurface, border: "1px solid " + T.waterBorder,
        boxShadow: "0 0 22px " + T.waterGlow + "," + T.lift,
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <svg width="19" height="24" viewBox="0 0 24 30" fill="none" style={{ flex: "none" }}>
        <defs>
          <clipPath id={"drop" + uid}>
            <path d="M12 1C12 1 3 12 3 19a9 9 0 0 0 18 0C21 12 12 1 12 1Z" />
          </clipPath>
        </defs>
        <g clipPath={"url(#drop" + uid + ")"}>
          <rect x="0" y={(30 - 30 * (pct / 100)).toFixed(1)} width="24" height="30" fill={T.water[1]} style={{ transition: "y .45s ease" }} />
        </g>
        <path d="M12 1C12 1 3 12 3 19a9 9 0 0 0 18 0C21 12 12 1 12 1Z" stroke={T.waterBorder} strokeWidth="1.4" />
      </svg>

      <span style={{ fontSize: 14.5, color: T.text }}>Water</span>

      <div style={{ flex: 1, position: "relative", height: 12, borderRadius: 7, background: T.track, border: "1px solid " + T.waterBorder, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", borderRadius: 7,
            background: "linear-gradient(90deg," + T.water[0] + "," + T.water[1] + ")",
            boxShadow: "0 0 14px " + T.waterGlow, transition: "width .45s ease",
          }}
        />
      </div>

      <span style={{ ...mono(11, 0.06), color: T.waterText, flex: "none" }}>{oz}/{WATER_GOAL}</span>
      <span onClick={() => onAdd(8)} style={{ fontSize: 13, fontWeight: 600, color: T.waterText, cursor: "pointer", flex: "none" }}>+8</span>
    </div>
  );
}

/* ── section: supplement stack ────────────────────────────────────────────── */

function SuppStack({ T, supps, taken, onToggle, onLog }) {
  const total = supps.length;
  const done = supps.filter((s) => taken[s.k]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const next = supps.find((s) => !taken[s.k]);

  return (
    <div
      style={{
        margin: "12px 18px 0", padding: "14px 16px 13px", borderRadius: 22,
        background: T.homeSurface, border: "1px solid " + T.suppBorder, boxShadow: T.lift,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-.01em", color: T.text }}>Supplement stack</span>
        <span style={{ ...mono(10.5, 0.1), color: T.suppText }}>{done} of {total} · {pct}%</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(5, Math.max(1, total)) + ",1fr)", gap: 9 }}>
        {supps.slice(0, 5).map((s) => {
          const on = !!taken[s.k];
          return (
            <div key={s.k} onClick={() => onToggle(s.k)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer" }}>
              <div
                style={{
                  position: "relative", width: "100%", height: 38, borderRadius: 13, overflow: "hidden",
                  background: on ? T.accentPill : T.pillBg,
                  border: "1px solid " + (on ? T.suppBorder : T.border),
                }}
              >
                <div
                  style={{
                    position: "absolute", left: 0, right: 0, bottom: 0, height: on ? "100%" : "0%",
                    background: "linear-gradient(180deg," + T.supp[1] + "," + T.supp[0] + ")",
                    transition: "height .32s cubic-bezier(.4,0,.2,1)",
                  }}
                />
                <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(8,6,12,.35)" }} />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.15, textAlign: "center", color: on ? T.suppText : T.muted }}>
                {s.name}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 11, borderTop: "1px solid " + T.border }}>
        <span style={{ ...mono(9, 0.14), color: T.muted }}>
          {total - done} LEFT TODAY{next ? " · NEXT " + next.name.toUpperCase() : ""}
        </span>
        <span onClick={onLog} style={{ ...mono(10.5, 0.12), color: T.suppText, cursor: "pointer" }}>LOG</span>
      </div>
    </div>
  );
}

/* ── section: weight ──────────────────────────────────────────────────────── */

function WeightStrip({ T, lbs, delta, onLog }) {
  const down = delta <= 0;
  return (
    <div
      style={{
        margin: "12px 18px 0", padding: "11px 16px", borderRadius: 18,
        background: T.homeSurface, border: "1px solid " + T.border, boxShadow: T.lift,
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <span style={{ ...mono(9, 0.16), color: T.muted, flex: 1 }}>WEIGHT</span>
      <span style={{ fontSize: 15, fontWeight: 650, color: T.text }}>{lbs.toFixed(1)}</span>
      <span style={{ fontSize: 11, color: T.muted }}>lbs</span>
      <span style={{ ...mono(10, 0.06), color: down ? T.green : T.red }}>
        {down ? "▼" : "▲"} {Math.abs(delta).toFixed(1)}
      </span>
      <span onClick={onLog} style={{ ...mono(10.5, 0.12), color: T.accentText, cursor: "pointer" }}>LOG</span>
    </div>
  );
}

/* ── section: meals today ─────────────────────────────────────────────────── */

function MealsToday({ T, meals, planned, onMore }) {
  const kcal = meals.reduce((a, m) => a + m.cal, 0);

  return (
    <div
      style={{
        margin: "12px 18px 0", padding: "14px 16px 8px", borderRadius: 22,
        background: T.homeSurface, border: "1px solid " + T.borderStrong,
        boxShadow: "0 0 20px " + T.glowInner + "," + T.lift,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-.01em", color: T.text }}>Meals today</span>
        <span style={{ ...mono(10.5, 0.1), color: T.macroPair[1][1] }}>{kcal} KCAL · {meals.length} LOGGED</span>
      </div>

      {meals.map((m, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid " + T.border }}>
          <span style={{ ...mono(9, 0), color: T.muted, width: 52 }}>{m.time}</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 13.5, color: T.text }}>{m.name}</span>
            <span style={{ ...mono(8.5, 0.14), color: T.muted }}>
              {m.slot.toUpperCase()} · P{m.p} C{m.c} F{m.f}
            </span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 650, color: T.text }}>{m.cal}</span>
        </div>
      ))}

      {planned > 0 && (
        <div onClick={onMore} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0 11px", cursor: "pointer" }}>
          <span style={{ ...mono(10, 0.14), color: T.accentText }}>+ {planned} MORE PLANNED</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 9.5 12 15.5l6-6" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ── section: bottom nav with raised quick-add ────────────────────────────── */

const NAV_ITEMS = [
  { key: "home", label: "Home", path: "M4 10.4 12 4l8 6.4V20h-5.4v-5.2H9.4V20H4z", join: true },
  { key: "food", label: "Food", path: "M12 8v4.2l3 1.8", circle: true },
  { key: "train", label: "Train", path: "M5 9v6M8 7v10M16 7v10M19 9v6M8 12h8", cap: true },
  { key: "supps", label: "Supps", pill: true },
];

const QUICK_ADD = {
  home: [["Meal", "+", 1], ["Water", "~", 0], ["Dose", "/", 2], ["Workout", "↑", 3]],
  food: [["Meal", "+", 1], ["Scan", "|||", 0], ["Recipe", "≡", 3], ["Water", "~", 0]],
  train: [["Session", "↑", 3], ["Exercise", "+", 1], ["Cardio", "∿", 2], ["New PR", "★", 3]],
  supps: [["Dose", "/", 2], ["New supp", "+", 2], ["Reminder", "◔", 0], ["Refill", "↻", 3]],
};

function HomeNav({ T, active, setTab, onAdd }) {
  const uid = useId().replace(/[:]/g, "");
  const [open, setOpen] = useState(false);

  const idx = Math.max(0, NAV_ITEMS.findIndex((i) => i.key === active));
  const slot = idx < 2 ? idx : idx + 1;
  const accents = [T.water[1], T.macroPair[1][1], T.supp[1], T.accent];

  const actions = (QUICK_ADD[active] || QUICK_ADD.home).map(([label, mark, tone], i) => {
    const deg = ([-54, -18, 18, 54][i] * Math.PI) / 180;
    const dx = Math.round(108 * Math.sin(deg));
    const dy = Math.round(-108 * Math.cos(deg));
    return { label, mark, color: accents[tone], dx, dy, delay: (open ? i * 45 : (3 - i) * 30) + "ms" };
  });

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 12px 16px" }}>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 1400,
          background: "rgba(7,5,12,.74)", backdropFilter: "blur(6px)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .3s ease",
        }}
      />

      <div style={{ position: "relative", height: 104 }}>
        <svg width="366" height="76" viewBox="0 0 366 76" fill="none" style={{ position: "absolute", left: 0, bottom: 0, filter: "drop-shadow(" + T.navShadow + ")" }}>
          <defs>
            <linearGradient id={"navFill" + uid} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor={T.navA} /><stop offset="1" stopColor={T.navB} />
            </linearGradient>
            <linearGradient id={"navEdge" + uid} x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="rgba(0,0,0,0)" />
              <stop offset="0.3" stopColor={T.fab[0]} />
              <stop offset="0.5" stopColor={T.fab[0]} />
              <stop offset="0.7" stopColor={T.fab[2]} />
              <stop offset="1" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          <path
            d="M22 10 H148 A35 35 0 0 0 218 10 H344 A22 22 0 0 1 366 32 V54 A22 22 0 0 1 344 76 H22 A22 22 0 0 1 0 54 V32 A22 22 0 0 1 22 10 Z"
            fill={"url(#navFill" + uid + ")"}
          />
          <path
            d="M22 10 H148 A35 35 0 0 0 218 10 H344"
            stroke={"url(#navEdge" + uid + ")"} strokeWidth="1.5" strokeLinecap="round"
            style={{ animation: "wifitEdge 4.6s ease-in-out infinite" }}
          />
        </svg>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 66, display: "grid", gridTemplateColumns: "repeat(5,1fr)", alignItems: "center" }}>
          <div
            style={{
              position: "absolute", top: 6, left: "calc(" + (slot + 0.5) * 20 + "% - 26px)",
              width: 52, height: 54, borderRadius: 18,
              background: "linear-gradient(180deg," + T.glow + ",transparent)",
              border: "1px solid " + T.borderStrong,
              boxShadow: "0 0 26px " + T.glowSoft + ",inset 0 1px 0 rgba(255,255,255,.14)",
              transition: "left .44s cubic-bezier(.5,1.5,.4,1)",
            }}
          />
          <div
            style={{
              position: "absolute", bottom: -4, left: "calc(" + (slot + 0.5) * 20 + "% - 26px)",
              width: 52, display: "grid", placeItems: "center",
              transition: "left .44s cubic-bezier(.5,1.5,.4,1)",
            }}
          >
            <div style={{ width: 26, height: 3, borderRadius: 3, background: T.fab[0], boxShadow: "0 0 14px " + T.glow }} />
          </div>

          {NAV_ITEMS.map((item, i) => {
            const on = item.key === active;
            const node = (
              <div
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <svg
                  width="21" height="21" viewBox="0 0 24 24" fill="none"
                  stroke={on ? T.navOn : T.navOff} strokeWidth="1.8"
                  strokeLinejoin={item.join ? "round" : undefined} strokeLinecap={item.cap ? "round" : undefined}
                  style={{ transform: on ? "scale(1.12) translateY(-1px)" : "scale(1)", transition: "transform .34s cubic-bezier(.5,1.5,.4,1)" }}
                >
                  {item.circle && <circle cx="12" cy="12" r="8" />}
                  {item.pill && (
                    <>
                      <rect x="3.4" y="8.6" width="17" height="7" rx="3.5" transform="rotate(-38 12 12)" />
                      <path d="M9.4 14.6 14.6 9.4" />
                    </>
                  )}
                  {item.path && <path d={item.path} />}
                </svg>
                <span style={{ fontSize: 9, fontWeight: on ? 650 : 500, color: on ? T.navOn : T.navOff, transition: "color .3s" }}>
                  {item.label}
                </span>
              </div>
            );
            // leave the middle column empty for the raised button
            return i === 2 ? [<div key="gap" />, node] : node;
          })}
        </div>

        {actions.map((a, i) => (
          <div
            key={a.label + i}
            onClick={() => { setOpen(false); onAdd(a.label.toLowerCase()); }}
            style={{
              position: "absolute", left: "calc(50% + " + (a.dx - 27) + "px)", top: -75 + a.dy,
              width: 54, display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
              zIndex: 4, cursor: "pointer",
              opacity: open ? 1 : 0,
              transform: open ? "scale(1) translateY(0)" : "scale(.3) translateY(26px)",
              transition: "transform .34s cubic-bezier(.4,1.5,.4,1) " + a.delay + ",opacity .26s ease " + a.delay,
              pointerEvents: open ? "auto" : "none",
            }}
          >
            <div
              style={{
                width: 54, height: 54, borderRadius: 20,
                background: "linear-gradient(165deg,rgba(28,20,40,.96),rgba(12,8,18,.96))",
                border: "1px solid " + a.color,
                boxShadow: "0 10px 24px rgba(0,0,0,.45),0 0 22px " + a.color + "4d",
                display: "grid", placeItems: "center",
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: a.color }}>{a.mark}</span>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(244,241,248,.82)", whiteSpace: "nowrap" }}>{a.label}</span>
          </div>
        ))}

        <div onClick={() => setOpen((o) => !o)} style={{ position: "absolute", left: "50%", bottom: 37, width: 58, height: 58, marginLeft: -29, zIndex: 5, cursor: "pointer" }}>
          <div
            style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              background: "radial-gradient(circle," + T.glow + " 0%," + T.glowSoft + " 45%,transparent 72%)",
              filter: "blur(7px)", animation: "wifitHalo 3.6s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute", inset: 0, borderRadius: "50%", padding: 2, overflow: "hidden",
              background: "conic-gradient(from 210deg," + T.fab[0] + "," + T.fab[1] + " 45%," + T.fab[2] + " 75%," + T.fab[0] + ")",
              boxShadow: "0 10px 22px " + T.glowSoft + ",0 0 18px " + T.glow,
              transform: open ? "scale(1.06)" : "scale(1)",
              transition: "transform .34s cubic-bezier(.5,1.5,.4,1)",
            }}
          >
            <div
              style={{
                position: "absolute", top: "-50%", left: "-50%", width: "200%", height: "200%",
                background:
                  "conic-gradient(from 0deg,transparent 0deg,transparent 232deg," +
                  T.tracer[0] + " 268deg," + T.tracer[0] + " 296deg," + T.tracer[1] + " 314deg," +
                  T.tracer[0] + " 332deg,transparent 350deg,transparent 360deg)",
                filter: "blur(.4px)", animation: "wifitTrace 3.4s linear infinite",
              }}
            />
            <div
              style={{
                position: "relative", width: "100%", height: "100%", borderRadius: "50%",
                background: "linear-gradient(160deg," + T.fab[1] + "," + T.fabBase + ")",
                display: "grid", placeItems: "center", boxShadow: "inset 0 2px 0 rgba(255,255,255,.3)",
              }}
            >
              <svg
                width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.fabInk} strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: open ? "rotate(135deg)" : "rotate(0deg)", transition: "transform .34s cubic-bezier(.5,1.5,.4,1)" }}
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── the screen ───────────────────────────────────────────────────────────── */

export default function HomeTab({
  // existing HomeTab props — unchanged
  setTab,
  log,
  suppList = [],
  suppTaken = {},
  workoutHistory = [],
  isDark,
  toggleTheme,
  userName = "",
  goals = { cal: 2200, protein: 140, carbs: 180, fat: 78 },
  onProfileOpen,
  waterOz = 0,
  setWaterOz,
  weightLog = [],
  logWeight,
  // new, all optional
  theme,
  onCoachOpen,
  onAddOpen,
  onCalendarOpen,
  totals,
}) {
  useHomeKeyframes();
  const T = theme;
  const [localTaken, setLocalTaken] = useState({});

  /* ── data: real props first, demo data as the fallback ── */

  const eaten = useMemo(() => {
    if (totals) return totals;
    const items = Object.values(log || {}).flat();
    if (!items.length) return { cal: 790, protein: 96, carbs: 118, fat: 41 };
    return items.reduce(
      (a, it) => {
        const g = (it.grams || 0) / 100;
        return {
          cal: a.cal + Math.round((it.per100?.cal || 0) * g),
          protein: a.protein + (it.per100?.protein || 0) * g,
          carbs: a.carbs + (it.per100?.carbs || 0) * g,
          fat: a.fat + (it.per100?.fat || 0) * g,
        };
      },
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [log, totals]);

  const burned = workoutHistory.length ? workoutHistory[workoutHistory.length - 1].burned || 320 : 320;

  const supps = suppList.length ? suppList.map((s) => ({ k: s.k, name: s.name })) : DEMO.supps;
  const taken = suppList.length ? suppTaken : localTaken;
  const toggleSupp = (k) =>
    suppList.length
      ? onAddOpen && onAddOpen("dose:" + k)
      : setLocalTaken((t) => ({ ...t, [k]: !t[k] }));

  const meals = useMemo(() => {
    const items = Object.entries(log || {}).flatMap(([slot, arr]) =>
      (arr || []).map((it) => {
        const g = (it.grams || 0) / 100;
        return {
          time: it.time || "—",
          name: it.name,
          slot,
          cal: Math.round((it.per100?.cal || 0) * g),
          p: Math.round((it.per100?.protein || 0) * g),
          c: Math.round((it.per100?.carbs || 0) * g),
          f: Math.round((it.per100?.fat || 0) * g),
        };
      })
    );
    return items.length ? items : DEMO.meals;
  }, [log]);

  const weight = weightLog.length ? weightLog[weightLog.length - 1].lbs : DEMO.weight;
  const weightDelta = weightLog.length > 1 ? weight - weightLog[weightLog.length - 2].lbs : DEMO.weightDelta;

  const streak = DEMO.week.filter((d) => d.food).length;

  return (
    <div
      style={{
        position: "relative", minHeight: "100vh", paddingBottom: 132,
        background: T.bg, color: T.text,
        fontFamily: "-apple-system,'SF Pro Text',system-ui,sans-serif",
      }}
    >
      <Header
        T={T}
        userName={userName}
        streak={streak}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onProfileOpen={onProfileOpen}
        onCoachOpen={onCoachOpen}
        onCalendarOpen={onCalendarOpen}
      />

      <WeekRail T={T} days={DEMO.week} calGoal={goals.cal} onOpen={onCalendarOpen} />

      <CalorieHero T={T} consumed={Math.round(eaten.cal)} burned={burned} goal={goals.cal} />

      <MacroRow
        T={T}
        macros={[
          { label: "PROTEIN", value: eaten.protein, goal: goals.protein },
          { label: "CARBS", value: eaten.carbs, goal: goals.carbs },
          { label: "FAT", value: eaten.fat, goal: goals.fat },
        ]}
      />

      <SessionCard T={T} session={DEMO.session} onStart={() => setTab("train")} />

      <WaterCard T={T} oz={waterOz} onAdd={(n) => setWaterOz && setWaterOz(waterOz + n)} />

      <SuppStack T={T} supps={supps} taken={taken} onToggle={toggleSupp} onLog={() => setTab("supps")} />

      <WeightStrip T={T} lbs={weight} delta={weightDelta} onLog={() => logWeight && logWeight()} />

      <MealsToday T={T} meals={meals.slice(0, 2)} planned={Math.max(0, meals.length - 2)} onMore={() => setTab("food")} />

      <HomeNav T={T} active="home" setTab={setTab} onAdd={(k) => onAddOpen && onAddOpen(k)} />
    </div>
  );
}
