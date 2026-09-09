# WiFit — feature inventory (every user-reachable function → iOS home)

Every user-reachable capability in `App.jsx` + `HomeTab.jsx` + `TabBar.jsx`, one
line each, with where it lives in iOS:

- **ported** — behaviour ported from the React reference (shipped Home + the
  audited Food/Train/Supps screens are the design/behaviour reference).
- **native** — designed natively for iOS (Settings/Profile/Onboarding and the
  trainer screens; not redesigned in React first).
- **v1?** — candidate to defer; decide in the design brief.
- **cut** — dead/legacy, do not port.

The rule (HANDOFF): every ported feature must have a named home BEFORE any
SwiftUI is written; a feature with no home is a decision to surface, not a gap to
discover later.

## Navigation shell — `TabBar.jsx`
| Feature | iOS |
|---|---|
| 4-tab bar (Home/Food/Train/Supps) + center quick-add fan | ported (native tab bar; the fan is a native affordance) |
| Quick-add fan → Meal / Water / Dose / Workout | ported |
| Active-workout dot on the Train tab | ported |

## Home — `HomeTab.jsx` (the design reference; `src/lib/ui.jsx` primitives)
| Feature | iOS |
|---|---|
| Header: greeting, date, streak chip → Progress, theme toggle, Coach, Calendar, avatar → Profile | ported |
| Week rail (Mon–Sun, per-day ring + dots), failed/Retry | ported |
| Calorie hero (kcal left, % of goal, eaten) | ported |
| Macro row (protein/carbs/fat vs goal) | ported |
| Today's session card / "no plan" / Start | ported |
| Water card (+8) | ported |
| Supplement stack capsules (tap = toggle taken), LOG, empty state | ported |
| Weight strip (last, delta, inline log) | ported |
| Meals-today summary → Food | ported |

## Food — `FoodTab`, `AddFoodModal`, `QuickAddPanel`, `BarcodeScanner`
| Feature | iOS |
|---|---|
| Day view: 4 meal slots, per-slot kcal, add-per-slot, totals | ported |
| Add a food: search → pick → grams/servings → log (`addFoodItem`, checked write, uuid write-back) | ported |
| Food search: custom → local catalogue → OFF (via `api/off` proxy) merged; three-state ladder (ok/partial/none/failed) | ported (source is settled: DATA split, see KNOWN_ISSUES/#22) |
| Barcode scan → OFF product lookup | ported (needs camera + a Swift barcode lib) |
| Create custom food (`addCustomFoodDB`, checked) | ported |
| Edit/delete a custom food | **v1?** — no web UI today (#5); decide in brief |
| Delete a logged item (checked delete, restore on fail) | ported |
| Water strip (+oz presets, reset) | ported (dedupe with Home's water) |
| Nutrition breakdown (fiber/sugar/sodium as reference numbers) | ported (render null as "—", not 0) |

## Train — `WorkoutTab`, `ActiveWorkout`, `CreateWorkoutModal`, `ExercisePreviewList`
| Feature | iOS |
|---|---|
| Plans list; Today card; History | ported |
| Start workout → live session: tick sets, edit actual reps/weight, timer, live PR banner (`computePRs` vs `exercise_bests`) | ported |
| Finish → save session (checked, uuid write-back, `setsData`) | ported |
| In-progress session survives navigation (snapshot) | ported (native lifecycle; the web snapshot was a workaround) |
| History cards: PR banners from `exercise_pr_events`, per-exercise 🏆 | ported |
| Edit sets / delete a logged session (#25, re-read is the state change) | ported |
| Create/edit/delete a workout plan (checked) | ported |
| History/bests failed → Start paused + Retry | ported |

## Supps — `SuppsTab`, `ReminderModal`, `SuppSearchPanel`
| Feature | iOS |
|---|---|
| Stack list, add from catalogue/search, reorder (sort_order) | ported |
| Toggle taken today (upsert supplement_log) | ported |
| Edit name/sub, remove (checked) | ported |
| Reminders | **native** — real `UNUserNotificationCenter` (#26); the web toggle is a no-op and must not be ported as-is |
| Category dots (8 purpose values) | ported |

## Calendar & Progress — `CalendarTab`, `ProgressPage`
| Feature | iOS |
|---|---|
| Month grid: per-day food/workout/supps, tap a day | ported |
| Progress: avg calories, workouts, supp adherence, weight change, trend chart, calorie bars, heat strip, PRs this month | ported (all from `daily_summary`/`weight_monthly`/`exercise_pr_events`) |
| Range picker 7/30/90d; refuse-to-render on failed read | ported |

## Coach — `AISidePanel`, `RecipeCard` (see COACH.md)
| Feature | iOS |
|---|---|
| Chat, persisted per user (localStorage → native store) | ported |
| ACTIONS: log food/water, propose supps/plan/meal/recipe | ported |
| Applied-action cards + replay as context | ported |
| Photo analyze; weekly Monday check-in; follow-up suggestions | v1? (photo needs vision; check-in is a nice-to-have) |
| 60/hr + 400/day limit shared across web + 2 iOS apps | ported (see COACH.md — WILL look like a client bug in testing) |

## Auth / Onboarding / Profile / Settings — mostly **native**
| Feature | iOS |
|---|---|
| Email/password auth, session refresh, resolveSession routing | ported (data layer) / native screens |
| Onboarding wizard → BMR/TDEE → goals (checked upsert, no onComplete on fail) | **native** screens; the BMR/TDEE math ports exactly (still in App.jsx — extract with a value-for-value test) |
| Profile edit (goals/name/weight; checked, gated ✓) | **native** |
| Personalization: 12 mode-locked palettes + 5 legacy families | **native** (or a reduced iOS theme set — design decision) |
| Settings: HealthKit sync, notifications toggle | **native** (HealthKit is a platform reason for the rewrite) |
| Upgrade / Help pages | v1? (native, low priority) |
| Demo mode | **cut** (a web onboarding shortcut) |

## Trainer (client-facing) — **native**, render only under a trainer agreement
| Feature | iOS |
|---|---|
| Consent flow (currently web `/trainer-consent`) | native or keep web link — design decision |
| Assignments, messages, appointments (via `trainerhq-api`, TRAINERHQ_CONTRACT.md) | **native**, empty state is the default for most users and must not look broken |

## Legacy / dead — **cut**
`workouts` table, `water_log.cups`, `body_weight_log.note`, `supplement stack`
reminder web timers, `workout_sessions.prs` column (dead since #28), the USDA
search path (off by design), the coach's six legacy prefix parsers (kept only
until the model stops emitting them).
