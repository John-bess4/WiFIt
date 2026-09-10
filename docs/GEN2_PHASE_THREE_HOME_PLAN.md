# Phase three — Home and its working entry points

Prepared from the current Phase Two worktree on 2026-09-09 Pacific. This is an
implementation plan, not evidence that Home is built. The user authorized
continuing after Phase Two is finished and checked; no new phase approval is
needed. Phase Two's actual auth, profile, lifecycle and QA acceptance remains
the prerequisite.

## Layout and theme

Use [the supplied Home layout](../design-reference/screenshots/home-layout.png)
for section order and proportions: compact greeting/actions, seven-day rail,
large semicircle calorie hero, three macros, workout card, water, supplement
capsules, meals, and a bottom bar with a raised quick-add button. The bar belongs
to the app shell and uses the real safe-area inset; scrolling content cannot
disappear under it. The system supplies the status bar and home indicator.

All ten [updated theme references](../design-reference/updated-themes/README.md)
were visually inspected. Carry their native gradient/ribbon backgrounds, fine
edges and translucent surfaces into the existing Cotton Candy, Purple, Rose,
Aqua and Teal light/dark tokens. Keep one component hierarchy across themes.
The Rose examples move the hero to one side and some Purple/Teal examples
replace Supps with More; these are palette concepts, not a reason to introduce
different navigation trees. Preserve Home/Food/Train/Supps and the centered plus
from the approved layout. Use readable text contrast rather than copying faint
sample captions literally.

The example numbers and images are not data. Reconcile these differences
explicitly in implementation and screenshots:

- `790 / 2,200` is **36% eaten**, with **1,410 kcal left**. Match the shipped
  consumed-progress arc and label the percentage as eaten; the sample's 64%
  corresponds to remaining calories. Do not display contradictory arithmetic.
- The current product water goal is **128 oz**, from `GOAL_OZ`, not the sample's
  80. Keep 128 unless a subsequent product change establishes a shared setting.
- Omit burned calories until an authorized, verified source exists. Neither
  workout duration nor TDEE is calories burned. Center the Eaten footer in the
  available space, as the shipped Home does.
- A plan has a weekday and optional duration estimate, but no scheduled clock
  time. Do not invent “6:00 PM.” Meal rows have no meal-consumed timestamp or
  photo. Omit sample times/photos; `created_at` is insertion metadata. Additional
  rows are “more logged,” never “more planned.”

## Exact data mapping

Read the existing `ResourceState.payload` only with its account/day context and
freshness state. `ResourcePayload.count` is not the underlying data. The
coordinator's verified `ProfileRow` supplies `name`, `createdAt`, `calGoal`,
`proteinGoal`, `carbsGoal` and `fatGoal`; no Home defaults overwrite that row.

