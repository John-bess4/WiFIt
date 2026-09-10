# WiFit and TrainerHQ — shared Swift data contract

Reconciled for the approved Gen 2 phase one on 2026-09-10. This specifies the
Swift API, not a change to the legacy React `sb` wrapper. WiFit and TrainerHQ
are sister apps using Supabase project `vghqqksbjpgdzmvfmnru`. Shared row
shapes, arithmetic, dates, auth transport and view reads have one implementation.

The package is `Packages/FitDataKit`, with one library product,
`FitDataKit`. Both iOS apps are intended to use the same local package path.
The TrainerHQ iOS project is absent here; creating this package does not prove
TrainerHQ adoption. Cross-app integration remains an acceptance gate.

See [SCHEMA.md](SCHEMA.md), [RLS.md](RLS.md), and the scope and verification
record in [GEN2_PHASE_ONE.md](../GEN2_PHASE_ONE.md).

## 1. Typed failures and checked writes

Use Foundation REST requests over PostgREST and GoTrue; no third-party Supabase
SDK. Public operations are typed `async throws` APIs.

| Operation | Successful result | Failure |
|---|---|---|
| Select | Decoded row array, including actual empty arrays | Typed transport, HTTP, auth, decoding or validation error |
| Single insert / upsert | One decoded persisted row | Error for non-2xx, unreadable body, zero or unexpected row count |
| Single-row update | One decoded persisted row | Error if the intended row was not returned |
| Single-row delete | Verified deleted-row representation | Error if the intended row was not returned |

There is no Swift `selectAuth` sibling and no failure-to-`[]` conversion.
A successful empty read is data; an unavailable read is an error. Optional
nutrients describe missing data, not a network failure.

Preserve operation, resource, status and PostgREST error code where available.
Diagnostics must identify failures without logging tokens, credentials, row
bodies or health data. Request returned representations for mutations: a 2xx
with no matching row can mean RLS hid it, it was already deleted, or the filter
was wrong. It does not prove the requested change happened. Use verified UUID
and owner filters and retain returned UUIDs before enabling another mutation.
Do not mark mutation results `@discardableResult`.

A connection loss after sending a write may leave its commit outcome unknown.
Do not blindly repeat inserts on timeout, cancellation, dropped connection or
5xx. Preserve the draft/pending action and reconcile using a stable operation
identity or targeted read before offering retry. The one auth retry (§7) follows
a received 401, not an uncertain network result. Trainer gateway commands may
reuse their documented `operation_id`; that guarantee does not apply to plain
PostgREST inserts.

## 2. App-side load sequence and treatment ladder

FitDataKit supplies data and errors. The app coordinator owns loading, freshness,
write blocking, Retry and navigation.

1. Resolve the session before data reads.
2. Read the profile before parallel feature loads. Successful absence may lead
   to onboarding. An existing partial profile needs a completion flow preserving
   stored values, never a blank form that overwrites the row.
3. Profile failures stay failures. Auth loss/denial goes to auth recovery; a
   server, decoding or connectivity failure never routes to onboarding. A 403
   never triggers token refresh.
4. After the profile gate succeeds, load independent sections and track each
   section's success/failure. Failed reads never seed records.

| Read | Required app response to failure |
|---|---|
| Calendar, Progress, Train history, Profile | Refuse replacement zeros/blank editable values; identify the section and offer Retry |
| Home week rail | Retain verified values if available; distinguish failure from a genuinely empty range |
| Water total, supplement status, plans, other reads backing replacement writes | Block dependent writes until successfully loaded; +8 on unknown water must not replace the day |
| Independent additive sections | Retain valid state and name the unavailable section |
| Profile routing | Auth recovery for auth failure; onboarding only after confirmed successful absence |
| Workout Start / PR baseline | Pause Start when required history/bests failed; no invented empty baseline |

Retry affected reads and dependents. Scope app state and in-flight work by
user/session generation so an old response cannot populate a new account.
Recompute today's day and refresh relevant data at midnight, foregrounding and
timezone change.

## 3. Conflict targets

| Table | Upsert `on_conflict` |
|---|---|
| `profiles` | `id` |
| `water_log` | `user_id,log_date` |
| `body_weight_log` | `user_id,log_date` |
| `supplement_log` | `supplement_id,log_date` |

