# Migrating the new Home screen into WiFIt

Two new files, one import, one theme-registry merge. Nothing else in `src/App.jsx` has to move.

```
src/
  themes.js       <- new (12 palettes + buildThemeVars)
  HomeScreen.jsx  <- new (home screen + its tab bar)
  App.jsx         <- 3 small edits below
```

---

## 1. Drop the files in

Copy `export/themes.js` and `export/HomeScreen.jsx` into `src/`.
Neither has a dependency beyond React. `themes.js` has none at all.

## 2. Render it from App.jsx

Find where the home tab is rendered and swap the component in:

```jsx
import HomeScreen from './HomeScreen';

// ...inside the tab switch
{tab === 'home' && (
  <HomeScreen
    theme={themeName}                       // e.g. 'cyberpunk' — see step 3
    activeTab={tab}
    onNavigate={setTab}
    data={homeData}                          // see step 4
    onAddWater={(oz) => setWaterOz(waterOz + oz)}
    onToggleSupplement={(id) => toggleSupp(id)}
    onStartWorkout={() => setTab('train')}
    onOpenCalendar={() => setTab('calendar')}
    onOpenProfile={() => setTab('profile')}
    onQuickAdd={(what) => openAddSheet(what)} // 'Meal' | 'Water' | 'Dose' | 'Workout'
    onShowAllMeals={() => setTab('food')}
  />
)}
```

Omit `onAddWater` / `onToggleSupplement` and the screen drives those two interactions
from local state instead — useful while you wire the rest up.

## 3. Merge the palettes into your theme registry

Your existing registry stores a family plus a mode (`family_dark` / `family_light` in Supabase).
These 12 are **single-mode palettes** — each one is either dark or light by design; forcing a light
Cyberpunk or a dark Porcelain loses the point of them.

Recommended merge — keep your five families exactly as they are and register the new ones as
mode-locked entries:

```js
import { THEMES as HOME_THEMES, THEME_META, THEME_ORDER } from './themes';

// existing families keep working untouched
export const THEME_FAMILIES = {
  aurora: {...}, forest: {...}, ember: {...}, rose: {...}, obsidian: {...},

  // new: mode is fixed, so the light/dark switch is hidden for these
  ...Object.fromEntries(THEME_ORDER.map((key) => [key, {
    label: THEME_META[key].label,
    blurb: THEME_META[key].blurb,
    lockedMode: THEME_META[key].mode,   // 'dark' | 'light'
    palette: HOME_THEMES[key]
  }]))
};
```

Then in the profile screen's theme picker:

* show `label` + `blurb`, grouped by `lockedMode`
* when a locked theme is selected, hide (or disable) the dark/light toggle
* persist as you do today — write `${key}_${lockedMode ?? currentMode}` to Supabase so the
  existing `family_dark` / `family_light` column format still parses

**Name collision:** none. `ember` is yours and is not in the new set.

If you would rather have every new theme respond to the toggle, pair them instead — each pair is
already a dark/light sibling of the same hue family:

| toggle family | dark      | light     |
|---------------|-----------|-----------|
| cyber         | cyberpunk | cyberlite |
| rose          | wine      | frozen    |
| violet        | (obsidian)| lilac / porcelain |
| neutral       | slate     | pastel    |
| citrus        | volt      | tropical / coral |
| cosmic        | —         | gagarin   |

## 4. Data shape

`HomeScreen` reads one `data` object. `DEMO_DATA` in `HomeScreen.jsx` is the reference shape —
map your existing state into it:

```js
const homeData = {
  greeting, dateLabel, initial, streakDays,
  calories: { goal, eaten, burned },
  macros: [{ key, label, value, goal }, ...],          // exactly 3
  week:   [{ day, date, kcal, today? }, ...],          // exactly 7
  weekLabel,
  workout: { time, name, summary, preview: [] },       // preview = up to 3 short strings
  water:   { oz, goalOz, incrementOz },
  supplements: [{ id, name, taken, due }, ...],        // 5 fits the grid; more will still lay out
  meals:  [{ id, time, name, slot, p, c, f, kcal }, ...],
  plannedMeals
};
```

## 5. Styling contract

Everything is a CSS custom property written onto the screen's root by `buildThemeVars(name)`.
No stylesheet, no CSS-in-JS runtime, no class names to collide with.

If you want the **whole app** re-themed (not just Home), spread the same vars on your app shell
and read `var(--bg)`, `var(--surf)`, `var(--line)`, `var(--acc)` etc. from your other screens.
Mapping onto your current token names:

| your token   | new variable   |
|--------------|----------------|
| `bg`         | `--bg`         |
| `surface`    | `--surf`       |
| `card`       | `--surf`       |
| `border`     | `--line`       |
| `accent`     | `--acc`        |
| `accentPill` | `--accSoft`    |
| `macro[0..2]`| `--m1`/`--m2`/`--m3` |
| `remaining`  | `--accTxt`     |
| `navBg`      | `--navA` → `--navB` gradient |

## 6. Motion

Three keyframes ship in `themes.js` as the `KEYFRAMES` string; `HomeScreen` injects them in a
`<style>` tag so there is nothing to add globally.

* `wfTrace` — comet sweeping the calorie card border and the FAB ring
* `wfFabHalo` — the FAB's breathing glow
* `wfNavBreathe` — the nav's top edge light

All three are pure CSS and respect `prefers-reduced-motion` if you add one global rule:

```css
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; } }
```

## 7. Reference file

`export/home-reference.html` is the same screen with no framework — open it to compare pixel for
pixel, or hand it to anyone who does not run the React app. It imports `themes.js` as an ES module,
so serve it (`npx serve export`) rather than opening from `file://`.