| Home section | Typed source and actual columns | Projection and failure behavior |
|---|---|---|
| Greeting and avatar | `ProfileRow.name`, `createdAt`; device time in `LoadContext.timeZoneIdentifier` | First nonempty name component and initial; morning/afternoon/evening and displayed date update on lifecycle/time changes. Avatar opens real account details, theme and sign-out controls. |
| Hero and macro totals | `.dailySummary([DailySummaryRow])`: `userID → user_id`, `day`, `kcal`, `proteinG → protein_g`, `carbsG → carbs_g`, `fatG → fat_g`, `foodRows → food_rows` | Select today's unique row. Persisted macro totals come from the SQL view, not a rebuilt client aggregate. Remaining is `max(0, goal − kcal)`; clamp the arc to 0…1 and expose overshoot in text. Missing/malformed required values are unavailable. |
| Week rail and food streak | Same daily rows: `day`, `kcal`, `foodRows`, `workoutCount → workout_count`, `suppsTaken → supps_taken`, `suppsDue → supps_due`; `.supplementDueFrom([SupplementDueFromRow])`: `supplementID → supplement_id`, `dueFrom → due_from` | Build a Gregorian Monday–Sunday spine in the user's timezone. Use `foodRows > 0` for logging, including known zero-calorie entries. A failed view is unknown, not seven empty days. Use the due-start view for absent-day supplement denominators. |
| Today's workout | `.workoutPlans([WorkoutPlanRow])`: `id`, `name`, `tag`, `estMin → est_min`, `scheduledDay → scheduled_day`, `sortOrder → sort_order`, `exercises`, `trainerAssignmentID → trainer_assignment_id` | Sort deterministically by order then UUID. Prefer today's full English weekday; otherwise show the first plan as “Suggested,” not scheduled today. Normalize with `PlanNormalizer`; derive counts/chips only from valid content. Preserve assignment origin. Failed plans do not seed a demo workout. |
| Workout readiness/history | `.workoutSessions([WorkoutSessionRow])`: `id`, `completedDate → completed_date`, `workoutName → workout_name`, `setsCompleted → sets_completed`, `totalSets → total_sets`, `durationSecs → duration_secs`, `exercises`, `trainerAssignmentID → trainer_assignment_id`; `.exerciseBests([ExerciseBestRow])`: `userID → user_id`, `name`, `bestLbs → best_lbs`; `.exercisePREvents([ExercisePREventRow])`: `userID → user_id`, `sessionID → session_id`, `completedDate → completed_date`, `name`, `lbs`, `prevBest → prev_best` | Starting eventually requires verified plans/history/bests and a durable workout draft. Historical PRs use the view, never a capped history scan or stored `prs`. A read-only workout detail can ship before the active-session feature, with an accurately named “View workout” action. |
| Water | `.waterLog([WaterLogRow])`: `id`, `userID → user_id`, `logDate → log_date`, `oz` | At most one matching row; successful absence means 0 oz. Ignore legacy `cups`. Failed/stale water blocks replacement writes and shows Retry. Preserve values above goal; clamp only the visual fill. |
| Supplement stack | `.supplementStack([SupplementStackRow])`: `id`, `name`, `sub`, `sortOrder → sort_order`, `reminderEnabled → reminder_enabled`, `reminderTime → reminder_time`, `createdAt → created_at`; today's `.supplementLog([SupplementLogRow])`: `id`, `supplementID → supplement_id`, `logDate → log_date`, `taken` | Join by UUID, not name; use current stack IDs only. Up to five capsules in Home, all entries in the stack sheet. `taken == true` counts as taken; a present null status is unknown rather than a confidently unchecked toggle. Distinguish zero supplements from failed loading. |
| Meals today | `.foodLog([FoodLogRow])`: `id`, `loggedDate → logged_date`, `mealSlot → meal_slot`, `foodName → food_name`, `brand`, `grams`, `per100Cal → per100_cal`, `per100Protein → per100_protein`, `per100Carbs → per100_carbs`, `per100Fat → per100_fat` | Group breakfast/lunch/dinner/snacks with deterministic row order; show first two and an actual remaining count. Each row uses shared `Nutrition.calculate(FoodPortion)` with Decimal and nil as “—”. SQL supplies the saved daily total; per-row calculations explain individual items. Unknown meal slots remain visible in an additional group. |
| Weight quick action | `.bodyWeightLog([BodyWeightLogRow])`: `id`, `logDate → log_date`, `weightLbs → weight_lbs` | Sort explicitly by local day; show latest/previous values only after a successful read. Retain the shipped weight capability in quick-add/account detail without inserting an extra card between the screenshot's stack and meals. |

View model optionals reflect catalog nullability, not permission to coalesce
invalid row keys or numbers into a valid empty state. A successful absent
`daily_summary` row means no food/workout/supplement-log/weight record for that
day; water-only days are absent by design. For today's zero-food presentation,
also require the successful food read to agree. If independent reads disagree
after a mutation, refresh the view and mark totals updating/unavailable until
they reconcile; never silently substitute a different aggregate.

Keep the shipped ±10% on-target rule, requiring a logged food row and positive
goal. Evaluate historical days against the current profile goal and disclose
that basis in day detail; no historical-goal column exists. Exclude future and
pre-account days from the denominator. Convert `ProfileRow.createdAt` as a UTC
timestamp to the user's local day, not an ISO substring. If creation metadata
cannot be parsed, show limited coverage rather than inventing an account date.

The current service reads all daily summaries with pagination. A real streak
must walk successful all-history food days backward across week boundaries,
ending yesterday and including today only when logged. Do not reuse the old
seven-day helper's truncated streak as an all-time value. A missing intervening
day breaks the streak; unavailable history hides it with an explanation.

## Actions and dependency gaps

Implement a small `HomeProjection` in WiFitAppCore and focused SwiftUI cards;
keep HTTP, checked writes and normalization in the existing layers. The current
`AppService` exposes reads and profile writes only. Before wiring Home controls,
add explicit water/supplement/weight methods, mutation state and reconciliation
to that service/coordinator. Views must not construct a second REST client.

