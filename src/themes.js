// ---------------------------------------------------------------------------
// themes.js — 12 WiFIt home palettes + CSS-variable builder
// No dependencies. Works in React, plain JS, or any bundler.
//
//   import { THEMES, THEME_META, buildThemeVars } from './themes';
//   const vars = buildThemeVars('cyberpunk');   // -> { '--bg': '...', ... }
//   <div style={vars}>…</div>                   // every child reads var(--x)
// ---------------------------------------------------------------------------

/**
 * Palette record shape:
 *   dark    1 = dark UI, 0 = light UI (drives text/scrim/track defaults)
 *   bg      page background (any CSS background value)
 *   heroBg  background of the calories-left hero card
 *   acc     primary accent (rings, borders, glows)
 *   accTxt  accent color safe for small text on this theme's surfaces
 *   a       [arcStart, arcMid, arcEnd] — calorie arc gradient
 *   m       [[protDark, prot], [carbDark, carb], [fatDark, fat]] — macro bars
 *   wat     [deep, mid, text] — water section
 *   sup     [deep, mid, text] — supplement section
 *   chip    streak chip color
 *   nav     [navTop, navBottom] — tab bar gradient
 *   fab     [ring, body, ringAlt] — center + button
 *   tr      [cometA, cometB] — rotating border tracer
 */
