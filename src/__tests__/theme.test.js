import { describe, it, expect } from "vitest";
import { paletteToTheme, BASE_THEME_KEYS, EXTENDED_THEME_KEYS } from "../lib/paletteToTheme.js";
import { THEME_ORDER } from "../themes.js";
import { THEMES, resolveTheme, resolveDark } from "../App.jsx";

const filled = (v) =>
  (typeof v === "string" && v.length > 0) || (Array.isArray(v) && v.length > 0);

describe("paletteToTheme", () => {
  it("returns every legacy base key for pastel, each a non-empty string or array", () => {
    const t = paletteToTheme("pastel");
    // Loop the list, don't hand-check — a key with no derivation names itself.
    const missing = BASE_THEME_KEYS.filter((k) => !filled(t[k]));
    expect(missing).toEqual([]);
    expect(BASE_THEME_KEYS.length).toBe(32);
  });

  it("has no undefined value for any of the 12 palettes (base + extended)", () => {
    for (const key of THEME_ORDER) {
      const t = paletteToTheme(key);
      const undef = Object.entries(t).filter(([, v]) => v === undefined).map(([k]) => k);
      expect({ key, undef }).toEqual({ key, undef: [] });
    }
  });

  it("keeps bg a solid 6-digit hex — ProgressPage appends hex alpha to it", () => {
    for (const key of THEME_ORDER) expect(paletteToTheme(key).bg).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("keeps legacy semantics: remaining is a surface, remainingText the ink; macro has 4 slots", () => {
    const t = paletteToTheme("pastel");
    expect(t.remaining).toBe(t.card);
    expect(t.remainingText).toBe(t.accentText);
    expect(t.macro).toHaveLength(4);
  });
});

describe("resolveTheme — profiles.theme -> theme object", () => {
  it("resolves a mode-locked key exactly", () => {
    const r = resolveTheme("pastel_light");
    expect(r.T).toBe(THEMES.pastel_light);
    expect(r).toMatchObject({ family: "pastel", dark: false });
  });

  it("snaps an unknown family to pastel_light regardless of stored mode", () => {
    for (const stored of ["garbage_dark", "garbage_light", "nope", "", undefined, null]) {
      const r = resolveTheme(stored);
      expect(r.T).toBe(THEMES.pastel_light);
      expect(r).toMatchObject({ family: "pastel", dark: false });
    }
  });

  it("keeps the MODE for a legacy bare value: dark -> aurora_dark, light -> pastel_light", () => {
    expect(resolveTheme("dark")).toMatchObject({ family: "aurora", dark: true });
    expect(resolveTheme("dark").T).toBe(THEMES.aurora_dark);
    expect(resolveTheme("light")).toMatchObject({ family: "pastel", dark: false });
    expect(resolveTheme("light").T).toBe(THEMES.pastel_light);
  });

  it("ignores a stored mode that contradicts a locked palette", () => {
    // A row that somehow says pastel_dark must not crash or invent a dark pastel.
    expect(resolveTheme("pastel_dark").T).toBe(THEMES.pastel_light);
    expect(resolveTheme("cyberpunk_light").T).toBe(THEMES.cyberpunk_dark);
  });

  it("still resolves the five legacy families in both modes", () => {
    expect(resolveTheme("aurora_dark").T).toBe(THEMES.aurora_dark);
    expect(resolveTheme("obsidian_light").T).toBe(THEMES.obsidian_light);
    expect(THEMES.aurora_dark.appBg).toBe(THEMES.aurora_dark.bg);
  });
});

describe("resolveDark — the toggleTheme persistence bug", () => {
  it("resolves an updater against current state: from dark, d=>!d persists light", () => {
    expect(resolveDark(true, (d) => !d)).toBe(false);
    expect(resolveDark(false, (d) => !d)).toBe(true);
  });
  it("passes a plain boolean through", () => {
    expect(resolveDark(true, false)).toBe(false);
    expect(resolveDark(false, true)).toBe(true);
  });
});

describe("THEMES registry — every entry carries every key Home reads", () => {
  // Home rendered under aurora_dark with T.arc undefined and blanked the app.
  // This is the test that would have caught it: loop every entry, every key.
  it("has all base + extended keys defined for all 22 entries", () => {
    const keys = [...BASE_THEME_KEYS, ...EXTENDED_THEME_KEYS];
    expect(Object.keys(THEMES)).toHaveLength(22);
    for (const [name, t] of Object.entries(THEMES)) {
      const missing = keys.filter((k) => t[k] === undefined);
      expect({ name, missing }).toEqual({ name, missing: [] });
    }
    expect(THEMES.aurora_dark.arc).toHaveLength(3);
    expect(THEMES.aurora_dark.macroPair[2]).toHaveLength(2);
  });
});