| Entry point | Working behavior for this phase | Required contract |
|---|---|---|
| Water +8 / water quick action | Serialize taps for the current account/day. Re-read current water before calculating the next cumulative total; perform a checked upsert and re-read it. On reaching goal, say so without reducing an existing higher total. | `WaterLogWrite(userID, logDate, oz)`, conflict `user_id,log_date`; no UUID in upsert body. A timeout/5xx is outcome-unknown: reconcile before another tap. Read-modify-write remains non-atomic across devices; do not claim atomic increments without an explicit server change. |
| Capsule / Log | Toggle one successfully loaded, current-user stack UUID; show pending state for that capsule, then adopt returned identity and re-read status/summary. Log opens the complete current stack sheet. | `SupplementLogWrite(userID, supplementID, logDate, taken)`, conflict `supplement_id,log_date`. Require both stack and log readiness. Block ambiguous/null entries until re-read or deliberate correction. |
| Empty supplement stack | A small Add Supplement form accepts a name and optional dose description, saves a checked `SupplementStackWrite`, then re-reads stack and due-start data. | No invented inventory, dosage advice or enabled reminder scheduling. Full stack editing, scheduling and notifications remain the Supplements phase. |
| Weight | Present numeric pounds entry, validate, save and re-read today's row. Retain the entry on failure. | `BodyWeightLogWrite`, conflict `user_id,log_date`; refresh weight rows, daily summary and monthly view after confirmed success. |
| Week date / calendar icon | Open an actual selected-day summary sheet using the same view/date spine, with available calories, workouts, supplements and weight. Future, pre-account, unknown and empty have distinct states. | Do not show historical water from today's `.waterLog`; a water range read is a later addition if that section is offered. |
| Meals / more logged | Open the complete today's-meals list and a real per-row nutrition detail. | Keep list identity as database UUID. Food logging, search, barcode, meal creation and edit/delete remain explicit Food-phase work; no enabled “Log food” button with an empty destination. |
| Workout card | Open the real normalized selected plan; when no plans exist, show that honest empty state. | Use “View workout” while the active-session flow is absent. An enabled “Start” is allowed only after durable per-user drafts, restore, finish/save and required read gates are implemented and verified. This is a recorded Home fidelity boundary until the Train phase lands. |
| Bottom tabs and raised plus | Home is the full screen; Food, Train and Supps open the corresponding working list/detail surfaces above. Plus opens only implemented water, weight and supplement actions. | No tap merely closes the menu, produces a success toast, or opens a generic placeholder. Add the remaining quick actions as their actual flows land. |

The supplement-parent ownership fix is currently a separate proposal, not a
verified applied constraint. Do not imply the server rejects every cross-owner
parent reference. Limit Home commands to validated current-user stack IDs,
keep the fix's deployment/recovery gate visible in engineering acceptance,
and rerun real-JWT rejection checks once the approved migration is applied.

After any successful mutation, invalidate and refresh exactly its dependent
sources before showing success as current truth. If refresh fails, retain
confirmed data with a freshness warning and disable dependent replacement
writes. Carry account/day generation through the request and response; a late
write must not redraw a different account or a new local day. Theme selection
stays an appearance preference, not an implicit profile mutation.

## Build order and proof

1. Finish Phase Two verification. Add Home projection tests against literal
   typed fixtures: SQL totals, unknown nutrients, empty versus failed, duplicate
   day/ID rejection, over-goal values, Monday/Sunday and year boundaries, local
   midnight/DST/timezone changes, signup near UTC midnight, long streaks, nullable
   statuses, missing due-start metadata and assigned-plan normalization.
2. Build the native shell and read-only cards from those projections. Capture
   Home in all ten theme variants with clearly synthetic fixtures; compare
   against the supplied layouts while recording the intentional data differences
   above. Verify compact and large iPhones, safe areas, scrolling, Dynamic Type,
   VoiceOver names/values, Reduce Motion and Reduce Transparency. Use semantic
   text where tiny sample captions cannot remain readable.
3. Add checked water, supplement and weight actions with targeted service tests:
   rapid taps, failed prerequisite reads, zero-row writes, 401 once/403 no
   refresh, post-send unknown outcomes, failed re-read, duplicate conflict UUID
   preservation, sign-out while pending and a local-day change while saving.
   Test that every enabled navigation/quick action reaches a working destination.
4. Run native UI flows through the real coordinator and transport. With the
   dedicated QA accounts, read the starting rows, perform each mutation, re-read
   the exact row and dependent view, then restore/remove only those QA fixtures.
   Capture request/status evidence without credentials or health-row dumps.
   Offline and server-failure demonstrations must preserve drafts and show the
   correct Retry/write-blocking state. Mock tests are not substitutes for this.
5. Run package tests and the native build; run existing web lint/tests/build
   before pushing through the production-build hook. Record simulator model,
   runtime, screenshot paths, verified flows and unresolved device/live-account
   limits. A physical-device check remains required for OLED gradients, touch
   targets and safe-area behavior. Keep production deployment and TestFlight
   behind their established release gates.

Home is complete for this phase only when the cards use real typed payloads,
its implemented actions persist and reconcile, failures are honest and the
theme/layout checks pass. This milestone does not claim Food/Train/Supplements
feature parity, HealthKit calories, real reminders, TrainerHQ native adoption
or TestFlight delivery. The explicit remaining action boundaries above must be
removed by their respective later phases before the full app is called complete.