export const THEMES = {
  // ---- dark ---------------------------------------------------------------
  cyberpunk: { dark: 1, bg: 'radial-gradient(130% 50% at 50% -8%,#43075c 0%,#170331 55%,#07010f 100%)', heroBg: 'radial-gradient(120% 90% at 50% 0%,#2f0650 0%,#150330 55%,#07010f 100%)', acc: '#ff2fb3', accTxt: '#ff8ede', a: ['#2f6bff', '#ff2fb3', '#b6ff3c'], m: [['#c2108a', '#ff8ede'], ['#1e46e0', '#7aa8ff'], ['#4d9e12', '#b6ff3c']], wat: ['#1e46e0', '#4d8dff', '#8ab6ff'], sup: ['#3f8a0d', '#b6ff3c', '#b6ff3c'], chip: '#b6ff3c', nav: ['#330857', '#08010f'], fab: ['#ff8ede', '#d0128f', '#2f6bff'], tr: ['#ff2fb3', '#b6ff3c'] },
  volt:      { dark: 1, bg: 'radial-gradient(130% 55% at 50% -8%,#161a17 0%,#0c0f0a 58%,#080a07 100%)', heroBg: 'radial-gradient(120% 90% at 50% 0%,#1a1f1b 0%,#0e120e 55%,#080a07 100%)', acc: '#ff206e', accTxt: '#ff7ba6', a: ['#41ead4', '#ff206e', '#fbff12'], m: [['#c9134f', '#ff7ba6'], ['#1a9e8f', '#41ead4'], ['#b8bb00', '#fbff12']], wat: ['#1a9e8f', '#41ead4', '#41ead4'], sup: ['#b8bb00', '#fbff12', '#fbff12'], chip: '#41ead4', nav: ['#1d221e', '#090b08'], fab: ['#fbff12', '#ff206e', '#41ead4'], tr: ['#ff206e', '#41ead4'] },
  wine:      { dark: 1, bg: 'radial-gradient(130% 50% at 50% -8%,#3d0a1c 0%,#1a0610 58%,#0b0308 100%)', heroBg: 'radial-gradient(120% 90% at 50% 0%,#360a19 0%,#1b0610 55%,#0b0308 100%)', acc: '#f43f5e', accTxt: '#fda4af', a: ['#9f1239', '#f43f5e', '#ffe4e6'], m: [['#9f1239', '#fb7185'], ['#b45309', '#fcd34d'], ['#7e22ce', '#c084fc']], wat: ['#0369a1', '#38bdf8', '#7dd3fc'], sup: ['#4d7c0f', '#bef264', '#a3e635'], chip: '#fcd34d', nav: ['#460c20', '#0d040a'], fab: ['#ffe4e6', '#e11d48', '#fbbf24'], tr: ['#fecdd3', '#fbbf24'] },
  slate:     { dark: 1, bg: 'radial-gradient(130% 50% at 50% -8%,#1d2433 0%,#0d1017 58%,#070a0e 100%)', heroBg: 'radial-gradient(120% 90% at 50% 0%,#1b2231 0%,#0e1219 55%,#070a0e 100%)', acc: '#94a3b8', accTxt: '#cbd5e1', a: ['#475569', '#94a3b8', '#e2e8f0'], m: [['#475569', '#cbd5e1'], ['#0f766e', '#5eead4'], ['#9f1239', '#fb7185']], wat: ['#0369a1', '#60a5fa', '#93c5fd'], sup: ['#4d7c0f', '#bef264', '#a3e635'], chip: '#fcd34d', nav: ['#242c3d', '#080b10'], fab: ['#e2e8f0', '#64748b', '#38bdf8'], tr: ['#e2e8f0', '#38bdf8'] },

  // ---- light --------------------------------------------------------------
  gagarin:   { dark: 0, bg: 'linear-gradient(160deg,#69eacb 0%,#eaccf8 55%,#6654f1 100%)', heroBg: 'linear-gradient(160deg,#ffffff 0%,#f2fbf8 45%,#efe7fd 100%)', acc: '#6654f1', accTxt: '#4a37d4', a: ['#69eacb', '#6654f1', '#eaccf8'], m: [['#4a37d4', '#a99ef8'], ['#0e8f76', '#69eacb'], ['#8b3fc9', '#d8a8f4']], wat: ['#0e7490', '#22d3ee', '#0b6f88'], sup: ['#0e8f76', '#69eacb', '#0c7a63'], chip: '#8b3fc9', nav: ['#ffffff', '#f0ecfd'], fab: ['#eaccf8', '#6654f1', '#69eacb'], tr: ['#6654f1', '#69eacb'] },
  tropical:  { dark: 0, bg: 'linear-gradient(165deg,#fff3ea 0%,#ffe4ea 55%,#fdf6d8 100%)', heroBg: 'linear-gradient(160deg,#ffffff 0%,#fff4ea 50%,#ffe9ef 100%)', acc: '#ff8243', accTxt: '#d95d1e', a: ['#069494', '#ff8243', '#fce883'], m: [['#d95d1e', '#ffb888'], ['#069494', '#5ed6d6'], ['#d9407a', '#ffc0cb']], wat: ['#057373', '#069494', '#057070'], sup: ['#a08c00', '#fce883', '#8a7700'], chip: '#d9407a', nav: ['#ffffff', '#fff0e6'], fab: ['#fce883', '#ff8243', '#069494'], tr: ['#ff8243', '#069494'] },
  pastel:    { dark: 0, bg: 'linear-gradient(165deg,#d3f8e2 0%,#e4c1f9 55%,#a9def9 100%)', heroBg: 'linear-gradient(160deg,#ffffff 0%,#f3fbf6 45%,#f6ecfd 100%)', acc: '#f694c1', accTxt: '#c25889', a: ['#a9def9', '#f694c1', '#ede7b1'], m: [['#c25889', '#f694c1'], ['#1f8f6b', '#7fd9ae'], ['#9a8b1f', '#ede7b1']], wat: ['#2b7fa8', '#a9def9', '#2b7fa8'], sup: ['#1f8f6b', '#d3f8e2', '#1c7d5e'], chip: '#8b4fbf', nav: ['#ffffff', '#f2f7fb'], fab: ['#e4c1f9', '#f694c1', '#a9def9'], tr: ['#f694c1', '#a9def9'] },
  cyberlite: { dark: 0, bg: 'linear-gradient(165deg,#c9f4ff 0%,#d8dcff 45%,#f6cdf2 100%)', heroBg: 'radial-gradient(125% 100% at 88% 0%,#b8f2ff 0%,#d5d9ff 45%,#f3c9ef 100%)', acc: '#7c3cff', accTxt: '#4c1bb0', a: ['#00a9b8', '#7c3cff', '#ff2bd6'], m: [['#c4009f', '#ff2bd6'], ['#5b21cc', '#7c3cff'], ['#0e7490', '#00c2d1']], wat: ['#0e7490', '#00a9b8', '#22d3ee'], sup: ['#5b21cc', '#7c3cff', '#6d28d9'], chip: '#c4009f', nav: ['#dceaff', '#c9d6ff'], fab: ['#ded0ff', '#7c3cff', '#00c2d1'], tr: ['#00a9b8', '#ff2bd6'] },
  coral:     { dark: 0, bg: 'linear-gradient(165deg,#ffcfd8 0%,#ffe1ab 50%,#a9f2d8 100%)', heroBg: 'radial-gradient(125% 100% at 15% 0%,#ffd8de 0%,#ffe6b5 48%,#b6f3de 100%)', acc: '#ff5a7a', accTxt: '#b81338', a: ['#06d6a0', '#ffd166', '#ff5a7a'], m: [['#e8395c', '#ff8fa3'], ['#b45309', '#ffd166'], ['#059669', '#06d6a0']], wat: ['#0369a1', '#38bdf8', '#0284c7'], sup: ['#047857', '#06d6a0', '#04624f'], chip: '#b45309', nav: ['#ffdde2', '#ffe8c4'], fab: ['#ffd3dc', '#ff5a7a', '#ffd166'], tr: ['#ffd166', '#ff5a7a'] },
  frozen:    { dark: 0, bg: 'linear-gradient(0deg,#fdcbf1 0%,#e6dee9 100%)', heroBg: 'linear-gradient(160deg,#ffffff 0%,#fbeaf7 55%,#eee7f1 100%)', acc: '#c2569e', accTxt: '#9d3d7f', a: ['#6654f1', '#c2569e', '#fdcbf1'], m: [['#9d3d7f', '#f0a8d6'], ['#0f766e', '#69eacb'], ['#6654f1', '#b0a5f7']], wat: ['#4b3fd6', '#8f83f5', '#4b3fd6'], sup: ['#0f766e', '#69eacb', '#0e6b63'], chip: '#9d3d7f', nav: ['#ffffff', '#f6eef4'], fab: ['#fdcbf1', '#c2569e', '#6654f1'], tr: ['#c2569e', '#6654f1'] },
  lilac:     { dark: 0, bg: 'linear-gradient(180deg,#fcf6ff 0%,#efe4fb 100%)', heroBg: 'radial-gradient(120% 90% at 50% 0%,#ffffff 0%,#f7f0fe 60%,#eee2fb 100%)', acc: '#9333ea', accTxt: '#7e22ce', a: ['#7e22ce', '#a855f7', '#e9d5ff'], m: [['#9333ea', '#d8b4fe'], ['#be185d', '#f9a8d4'], ['#b45309', '#fcd34d']], wat: ['#0369a1', '#38bdf8', '#0284c7'], sup: ['#4d7c0f', '#a3e635', '#4d7c0f'], chip: '#b45309', nav: ['#ffffff', '#f5edfd'], fab: ['#e9d5ff', '#9333ea', '#ec4899'], tr: ['#9333ea', '#ec4899'] },
  porcelain: { dark: 0, bg: 'linear-gradient(180deg,#f7f5fc 0%,#eae6f4 100%)', heroBg: 'radial-gradient(120% 90% at 50% 0%,#ffffff 0%,#f3f0fa 60%,#ebe6f6 100%)', acc: '#6d28d9', accTxt: '#5b21b6', a: ['#5b21b6', '#8b5cf6', '#c4b5fd'], m: [['#6d28d9', '#a78bfa'], ['#0f766e', '#5eead4'], ['#be123c', '#fb7185']], wat: ['#0369a1', '#38bdf8', '#0284c7'], sup: ['#3f6212', '#a3e635', '#4d7c0f'], chip: '#b45309', nav: ['#ffffff', '#f0ecf8'], fab: ['#ddd6fe', '#7c3aed', '#0ea5e9'], tr: ['#7c3aed', '#0ea5e9'] }
};

