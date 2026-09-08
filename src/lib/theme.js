// Theme registry and context — the non-UI half of the theme system, moved out
// of App.jsx so HomeTab/TabBar (and Food, Train, Supps next) import useTheme
// from here instead of from App.jsx. That import was the edge that made
// HomeTab <-> App a cycle; every later extraction depends on it being gone.
//
// Zero JSX. GlobalStyle (the <style> injector) stays in App.jsx.
//
// Contract, unchanged:
//   THEMES            every key the app can render: 5 legacy families x
//                     dark/light (with extended keys derived by legacyExtended)
//                     + the 12 mode-locked palettes from themes.js
//   resolveTheme(str) profiles.theme -> {family, dark, T}. Bare "dark"/"light"
//                     rows keep their MODE; unknown families snap to pastel_light.
//   resolveDark       resolves a React-style updater BEFORE it reaches saveTheme.
//   LOCKED_FAMILIES   palettes that ignore the dark toggle.
//   ThemeCtx/useTheme the only way a component reads T.
import { createContext, useContext } from "react";
import { THEME_META, THEME_ORDER, DEFAULT_THEME } from "../themes.js";
import { paletteToTheme, legacyExtended } from "./paletteToTheme.js";

// ── THEME SYSTEM ──────────────────────────────────────────────
const LEGACY_THEMES = {
  aurora_dark:{mode:"dark",family:"aurora",
    bg:"#020B18",surface:"#071828",card:"#0A2035",cardAlt:"#071828",
    border:"rgba(6,182,212,0.28)",borderStrong:"rgba(6,182,212,0.55)",
    glowShadow:"0 0 0 1px rgba(6,182,212,0.25),0 0 14px rgba(6,182,212,0.1)",
    glowShadowStrong:"0 0 0 1px rgba(6,182,212,0.5),0 0 20px rgba(6,182,212,0.18)",
    accent:"#06B6D4",accentSoft:"#67E8F9",accentGlow:"rgba(6,182,212,0.4)",accentPill:"rgba(6,182,212,0.14)",
    text:"#F0FDFF",subtext:"#7DD3FC",muted:"#1E4060",
    bannerFrom:"#0A2540",bannerTo:"#020B18",navBg:"#010D16",inputBg:"#071828",
    macro:["#06B6D4","#A855F7","#F472B6","#34D399"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#071828",remainingText:"#7DD3FC",
    calCell:"#071828",calCellSel:"#06B6D4",calMiss:"#1E4060",barEmpty:"#0A2035",
  },
  aurora_light:{mode:"light",family:"aurora",
    bg:"#F8F9FC",surface:"#EEF0F8",card:"#FFFFFF",cardAlt:"#F2F3FA",
    border:"rgba(79,70,229,0.14)",borderStrong:"rgba(79,70,229,0.32)",
    glowShadow:"0 0 0 1px rgba(79,70,229,0.12),0 2px 14px rgba(79,70,229,0.08)",
    glowShadowStrong:"0 0 0 1px rgba(79,70,229,0.28),0 4px 18px rgba(79,70,229,0.12)",
    accent:"#4F46E5",accentSoft:"#6366F1",accentGlow:"rgba(79,70,229,0.18)",accentPill:"rgba(79,70,229,0.08)",
    text:"#0F0F1A",subtext:"rgba(15,15,26,0.48)",muted:"rgba(15,15,26,0.28)",
    bannerFrom:"#1E1B4B",bannerTo:"#111128",navBg:"rgba(248,249,252,0.98)",inputBg:"#EEF0F8",
    macro:["#4F46E5","#0891B2","#DB2777","#10B981"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#EEF0F8",remainingText:"#4F46E5",
    calCell:"#FFFFFF",calCellSel:"#4F46E5",calMiss:"#DDE0F0",barEmpty:"#EEF0F8",
  },
  forest_dark:{mode:"dark",family:"forest",
    bg:"#040D07",surface:"#081510",card:"#0D1F14",cardAlt:"#081510",
    border:"rgba(16,185,129,0.26)",borderStrong:"rgba(16,185,129,0.5)",
    glowShadow:"0 0 0 1px rgba(16,185,129,0.2),0 0 14px rgba(16,185,129,0.09)",
    glowShadowStrong:"0 0 0 1px rgba(16,185,129,0.45),0 0 20px rgba(16,185,129,0.16)",
    accent:"#10B981",accentSoft:"#34D399",accentGlow:"rgba(16,185,129,0.38)",accentPill:"rgba(16,185,129,0.12)",
    text:"#ECFDF5",subtext:"#6EE7B7",muted:"#14532D",
    bannerFrom:"#052E16",bannerTo:"#040D07",navBg:"#030A05",inputBg:"#081510",
    macro:["#10B981","#818CF8","#F472B6","#FBBF24"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#081510",remainingText:"#6EE7B7",
    calCell:"#081510",calCellSel:"#10B981",calMiss:"#14532D",barEmpty:"#0D1F14",
  },
  forest_light:{mode:"light",family:"forest",
    bg:"#F0FAF5",surface:"#DCFCE8",card:"#FFFFFF",cardAlt:"#E8F5EE",
    border:"rgba(5,150,105,0.16)",borderStrong:"rgba(5,150,105,0.35)",
    glowShadow:"0 0 0 1px rgba(5,150,105,0.11),0 2px 12px rgba(5,150,105,0.07)",
    glowShadowStrong:"0 0 0 1px rgba(5,150,105,0.28),0 4px 18px rgba(5,150,105,0.12)",
    accent:"#059669",accentSoft:"#10B981",accentGlow:"rgba(5,150,105,0.18)",accentPill:"rgba(5,150,105,0.09)",
    text:"#052E16",subtext:"rgba(5,46,22,0.5)",muted:"rgba(5,46,22,0.32)",
    bannerFrom:"#052E16",bannerTo:"#0A4D28",navBg:"rgba(240,250,245,0.98)",inputBg:"#DCFCE8",
    macro:["#059669","#6366F1","#DB2777","#0891B2"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#DCFCE8",remainingText:"#059669",
    calCell:"#FFFFFF",calCellSel:"#059669",calMiss:"#BBF7D0",barEmpty:"#DCFCE8",
  },
  ember_dark:{mode:"dark",family:"ember",
    bg:"#0F0700",surface:"#1A0E00",card:"#221200",cardAlt:"#1A0E00",
    border:"rgba(245,158,11,0.28)",borderStrong:"rgba(245,158,11,0.52)",
    glowShadow:"0 0 0 1px rgba(245,158,11,0.22),0 0 14px rgba(245,158,11,0.1)",
    glowShadowStrong:"0 0 0 1px rgba(245,158,11,0.48),0 0 20px rgba(245,158,11,0.18)",
    accent:"#F59E0B",accentSoft:"#FCD34D",accentGlow:"rgba(245,158,11,0.4)",accentPill:"rgba(245,158,11,0.12)",
    text:"#FFFBEB",subtext:"#FDE68A",muted:"#451A03",
    bannerFrom:"#451A03",bannerTo:"#0F0700",navBg:"#0A0500",inputBg:"#1A0E00",
    macro:["#F59E0B","#EF4444","#A855F7","#10B981"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#1A0E00",remainingText:"#FDE68A",
    calCell:"#1A0E00",calCellSel:"#F59E0B",calMiss:"#451A03",barEmpty:"#221200",
  },
  ember_light:{mode:"light",family:"ember",
    bg:"#FFFBF0",surface:"#FEF3C7",card:"#FFFFFF",cardAlt:"#FEF9EC",
    border:"rgba(217,119,6,0.16)",borderStrong:"rgba(217,119,6,0.35)",
    glowShadow:"0 0 0 1px rgba(217,119,6,0.1),0 2px 12px rgba(217,119,6,0.07)",
    glowShadowStrong:"0 0 0 1px rgba(217,119,6,0.28),0 4px 18px rgba(217,119,6,0.12)",
    accent:"#D97706",accentSoft:"#F59E0B",accentGlow:"rgba(217,119,6,0.18)",accentPill:"rgba(217,119,6,0.09)",
    text:"#1C0A00",subtext:"rgba(28,10,0,0.5)",muted:"rgba(28,10,0,0.3)",
    bannerFrom:"#451A03",bannerTo:"#78350F",navBg:"rgba(255,251,240,0.98)",inputBg:"#FEF3C7",
    macro:["#D97706","#DC2626","#7C3AED","#059669"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#FEF3C7",remainingText:"#D97706",
    calCell:"#FFFFFF",calCellSel:"#D97706",calMiss:"#FDE68A",barEmpty:"#FEF3C7",
  },
  rose_dark:{mode:"dark",family:"rose",
    bg:"#0D0409",surface:"#180A14",card:"#1F0C1A",cardAlt:"#180A14",
    border:"rgba(236,72,153,0.26)",borderStrong:"rgba(236,72,153,0.5)",
    glowShadow:"0 0 0 1px rgba(236,72,153,0.2),0 0 14px rgba(236,72,153,0.09)",
    glowShadowStrong:"0 0 0 1px rgba(236,72,153,0.45),0 0 20px rgba(236,72,153,0.16)",
    accent:"#EC4899",accentSoft:"#F9A8D4",accentGlow:"rgba(236,72,153,0.38)",accentPill:"rgba(236,72,153,0.12)",
    text:"#FFF0F6",subtext:"#FBCFE8",muted:"#500724",
    bannerFrom:"#4A0020",bannerTo:"#0D0409",navBg:"#090306",inputBg:"#180A14",
    macro:["#EC4899","#A78BFA","#06B6D4","#34D399"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#180A14",remainingText:"#FBCFE8",
    calCell:"#180A14",calCellSel:"#EC4899",calMiss:"#500724",barEmpty:"#1F0C1A",
  },
  rose_light:{mode:"light",family:"rose",
    bg:"#FFF5FA",surface:"#FFE4F0",card:"#FFFFFF",cardAlt:"#FFF0F6",
    border:"rgba(219,39,119,0.13)",borderStrong:"rgba(219,39,119,0.32)",
    glowShadow:"0 0 0 1px rgba(219,39,119,0.1),0 2px 12px rgba(219,39,119,0.06)",
    glowShadowStrong:"0 0 0 1px rgba(219,39,119,0.26),0 4px 18px rgba(219,39,119,0.1)",
    accent:"#DB2777",accentSoft:"#EC4899",accentGlow:"rgba(219,39,119,0.16)",accentPill:"rgba(219,39,119,0.08)",
    text:"#1A0010",subtext:"rgba(26,0,16,0.5)",muted:"rgba(26,0,16,0.3)",
    bannerFrom:"#831843",bannerTo:"#4A0020",navBg:"rgba(255,245,250,0.98)",inputBg:"#FFE4F0",
    macro:["#DB2777","#7C3AED","#0891B2","#059669"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#FFE4F0",remainingText:"#DB2777",
    calCell:"#FFFFFF",calCellSel:"#DB2777",calMiss:"#FBCFE8",barEmpty:"#FFE4F0",
  },
  obsidian_dark:{mode:"dark",family:"obsidian",
    bg:"#09090F",surface:"#111118",card:"#161622",cardAlt:"#111118",
    border:"rgba(139,92,246,0.22)",borderStrong:"rgba(139,92,246,0.45)",
    glowShadow:"0 0 0 1px rgba(139,92,246,0.18),0 0 14px rgba(139,92,246,0.08)",
    glowShadowStrong:"0 0 0 1px rgba(139,92,246,0.42),0 0 20px rgba(139,92,246,0.15)",
    accent:"#8B5CF6",accentSoft:"#A78BFA",accentGlow:"rgba(139,92,246,0.36)",accentPill:"rgba(139,92,246,0.11)",
    text:"#F5F3FF",subtext:"#C4B5FD",muted:"#2E1065",
    bannerFrom:"#1E1040",bannerTo:"#09090F",navBg:"#060609",inputBg:"#111118",
    macro:["#8B5CF6","#06B6D4","#F472B6","#34D399"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#111118",remainingText:"#C4B5FD",
    calCell:"#111118",calCellSel:"#8B5CF6",calMiss:"#2E1065",barEmpty:"#161622",
  },
  obsidian_light:{mode:"light",family:"obsidian",
    bg:"#F8F7FF",surface:"#EEEBFF",card:"#FFFFFF",cardAlt:"#F2F0FE",
    border:"rgba(124,58,237,0.13)",borderStrong:"rgba(124,58,237,0.3)",
    glowShadow:"0 0 0 1px rgba(124,58,237,0.1),0 2px 12px rgba(124,58,237,0.06)",
    glowShadowStrong:"0 0 0 1px rgba(124,58,237,0.26),0 4px 18px rgba(124,58,237,0.1)",
    accent:"#7C3AED",accentSoft:"#8B5CF6",accentGlow:"rgba(124,58,237,0.16)",accentPill:"rgba(124,58,237,0.08)",
    text:"#13005A",subtext:"rgba(19,0,90,0.5)",muted:"rgba(19,0,90,0.3)",
    bannerFrom:"#2E1065",bannerTo:"#1E1040",navBg:"rgba(248,247,255,0.98)",inputBg:"#EEEBFF",
    macro:["#7C3AED","#0891B2","#DB2777","#059669"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#EEEBFF",remainingText:"#7C3AED",
    calCell:"#FFFFFF",calCellSel:"#7C3AED",calMiss:"#DDD6FE",barEmpty:"#EEEBFF",
  },
};

// The 12 mode-locked palettes register under `${key}_${mode}`, so the persisted
// profiles.theme format is unchanged. Legacy entries gain appBg (= bg) so every
// full-screen shell reads one key whichever kind of theme is active.
export const DEFAULT_THEME_KEY = DEFAULT_THEME + "_" + THEME_META[DEFAULT_THEME].mode; // "pastel_light"
export const LOCKED_FAMILIES = new Set(THEME_ORDER);
export const THEMES = {
  ...Object.fromEntries(Object.entries(LEGACY_THEMES).map(([k, t]) => [k, { ...t, ...legacyExtended(t) }])),
  ...Object.fromEntries(THEME_ORDER.map((k) => [k + "_" + THEME_META[k].mode, paletteToTheme(k)])),
};

// Resolves whatever profiles.theme holds into a usable theme. One default, one
// branch: an unknown family on a current deploy is corrupted or legacy data,
// not a preference, so it snaps to pastel_light whatever mode was stored.
export function resolveTheme(stored) {
  const str = typeof stored === "string" ? stored : "";
  // Legacy rows hold a bare "dark"/"light" from before families existed. Keep
  // the MODE — flipping a dark-mode user to light is the failure — with the
  // default family for that mode. Pastel has no dark, so dark is aurora_dark,
  // which is exactly what those users were seeing when the row was written.
  if (str === "dark") return { family: "aurora", dark: true, T: THEMES.aurora_dark };
  if (str === "light") return { family: DEFAULT_THEME, dark: false, T: THEMES[DEFAULT_THEME_KEY] };
  const i = str.lastIndexOf("_");
  const family = i > 0 ? str.slice(0, i) : "";
  let dark = i > 0 && str.slice(i + 1) === "dark";
  if (LOCKED_FAMILIES.has(family)) dark = THEME_META[family].mode === "dark";
  const key = family + "_" + (dark ? "dark" : "light");
  if (THEMES[key]) return { family, dark, T: THEMES[key] };
  return { family: DEFAULT_THEME, dark: false, T: THEMES[DEFAULT_THEME_KEY] };
}

// setIsDark accepts a value or an updater, like a React setter. The updater
// MUST be resolved against current state before it reaches saveTheme: passed
// through, a function is truthy and every toggle persisted "_dark".
export function resolveDark(prev, valOrFn) {
  return !!(typeof valOrFn === "function" ? valOrFn(prev) : valOrFn);
}

export const ThemeCtx = createContext(THEMES[DEFAULT_THEME_KEY]);
export const useTheme = () => useContext(ThemeCtx);