The supplement target has no `user_id`. Other creates are plain inserts.
Conflict targets do not replace ownership checks. Water stores cumulative
ounces, not tap deltas. Same-day uniqueness does not make read-modify-write
increments atomic; serialize local actions and reconcile across clients.

## 4. Decimal nutrition

Use `Decimal` from decoding/input parsing onward, never convert through
`Double`. Scale as `round(per100 × grams / 100)` using
**round-half-away-from-zero**, including negative ties, matching Postgres
`numeric`. Do not use bankers' rounding. `32.3 × 500 / 100 = 161.5 → 162`.
Totals sum individually rounded rows, not a single rounded sum of products.

Use the shared helper for scaling, totals, per-100 conversion and serving mass.
Calories/protein/carbs/fat use the view's integer per-row rounding. The view has
no fiber/sugar/sodium fields: shared row-level scaling retains the existing
tenths for fiber/sugar and whole units for sodium. These extra-nutrient rules
must not be used to rebuild the four authoritative daily macro fields.
Reject non-finite values and invalid denominators. Food logging requires
positive finite grams and documented input limits. The database has no
positive-grams CHECK; numeric zero is not guaranteed to produce an error.

Nullable nutrients remain nullable in row-level/storage representations and
render as "—". They may contribute zero under the documented total rule without
becoming known zero in the source row. `food_log.per100_sugar` defaults to null;
`custom_foods.per100_sugar` defaults to zero, so explicitly send null for unknown.

Run all 29 Postgres-generated [rounding fixtures](rounding-fixture.json), plus
negative ties, round-each-row-before-sum, null handling and invalid input cases.

## 5. Five authoritative views

Read these with the user's JWT and existing RLS. Do not reconstruct them from
truncated histories or store derived PR flags.

| View | Supplies |
|---|---|
| `exercise_bests` | All-history positive-weight maximum per exercise name |
| `exercise_pr_events` | Strict improvement over an earlier recorded session |
| `daily_summary` | Calories, protein/carbs/fat, food/workout counts, supplement numerator/denominator, weight |
| `supplement_due_from` | Due-start dates, including for days absent from the daily view |
| `weight_monthly` | First/last weigh-in and count per month |

[SCHEMA.md](SCHEMA.md) contains actual definitions and column types.
`daily_summary` has rows for days with food, workouts, supplement logs or weight.
**Water-only days are absent.** No water, fiber, sugar, sodium, burned-calorie,
goal or on-target columns exist in that view. Read water directly from
`water_log`. Use shared Decimal helpers for per-food previews and nutrients
the view does not expose, over successful row reads; do not call these server
daily-summary fields. Date spines/adherence on absent days require successful
`supplement_due_from` reads. Failed sources remain unavailable.

The deliberate client PR calculation is the live unsaved-session banner:
compare final current sets with a successfully loaded `exercise_bests`
baseline. Only positive weight strictly above an existing best is a PR.
First-ever lifts and equal weights do not qualify. Save numeric sets, then
re-read both PR views after insert/edit/delete.

Both exercise views assume numeric weights inside valid `setsData` JSON.
Swift normalization cannot repair server data or guarantee that view evaluation
succeeds on malformed rows. Surface the view error; repair is a separate,
verified data/schema change.

## 6. Identity, session JSON and durable drafts

Use `UUID` for persisted IDs, distinct from pending local/display identity.
Keep the returned database UUID before permitting edits/deletes.
`profiles.id` is the authenticated user's UUID.

Preserve nullable `trainer_assignment_id` on plans/sessions through reads and
edits. Carry a trainer-origin plan's validated assignment into its completed
session; standalone workouts use null. Composite foreign keys require the
assignment to belong to that client. Never invent or discard assignment origin.

Normalize sessions at the read boundary. `setsData` is authoritative numeric
data; `sets` is a derived equal-length label array. Legacy label-only data uses
a tested compatibility parser. Malformed entries must not crash a tab, and
discarded content must remain diagnosable. Plan exercise UUIDs remain stable
through editing. Session edits preserve owner, date and assignment origin and
re-read server-derived views.

