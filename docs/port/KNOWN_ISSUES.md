# WiFit — known issues for the port (reimplement / don't / platform gap)

Three buckets. The full, numbered list with detail lives in
`PROJECT_CONTEXT.md` §Known issues; this is the port-relevant triage. **The key
question for each: does the Swift client reimplement it, avoid it, or is it a
platform gap to build properly?**

## A. DO NOT reimplement — these are React-client bugs/limits that die with it

- **#20 double empty state** — the old `AddFoodModal` shows its "no results /
  create" card AND the "search failed" banner together on a failed search. The
  three-state ladder (`searchStatus`: ok/partial/none/failed) is correct; only
  the old modal's rendering is wrong. Build the native search sheet from the
  ladder: failed ≠ none, and never both at once.
- **Web reminder timers** — supplement reminders were `setTimeout` in the open
  tab, which fire only while a tab is alive. Do not port. See #26 below.
- **The workout in-progress snapshot** — a localStorage workaround for the web
  losing state on navigation. Native lifecycle handles this; port the behaviour
  (session survives backgrounding), not the mechanism.
- **The six legacy coach prefix parsers** (`MULTI_FOOD:` etc.) — kept only until
  the model stops emitting them. Swift implements the `ACTIONS:` contract only
  (COACH.md).
- **Demo mode** — a web onboarding shortcut; not a product feature.
- **`select()` collapsing non-2xx to `[]`** — port `selectAuth` and its ladder
  instead wherever "failed vs empty" matters (DATA_LAYER.md). Do not carry the
  swallow forward as the default read.
- **Dead columns/tables**: `workouts` (legacy), `water_log.cups`,
  `body_weight_log.note`, `workout_sessions.prs` (dead since #28) — ignore.

## B. Fixed in the reference — reimplement the FIX, not the original behaviour

These were bugs; the shipped web app fixes them and the Swift client must ship
the fixed behaviour (the tests/decisions are the spec):

- **Decimal, not Double** for macro math (DATA_LAYER.md §4) — the single most
  important correctness item. A Double port silently disagrees with
  `daily_summary`.
- **Checked writes + local-id→uuid write-back + hasDbId-gated mutations**
  (DATA_LAYER.md §6) — the class that let food/workouts "save" into empty tables
  for months.
- **PRs as view reads** (`exercise_bests`, `exercise_pr_events`); the only
  client PR logic is the live in-session banner (DATA_LAYER.md §5).
- **Per-table `on_conflict`** targets (SCHEMA.md) — or same-day writes 409.
- **`localDate` everywhere** for date columns (DATA_LAYER.md §8).
- **Coach: user turn exactly once, applied-action replay, fail-open/closed
  parsing** (COACH.md).
- **selectAuth routing: 401/403 → auth, never onboarding** (a fallback to
  onboarding overwrites a real profile).
- **Session edit/delete = re-read is the state change** (#25), no optimistic
  delete.

## C. Genuine platform gaps — build properly in iOS (the reason for the rewrite)

- **#26 real notifications** — `UNUserNotificationCenter`. Supplement/water/
  workout reminders that fire when the app is backgrounded. The web literally
  cannot; this is a launch feature, not a port.
- **HealthKit** — read/write the system health store (weight, workouts,
  nutrition, active energy). The `HealthSyncSection` in the web app is a stub.
- **Apple Watch** — companion app; log sets from the wrist.
- **WidgetKit** — home-screen macros / workout state.

## D. Pre-launch, App-Review blockers (not code to port — do before shipping)

- **#31 privacy label** — disclose health data shared with a third party (a
  trainer, via TrainerHQ) on the user's consent; privacy manifest + nutrition
  label must list the consent scopes (TRAINERHQ_CONTRACT.md).
- **#32 account deletion with an active trainer relationship** — revoke+notify or
  block; do not orphan the trainer's access. Account deletion is itself required.
- **#5 custom-food edit/delete** — create-only today; a v1 decision, not a
  blocker, but surface it.

## Open, deferred, harmless (leave logged)
- **#22 restaurant/menu foods** — no structured source (OFF is packaged goods);
  a custom food or a coach estimate. Branded/long-tail now work via `api/off`.
- **#21 USDA off by design** — the proxy and honest failed-search UI are kept;
  flip `USDA_ENABLED` or point the proxy elsewhere to re-enable.
- Cosmetics logged in PROJECT_CONTEXT that "die with the React client" — do not
  spend port effort on them.
