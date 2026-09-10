# WiFit — feature inventory (every user-reachable function → iOS home)

Every user-reachable capability in `App.jsx` + `HomeTab.jsx` + `TabBar.jsx`, one
line each, with where it lives in iOS:

- **ported** — behaviour to preserve from the React reference; this is a
  requirement category, not a claim that the Swift screen is implemented.
- **native** — designed natively for iOS (Settings/Profile/Onboarding and the
  trainer screens; not redesigned in React first).
- **v1?** — candidate to defer; decide in the design brief.
- **cut** — dead/legacy, do not port.

The rule (HANDOFF): every ported feature must have a named home BEFORE any
SwiftUI is written; a feature with no home is a decision to surface, not a gap to
discover later.

**Visual authority updated by the user on 2026-09-09:** the supplied Home and
Workout screenshots define layout, hierarchy and proportions. See
[design-reference/README.md](../../design-reference/README.md). Other screens
use the same themes, typography, cards and navigation language, with coherent
native layouts. React Food/Train/Supps provide behavior, not the old visual
target. Screenshot sample numbers/names are not seed data or database fields.

## Navigation shell — `TabBar.jsx`
| Feature | iOS |
|---|---|
| 4-tab bar (Home/Food/Train/Supps) + center quick-add fan | ported (native tab bar; the fan is a native affordance) |
| Quick-add fan → Meal / Water / Dose / Workout | ported |
| Active-workout dot on the Train tab | ported |

## Home — screenshot layout; `HomeTab.jsx` behavior; shared native primitives
| Feature | iOS |
|---|---|
| Header: greeting, date, streak chip → Progress, theme toggle, Coach, Calendar, avatar → Profile | ported |
| Week rail (Mon–Sun, per-day ring + dots), failed/Retry | ported |
| Calorie hero (kcal left, % of goal, eaten) | ported |
| Macro row (protein/carbs/fat vs goal) | ported |
| Today's session card / "no plan" / Start | ported |
| Water card (+8) | ported |
| Supplement stack capsules (tap = toggle taken), LOG, empty state | ported |
| Weight strip (last, delta, inline log) | ported; retain through a coherent secondary Home placement or Progress entry without displacing the screenshot hierarchy |
| Meals-today summary → Food | ported |

## Food — `FoodTab`, `AddFoodModal`, `QuickAddPanel`, `BarcodeScanner`
| Feature | iOS |
|---|---|
| Day view: 4 meal slots, per-slot kcal, add-per-slot, totals | ported |
| Add a food: search → pick → grams/servings → log (`addFoodItem`, checked write, uuid write-back) | ported |
| Food search: custom → local catalogue → OFF (via `api/off` proxy) merged; four-state ladder (ok/partial/none/failed) | ported (source is settled: DATA split, see KNOWN_ISSUES/#22) |
| Barcode scan → OFF product lookup | ported; native camera/barcode capture requiring hardware verification |
| Create custom food (`addCustomFoodDB`, checked) | ported |
| Edit/delete a custom food | **native** correction flow in Food; approved issue to fix, with confirmed row mutation and refreshed catalog |
| Delete a logged item (checked delete, restore on fail) | ported |
| Water strip (+oz presets, reset) | ported (dedupe with Home's water) |
| Nutrition breakdown (fiber/sugar/sodium as reference numbers) | ported (render null as "—", not 0) |

## Train — `WorkoutTab`, `ActiveWorkout`, `CreateWorkoutModal`, `ExercisePreviewList`
| Feature | iOS |
|---|---|
| Today / My Plans / History segmented control, plan chips, + New | screenshot layout with real plans/history and honest empty/failed states |
| Front/back muscle figure, primary/secondary legend, Start card | native using supplied Workout layout; exercise-to-muscle mapping is presentation data, not an invented database field |
| Exercise rows with name, sets/reps/weight and volume | screenshot layout; values derive from the selected real plan/session, never screenshot examples |
| Start workout → live session: tick sets, edit actual reps/weight, timer, live PR banner (`computePRs` vs `exercise_bests`) | ported |
| Finish → save session (checked, uuid write-back, `setsData`) | ported |
| In-progress session survives navigation, process termination and restart | durable per-user native draft; preserve original start day, set edits and assignment origin; native lifecycle alone does not persist it |
| Interrupted save with unknown commit outcome | retain draft and reconcile operation/row identity before retry; no blind duplicate insert |
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
| Progress: avg calories, workouts, supp adherence, weight change, trend chart, calorie bars, heat strip, PRs this month | ported from `daily_summary`/`weight_monthly`/`exercise_pr_events`, plus `supplement_due_from` for absent dates; water read separately |
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
| Onboarding wizard → BMR/TDEE → goals (checked upsert, no onComplete on fail) | **native** screens; shared package ports `src/lib/bodyMetrics.js` against fixed expected outputs |
| Partial-profile recovery; failed-profile protection | **native** profile-first load coordinator; resume existing values and never infer a new account from a failed read |
| Profile edit (goals/name/weight; checked, gated ✓) | **native** |
| Personalization: 12 mode-locked palettes + legacy stored theme resolution | **native**; Pastel initial design, supplied dark Home variant uses the same layout/theme tokens |
| Settings: HealthKit sync, notifications toggle | **native** (HealthKit is a platform reason for the rewrite) |
| Account deletion, including active trainer relationships | **native** pre-launch requirement; coordinated gateway/privacy behavior and real deletion verification |
| Day refresh after midnight/foreground/timezone changes | **native** coordinator; rebuild local date/week reads without losing active workout start day |
| Upgrade / Help pages | v1? (native, low priority) |
| Demo mode | **cut** (a web onboarding shortcut) |

## Trainer (client-facing) — **native**, consented relationship gates
| Feature | iOS |
|---|---|
| Consent/invitation flow (currently web `/trainer-consent`) | **native** entry with agreement review; existing web link may be a validated interim route |
| Assignments, messages, appointments (via `trainerhq-api`, TRAINERHQ_CONTRACT.md) | **native**, through a separate TrainerGateway shared by both apps; empty state is normal without an agreement |
| Trainer assignment origin in personal plans/completed sessions | shared FitDataKit UUID field; preserve through read/edit/finish and verify against the same backend records |

## Native platform delivery

| Feature | iOS home / verification |
|---|---|
| HealthKit reading/writing | Settings consent plus affected Food/Train/Progress screens; define source identity and deduplication before syncing |
| Apple Watch companion and set logging | Shared active-workout experience; define ownership/conflict handling and verify device delivery |
| WidgetKit macros/workout state | Home-screen widget using user-scoped shared state; never show previous account data |
| Reminder notifications | Supps schedule plus Settings permission status; verify delivered notification with the app inactive |

These remain full-product requirements, not completed phase-one deliverables.
Phase one builds their shared data foundation and does not implement screens,
HealthKit, Watch, widgets, notification scheduling or TestFlight delivery.

## Legacy / dead — **cut**
`workouts` table, `water_log.cups`, `body_weight_log.note`, `supplement stack`
reminder web timers, `workout_sessions.prs` column (dead since #28), the USDA
search path (off by design), the coach's six legacy prefix parsers (kept only
until the model stops emitting them).
