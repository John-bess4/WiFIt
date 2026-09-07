// Turns one of the 12 home palettes (src/themes.js) into a theme object with
// the SAME keys as the legacy THEMES entries in App.jsx, plus the extended keys
// the redesigned Home reads. Every existing tab keeps reading T.card, T.border,
// T.macro… and gets a sensible value; nothing in App.jsx has to know which
// kind of theme is active.
//
// Pure: no React, no DOM. Tested in src/__tests__/theme.test.js.
import { THEMES as PALETTES, hexA, luminance } from "../themes.js";

// The 32 keys every legacy entry carries. Exported so the test can loop it
// rather than hand-check — and so a key added to a legacy entry without a
// derivation here fails loudly.
export const BASE_THEME_KEYS = [
  "mode","family","bg","surface","card","cardAlt","border","borderStrong",
  "glowShadow","glowShadowStrong","accent","accentSoft","accentGlow","accentPill",
  "text","subtext","muted","bannerFrom","bannerTo","navBg","inputBg","macro",
  "red","green","greenBg","greenText","remaining","remainingText",
  "calCell","calCellSel","calMiss","barEmpty",
];

// bg must stay a solid 6-digit hex: ProgressPage's sticky header appends hex
// alpha to it (T.bg+"e8"), and 15 inputs/chips paint it as their own
// background. The page gradient lives on appBg, read only by full-screen
// shells. The last stop of the gradient is the colour the page settles into.
const lastStop = (gradient) => (String(gradient).match(/#[0-9a-fA-F]{6}/g) || ["#000000"]).pop();

export function paletteToTheme(key) {
  const p = PALETTES[key];
  if (!p) return null;
  const dark = !!p.dark;
  const acc = p.acc;
  const text = dark ? "#F5F3FF" : "#1A1523";
  const red = dark ? "#F87171" : "#DC2626";
  const green = dark ? "#34D399" : "#059669";
  const card = dark ? hexA("#ffffff", 0.05) : hexA("#ffffff", 0.72);
  const accIsLight = luminance(acc) > 0.19;
  const onAccentInk = accIsLight ? "#1a1220" : "#ffffff";
  const ink = (a) => dark ? "rgba(244,241,248," + a + ")" : "rgba(24,18,32," + a + ")";

  return {
    // ── base 32 ──────────────────────────────────────────────────────────
    mode: dark ? "dark" : "light",
    family: key,
    bg: lastStop(p.bg),
    surface: card,
    card,
    cardAlt: dark ? hexA("#ffffff", 0.03) : hexA("#ffffff", 0.55),
    border: hexA(acc, 0.28),
    borderStrong: hexA(acc, 0.55),
    glowShadow: "0 0 0 1px " + hexA(acc, 0.25) + ",0 0 14px " + hexA(acc, 0.10),
    glowShadowStrong: "0 0 0 1px " + hexA(acc, 0.5) + ",0 0 20px " + hexA(acc, 0.18),
    accent: acc,
    accentSoft: p.accTxt,
    accentGlow: hexA(acc, 0.40),
    accentPill: hexA(acc, 0.14),
    text,
    subtext: p.accTxt,
    muted: dark ? hexA("#ffffff", 0.38) : hexA("#1A1523", 0.45),
    // Banners are an accent gradient from→to. NOT the nav pair: on the eight
    // light palettes nav is white-to-near-white and every banner would go blank.
    bannerFrom: p.a[1],
    bannerTo: p.a[0],
    navBg: "linear-gradient(180deg," + p.nav[0] + "," + p.nav[1] + ")",
    inputBg: dark ? hexA("#ffffff", 0.06) : hexA("#ffffff", 0.85),
    // Four slots, matching legacy: protein, carbs, fat, and the green the
    // current HomeTab reads for supplements at macro[3]. Legacy consumers use
    // these as TEXT as well as bar fill, so on a light palette take the dark
    // stop of each pair — the light stop was pale yellow on white for Fat.
    // Same rule the export applies (--m2Txt: dark ? m[1][1] : m[1][0]).
    macro: dark ? [p.m[0][1], p.m[1][1], p.m[2][1], p.sup[1]]
                : [p.m[0][0], p.m[1][0], p.m[2][0], p.sup[0]],
    red, green,
    greenBg: hexA(green, 0.10),
    greenText: green,
    // Legacy semantics kept on purpose: remaining is a SURFACE, remainingText
    // the ink on it. The Swift port reads these names.
    remaining: card,
    remainingText: p.accTxt,
    calCell: card,
    calCellSel: acc,
    calMiss: hexA(text, 0.12),
    barEmpty: hexA(text, 0.08),

    // ── extended (mirrors buildThemeVars in themes.js) ────────────────────
    locked: true,                 // mode is fixed; the light/dark toggle hides
    appBg: p.bg,                  // the page gradient — full-screen shells only
    homeSurface: card,
    heroBg: p.heroBg,
    arc: p.a,
    macroPair: p.m,
    water: p.wat[1], waterDeep: p.wat[0], waterText: p.wat[2],
    waterBorder: hexA(p.wat[0], dark ? 0.55 : 0.62),
    waterGlow: hexA(p.wat[1], dark ? 0.35 : 0.22),
    supp: p.sup[1], suppDeep: p.sup[0], suppText: p.sup[2],
    suppBorder: hexA(p.sup[0], dark ? 0.48 : 0.6),
    chip: p.chip,
    chipBg: hexA(p.chip, dark ? 0.12 : 0.16),
    chipBorder: hexA(p.chip, dark ? 0.22 : 0.3),
    fab: p.fab,
    fabBase: dark ? p.nav[1] : (accIsLight ? p.fab[0] : p.m[0][0]),
    fabInk: dark ? "#ffffff" : onAccentInk,
    tracer: [hexA(p.tr[0], dark ? 0.5 : 0.55), hexA(p.tr[0], 1), hexA(p.tr[1], 0.95)],
    navA: p.nav[0], navB: p.nav[1],
    navOn: dark ? "#ffffff" : "#181220",
    navOff: ink(dark ? 0.42 : 0.5),
    navLine: dark ? "rgba(255,255,255,.1)" : "rgba(24,18,32,.1)",
    navShadow: dark ? "0 -8px 22px rgba(0,0,0,.5)" : "0 -2px 10px rgba(24,18,32,.09)",
    track: dark ? "rgba(255,255,255,.08)" : "rgba(24,18,32,.1)",
    glow: hexA(acc, dark ? 0.55 : 0.35),
    glowSoft: hexA(acc, dark ? 0.24 : 0.18),
    glowInner: hexA(acc, dark ? 0.1 : 0.07),
    lift: dark ? "0 6px 18px rgba(0,0,0,.34)" : "0 4px 14px " + hexA(p.accTxt, 0.12),
    pillBg: dark ? "rgba(255,255,255,.07)" : "rgba(24,18,32,.05)",
    pillLine: dark ? "rgba(8,6,12,.35)" : "rgba(255,255,255,.5)",
    sessionBg: "linear-gradient(155deg," + hexA(acc, dark ? 0.3 : 0.18) + "," + (dark ? "rgba(12,8,19,.4)" : "rgba(255,255,255,.72)") + ")",
    startBg: dark ? "#ffffff" : acc,
    startText: dark ? "#181220" : onAccentInk,
    onAccent: dark ? "#150a24" : onAccentInk,
    avatarFrom: p.a[2], avatarTo: acc,
    accentText: p.accTxt,
    accentSurface: "linear-gradient(160deg," + hexA(acc, dark ? 0.16 : 0.12) + "," + (dark ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.7)") + ")",
    accentLine: hexA(acc, dark ? 0.62 : 0.6),
    dim: ink(dark ? 0.58 : 0.62),
    faint: ink(dark ? 0.4 : 0.48),
  };
}

// Every key the redesigned Home reads beyond the base 32. Legacy themes must
// carry all of them too — Home rendered under aurora_dark with T.arc undefined
// and took the whole tree down (no error boundary). Tested for every registry
// entry in theme.test.js.
export const EXTENDED_THEME_KEYS = Object.keys(paletteToTheme("pastel")).filter((k) => !BASE_THEME_KEYS.includes(k));

// Derives the extended keys for a LEGACY entry from its own colours, so the
// five families keep their look and Home simply picks up their accent/macros.
export function legacyExtended(t) {
  const dark = t.mode === "dark";
  const acc = t.accent;
  const isHex = (c) => /^#[0-9a-fA-F]{6}$/.test(c || "");
  const a = (c, al) => (isHex(c) ? hexA(c, al) : c);
  const m = t.macro;
  const accIsLight = isHex(acc) && luminance(acc) > 0.19;
  const onAccentInk = accIsLight ? "#1a1220" : "#ffffff";
  const ink = (al) => dark ? "rgba(244,241,248," + al + ")" : "rgba(24,18,32," + al + ")";
  const water = m[1], supp = t.green;
  return {
    locked: false,
    appBg: t.bg,
    homeSurface: t.card,
    heroBg: t.card,
    arc: [m[1], acc, t.accentSoft],
    macroPair: [[m[0], t.accentSoft], [m[1], m[1]], [m[2], m[2]]],
    water, waterDeep: water, waterText: dark ? water : m[1],
    waterBorder: a(water, dark ? 0.55 : 0.62),
    waterGlow: a(water, dark ? 0.35 : 0.22),
    supp, suppDeep: supp, suppText: t.greenText || supp,
    suppBorder: a(supp, dark ? 0.48 : 0.6),
    chip: "#F59E0B", chipBg: "rgba(245,158,11,0.12)", chipBorder: "rgba(245,158,11,0.28)",
    fab: [t.accentSoft, acc, m[1]],
    fabBase: t.card,
    fabInk: "#ffffff",
    tracer: [a(acc, dark ? 0.5 : 0.55), acc, t.accentSoft],
    navA: t.navBg, navB: t.navBg,
    navOn: dark ? "#ffffff" : "#181220",
    navOff: ink(dark ? 0.42 : 0.5),
    navLine: t.border,
    navShadow: dark ? "0 -8px 22px rgba(0,0,0,.5)" : "0 -2px 10px rgba(24,18,32,.09)",
    track: t.barEmpty,
    glow: t.accentGlow, glowSoft: a(acc, dark ? 0.24 : 0.18), glowInner: a(acc, dark ? 0.1 : 0.07),
    lift: t.glowShadow,
    pillBg: t.accentPill,
    pillLine: dark ? "rgba(8,6,12,.35)" : "rgba(255,255,255,.5)",
    sessionBg: "linear-gradient(155deg," + a(acc, dark ? 0.3 : 0.18) + "," + t.card + ")",
    startBg: acc, startText: onAccentInk,
    onAccent: onAccentInk,
    avatarFrom: acc, avatarTo: t.accentSoft,
    accentText: dark ? t.accentSoft : acc,
    accentSurface: "linear-gradient(160deg," + a(acc, dark ? 0.16 : 0.12) + "," + t.card + ")",
    accentLine: t.borderStrong,
    dim: t.subtext, faint: t.muted,
  };
}