/** Display metadata — drive the theme picker in the profile screen from this. */
export const THEME_META = {
  cyberpunk: { label: 'Cyberpunk', mode: 'dark',  blurb: 'Magenta lasers, electric blue, acid green' },
  volt:      { label: 'Volt',      mode: 'dark',  blurb: 'Carbon black, hot pink, mint, highlighter yellow' },
  wine:      { label: 'Wine',      mode: 'dark',  blurb: 'Deep burgundy with rose and gold' },
  slate:     { label: 'Slate',     mode: 'dark',  blurb: 'Neutral graphite, quiet and technical' },
  gagarin:   { label: 'Gagarin',   mode: 'light', blurb: 'Mint to violet cosmic wash' },
  tropical:  { label: 'Tropical',  mode: 'light', blurb: 'Warm sand, coral orange, teal' },
  pastel:    { label: 'Pastel',    mode: 'light', blurb: 'Soft mint, lilac, powder blue' },
  cyberlite: { label: 'Cyber Lite',mode: 'light', blurb: 'Daylight cyberpunk — ice blue to magenta' },
  coral:     { label: 'Coral',     mode: 'light', blurb: 'Blush, apricot, sea green' },
  frozen:    { label: 'Frozen',    mode: 'light', blurb: 'Pink frost over cool grey' },
  lilac:     { label: 'Lilac',     mode: 'light', blurb: 'Pale violet, clean and calm' },
  porcelain: { label: 'Porcelain', mode: 'light', blurb: 'Near-white with a violet accent' }
};