Durable workout drafts are **app-side work**, not something native lifecycle
solves automatically. Persist per-user drafts, original start timestamp/day,
sets, assignment origin and pending save identity to disk. Verify restoration
after actual process termination. Clear only after a confirmed save or explicit
discard. Sign-out/account changes must never expose another user's workout/chat.

## 7. Auth and Keychain

- Read the bearer at request time. Resolve the cached session before data loads,
  using a 60-second expiry skew.
- On received **401 only**, refresh once and retry once. Never refresh on 403,
  generic errors or network timeouts.
- Coalesce refreshes. Compare the failed request's token with the current token;
  another request may already have rotated it.
- Distinguish absent/revoked credentials from transient refresh failure. An
  outage must not silently erase recoverable credentials or imply no profile.
- Reject late refresh results after logout/account replacement so an old session
  cannot be resurrected.
- Store tokens in Keychain, never UserDefaults or source. Cache the active
  session in memory. Each app has its own Keychain identity; a common database
  is not implicit single sign-on.
- Route auth recovery app-side, preserving user-scoped drafts.

Injected transport/store tests prove concurrency and error semantics. They do
not prove real Keychain entitlements, live token rotation, user-JWT RLS, or auth UI.

## 8. Local dates

Every `*_date` is a Gregorian `YYYY-MM-DD` local day, independent of display
locale/calendar. Use the user's timezone, not UTC ISO components. Send dates
explicitly; database `CURRENT_DATE` defaults use the database session timezone.

A workout belongs to its original start day, not finish time or app-mount
"today". Preserve that day with its durable draft across restart/timezone changes.
Test midnight, DST, positive/negative UTC offsets and invalid dates.

`supplement_due_from` currently casts `created_at::date` in the database
session timezone. Read its result as authoritative; changing that rule requires
a coordinated database decision, not a different calculation in one app.

## 9. Body metrics

Port `src/lib/bodyMetrics.js` once with fixed input/output fixtures. These are
existing product estimates, not a new medical model.

- BMR (Revised Harris-Benedict): male
  `13.397·kg + 4.799·cm − 5.677·age + 88.362`; female
  `9.247·kg + 3.098·cm − 4.330·age + 447.593`.
- Convert `lb × 0.453592` and `in × 2.54`; UI defaults remain app-side.
- TDEE is `round(BMR × activity multiplier)`; unknown activity uses 1.55.
  Preserve the existing seven activity IDs/multipliers.
- Calorie target `max(tdee + rateDelta, 1200)`; preserve goal rate IDs/deltas.
- Protein `round(lb × 0.82)`, fat `round(cal × 0.25 / 9)`, carbs
  `max(round((cal − 4·protein − 9·fat) / 4), 50)`.

Test all activity/rate choices, conversion, fallback and floors. Expected
values must not reuse the production constants they are intended to test.

## 10. Ownership boundary

| FitDataKit | App / separate module |
|---|---|
| REST transport/errors, conflict targets, checked responses | Profile-first coordinator, failure ladder, freshness and Retry |
| Session engine and Keychain token store | Auth screens, onboarding completion, navigation |
| Table DTOs, UUID identity, session normalization | Durable workout/chat store, pending-save reconciliation |
| Decimal nutrition, body metrics, local dates | SwiftUI screens, themes and primitives |
| Five view DTOs, live PR arithmetic | HealthKit, Watch, WidgetKit, notifications |

`TrainerGateway` is a separate module usable by **both** apps. WiFit consent,
assignment and client screens need it too. It may consume FitDataKit's session
provider/models, but trainer commands, consent scopes and attachment DTOs stay
outside core FitDataKit. Verify command-specific payload/response schemas first:
[TRAINERHQ_CONTRACT.md](../TRAINERHQ_CONTRACT.md) lists actions but is not a
complete typed command specification.

A shared database does not bypass consent or permit privileged client keys.
Personal REST reads use the caller's JWT; trainer relationships and permitted
cross-client data use the gateway authorization contract.

Coach conversation/request assembly, action confirmation and replay stay
app-side; the pinned model and secret remain in the Vercel proxy. Expo is not a
second implementation: the approved port is SwiftUI and one shared Swift layer.