/** Ordered list for the picker: darks first, then lights. */
export const THEME_ORDER = [
  'cyberpunk', 'volt', 'wine', 'slate',
  'gagarin', 'tropical', 'pastel', 'cyberlite', 'coral', 'frozen', 'lilac', 'porcelain'
];

export const DEFAULT_THEME = 'pastel';

// --- color helpers -----------------------------------------------------------

/** '#rrggbb' + alpha -> 'rgba(r,g,b,a)' */
export function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Relative luminance (WCAG) — used to pick readable ink on the accent color. */
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * Turn a palette name into the full CSS custom-property set the Home screen
 * (and anything else) reads. Spread it onto a wrapper element's style.
 */
export function buildThemeVars(name) {
  const T = THEMES[name] || THEMES[DEFAULT_THEME];
  const dark = !!T.dark;
  const accIsLight = luminance(T.acc) > 0.19;
  const onAccentInk = accIsLight ? '#1a1220' : '#ffffff';
  const inkBase = dark ? '244,241,248' : '24,18,32';
  const ink = (a) => `rgba(${inkBase},${a})`;

  return {
    // surfaces + text
    '--bg': T.bg,
    '--heroBg': T.heroBg,
    '--txt': dark ? '#f4f1f8' : '#181220',
    '--dim': ink(dark ? 0.58 : 0.62),
    '--faint': ink(dark ? 0.4 : 0.48),
    '--surf': dark ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.78)',
    '--line': dark ? hexA(T.acc, 0.42) : hexA(T.accTxt, 0.5),
    '--lift': dark ? '0 6px 18px rgba(0,0,0,.34)' : `0 4px 14px ${hexA(T.accTxt, 0.12)}`,
    '--track': dark ? 'rgba(255,255,255,.08)' : 'rgba(24,18,32,.1)',
    '--pillBg': dark ? 'rgba(255,255,255,.07)' : 'rgba(24,18,32,.05)',
    '--pillLine': dark ? 'rgba(8,6,12,.35)' : 'rgba(255,255,255,.5)',

    // accent
    '--acc': T.acc,
    '--accTxt': T.accTxt,
    '--accSoft': `linear-gradient(160deg,${hexA(T.acc, dark ? 0.16 : 0.12)},${dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.7)'})`,
    '--accLine': hexA(T.acc, dark ? 0.62 : 0.6),
    '--sessionBg': `linear-gradient(155deg,${hexA(T.acc, dark ? 0.3 : 0.18)},${dark ? 'rgba(12,8,19,.4)' : 'rgba(255,255,255,.72)'})`,
    '--glow': hexA(T.acc, dark ? 0.55 : 0.35),
    '--glowSoft': hexA(T.acc, dark ? 0.24 : 0.18),
    '--glowInner': hexA(T.acc, dark ? 0.1 : 0.07),

    // macros
    '--m1d': T.m[0][0], '--m1': T.m[0][1],
    '--m2d': T.m[1][0], '--m2': T.m[1][1],
    '--m3d': T.m[2][0], '--m3': T.m[2][1],
    '--m2Txt': dark ? T.m[1][1] : T.m[1][0],

    // water
    '--watD': T.wat[0], '--wat': T.wat[1], '--watTxt': T.wat[2],
    '--watLine': hexA(T.wat[0], dark ? 0.55 : 0.62),
    '--watGlow': hexA(T.wat[1], dark ? 0.35 : 0.22),

    // supplements
    '--supD': T.sup[0], '--sup': T.sup[1], '--supTxt': T.sup[2],
    '--supLine': hexA(T.sup[0], dark ? 0.48 : 0.6),

    // streak chip + avatar
    '--chipTxt': T.chip,
    '--chipBg': hexA(T.chip, dark ? 0.12 : 0.16),
    '--chipLine': hexA(T.chip, dark ? 0.22 : 0.3),
    '--av1': T.a[2], '--av2': T.acc,
    '--onAcc': dark ? '#150a24' : onAccentInk,
    '--startBg': dark ? '#fff' : T.acc,
    '--startTxt': dark ? '#181220' : onAccentInk,

    // rotating border tracer (calorie card + FAB ring)
    '--tr0': hexA(T.tr[0], dark ? 0.5 : 0.55),
    '--tr1': hexA(T.tr[0], 1),
    '--tr2': hexA(T.tr[1], 0.95),

    // tab bar
    '--navA': T.nav[0], '--navB': T.nav[1],
    '--navOn': dark ? '#ffffff' : '#181220',
    '--navOff': ink(dark ? 0.42 : 0.5),
    '--navLine': dark ? 'rgba(255,255,255,.1)' : 'rgba(24,18,32,.1)',
    '--navShadow': dark ? '0 -8px 22px rgba(0,0,0,.5)' : '0 -2px 10px rgba(24,18,32,.09)',
    '--fab1': T.fab[0], '--fab2': T.fab[1], '--fab3': T.fab[2],
    '--fabB': dark ? T.nav[1] : (accIsLight ? T.fab[0] : T.m[0][0]),
    '--fabIn': dark ? '#ffffff' : onAccentInk,

    // arc gradient stops (consumed by the inline <linearGradient>)
    '--arc1': T.a[0], '--arc2': T.a[1], '--arc3': T.a[2]
  };
}

/** Keyframes the screen needs. Inject once (see KEYFRAMES usage in HomeScreen). */
export const KEYFRAMES = `
@keyframes wfTrace { to { transform: rotate(360deg); } }
@keyframes wfFabHalo { 0%,100% { opacity:.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.06); } }
@keyframes wfNavBreathe { 0%,100% { opacity:.5; } 50% { opacity:1; } }
`;
