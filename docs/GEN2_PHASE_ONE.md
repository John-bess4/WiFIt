# Gen 2 phase one — shared data foundation

Approved by the user on 2026-09-09 after the initial investigation. The user
confirmed that WiFit and TrainerHQ are sister apps and must stay aligned on the
same database contract, authorized the recommended fixes, and supplied Home and
Workout screenshots as the design authority. The implementation remains native
SwiftUI; selecting Expo tools does not introduce a parallel JavaScript client.

This record distinguishes the approved contract from implementation and
integration evidence. Unit tests or a package build alone cannot establish a
working iOS application, TrainerHQ adoption, authenticated RLS, visual fidelity,
or TestFlight availability.

## Accepted decisions

| Problem found | Chosen resolution |
|---|---|
| Old data spec copied React's silent failures | Swift async throwing operations; successful empty reads differ from failures; mutations require returned/verified rows |
| Two sister apps risk separate logic | One `Packages/FitDataKit` library for shared DTOs, transport/auth, arithmetic, dates, identity and view models |
| Presentation policy was placed inside the package | Profile-first loading, no-seed guards, write blocking, Retry and routing stay in the app coordinator |
| Four-view proposal omitted due dates | Model/read all five views, including `supplement_due_from` |
| Summary described as every day with any data | Document actual food/workout/supplement/weight day union; read water separately and preserve unsupported-nutrient handling |
| Rounding prose conflicted | Decimal from parse/decode onward; Postgres round-half-away-from-zero and round each row before sum |
| Stored partial profiles can be mistaken for new users | Explicit app-side profile completion preserving existing values; failed reads never trigger onboarding |
| Native lifecycle was mistaken for persistence | Durable per-user workout/chat storage and save reconciliation are required app work |
| Interrupted writes can duplicate data | No blanket retry on unknown write outcomes; retain pending identity and reconcile before repeating |
| Trainer gateway was described as TrainerHQ-only | Separate `TrainerGateway` usable by both apps, retaining existing consent and authorization |
| Bundle/Claude messages contradicted visuals | Supplied Home and Workout PNGs win on layout; coherent native design elsewhere |
| Schema reference lacked types/definitions | Rebuild the WiFit catalog reference from read-only live metadata without DDL |
| Log-row RLS does not bind supplement parent ownership | Prepare an additive parent unique/composite-FK proposal; existing schema remains unchanged until verified rollout |

The data contract is in [port/DATA_LAYER.md](port/DATA_LAYER.md). Exact live
columns/constraints/view definitions are in [port/SCHEMA.md](port/SCHEMA.md).
The feature map is [port/FEATURE_INVENTORY.md](port/FEATURE_INVENTORY.md), and
visual authority is [design-reference/README.md](../design-reference/README.md).

## Phase-one deliverables

- One local FitDataKit Swift package/product with no Supabase SDK dependency.
- Typed REST transport and failure categories; table-specific conflicts and
  checked single-row mutation responses.
- Session resolution/refresh engine with injected transport/store, coalesced
  401 refresh, once-only retry and Keychain credential storage.
- Row/write/view DTOs with exact snake-case wire keys, nullable numerics,
  validated UUID identities and preserved trainer assignment origin.
- Workout plan/session normalization and live PR calculation.
- Decimal nutrition, local Gregorian day handling and body-metric formulas
  with discriminating fixed fixtures and negative cases.
- Reconciled contract/schema/design documentation and recorded validation.

The package deliberately does not route screens, seed records, implement
TrainerHQ commands, use privileged server keys or alter the production schema.
Those boundaries protect a single shared contract; they do not reduce the
full native-product requirements.

## Verification plan and evidence limits

| Check | Required evidence | What it cannot prove |
|---|---|---|
| Decimal scaling | All original Postgres fixtures, negative ties, per-row rounding before sum, unknown nutrients, invalid inputs | Correct live read/write wiring |
| Body metrics | Static expected values covering activities/rates, conversion, fallback and floors; expectations independent of production constants | Clinical suitability or product goal choices |
| Local dates | Strict date round trips, invalid dates, DST and midnight in both UTC directions | The app actually refreshes on foreground/timezone change |
| Transport | 200-empty vs HTTP failures, malformed JSON, exact conflict/header/body/filter checks, empty mutation responses, no blind timeout retry | A row persisted remotely |
| Auth | Concurrent/staggered 401s, one refresh/retry, 403 no refresh, transient vs revoked failure, logout/account-change race | Real GoTrue rotation and Keychain app entitlements |
| Models and sessions | Null decoding, assignment UUIDs, malformed/legacy workout JSON, numeric-authoritative labels, first-lift/equal-weight no PR | Server views succeed for every historical row |
| Swift build/test | `swift test --package-path Packages/FitDataKit` plus supported Apple-platform build | An Xcode app exists or both sister apps depend on the package |
| Existing web regression | `npm run lint`, `npm test`, `npm run build` before any push | Browser/runtime/database integration |
| Live catalog | Scoped `information_schema`, constraints, view definitions, RLS/options/grants | User-JWT isolation or consent enforcement |

During this phase's documentation reconciliation, read-only live queries
confirmed 112 columns across the 11 WiFit tables, 30 columns across all five
views, and 28 PK/FK/unique constraints. All 11 tables had RLS enabled; all five
views had `security_invoker=true`. No CHECK constraints existed on those tables,
including food grams positivity. `daily_summary` excludes water-only days and
returns integer macro/count columns. Queries are reproduced in
[port/SCHEMA.md](port/SCHEMA.md). These are metadata observations, not user data
or live mutation tests.

Final local execution on 2026-09-10 UTC (2026-09-09 Pacific):

- `bash scripts/test-fitdatakit.sh`: **68 passed, 1 explicitly skipped**.
  The 68 comprise 42 XCTest cases and 26 Swift Testing cases. The skipped case
  is the real user-JWT/PostgREST test, awaiting two dedicated QA accounts.
- The same script built the library for generic iOS Simulator and cross-compiled
  against the watchOS Simulator SDK. No signed app or watch runtime was launched.
- Real macOS Keychain insert/read/update/delete and service isolation passed
  using unique synthetic credentials, with verified cleanup and no prompts.
  This needed normal host access: the agent's restricted sandbox returned
  OSStatus -50. Signed iOS entitlements/locked-device behavior remain untested.
- `npm test`: **201 passed**; `npm run lint`: **0 errors, 22 existing warnings**;
  `npm run build`: **passed**. The ErrorBoundary test intentionally emits a
  caught rendering exception. Swift's macOS no-prompt Keychain test emits three
  deprecation warnings from test-only interaction-control APIs.

Coverage includes the 29 Postgres rounding cases, 196 fixed body-metric
expectations, strict local days, unknown nutrients, malformed sessions,
concurrent refresh and storage failure races, wrong mutation-owner/conflict
acknowledgements, unknown save outcomes and malformed/duplicate pagination.
Full returned rows must match their owner, UUID and upsert conflict keys before
success; the new negative tests reject wrong profile IDs, dates and parents.

Reproduce with [the package's instructions](../Packages/FitDataKit/README.md).
Swift auth, native UI, RLS and cross-app flows must be verified at the scope they
claim to cover. A fake transport that always succeeds is not an integration test.

## Executed database contract and open finding

On 2026-09-10, the exact
[supabase/tests/fitdatakit_contract.sql](../supabase/tests/fitdatakit_contract.sql)
ran against `vghqqksbjpgdzmvfmnru`. It returned **156 assertions / 156 expected**,
and verified that both synthetic auth users, all synthetic base-table rows and
all synthetic view results were absent after deliberate rollback. It exercised
real fixture users A/B under `SET LOCAL ROLE authenticated`/`anon` with request
claims: normal writes, repeated-upsert UUIDs, owner spoofing, zero-row forbidden
updates/deletes, view isolation, usage immutability, Decimal rounding and PR
edit/delete recalculation. No production DDL or committed fixture data resulted.

Its separate **`supplement_parent_owner_enforced=false`** diagnostic is a
confirmed finding, not a passed isolation assertion. User A could insert an
A-owned supplement log referencing B's actual supplement-stack UUID. The log's
owner RLS passes while the existing FK only checks the parent's ID. This can
create an inconsistent parent link and occupy the supplement/date conflict key;
it does not establish that A can read B's stack. The probe row itself was rolled
back. The test does not exercise GoTrue, validate a live JWT, call PostgREST or
prove Swift app authentication.

### Concrete additive proposal — not applied

The exact proposal was exercised on 2026-09-10 by
[supplement_parent_ownership.mjs](../supabase/tests/supplement_parent_ownership.mjs)
using **Node 22.23.1 and PGlite 0.5.8: 20/20 behavioral checks passed**. The
isolated baseline reproduces the two supplement tables' relevant UUID/FK/unique
constraints with synthetic auth IDs. It verifies successful validated constraint
creation, unchanged daily upsert key/UUID, foreign-parent insert/update rejection
with `23503`, parent cascade, rejection of reapplication, and a pre-existing
owner mismatch aborting before any new constraint while preserving all rows.
The runner loads this exact proposal file and takes the PGlite module path as
its sole CLI argument; its dependency is outside the app package. Reproduce from
the repository root with a Node 22 executable:

```sh
/Users/johnbessemer/.nvm/versions/node/v22.23.1/bin/node supabase/tests/supplement_parent_ownership.mjs /private/tmp/wifit-postgres-contract-check/node_modules/@electric-sql/pglite/dist/index.js
```

This is an **isolated minimal-schema test**, not a full project clone, policy/
trigger replay, concurrency/load test, live JWT test or production deployment.
It does not establish a current restorable backup or close the live ownership gap.

[supabase/proposals/supplement_parent_ownership.sql](../supabase/proposals/supplement_parent_ownership.sql)
adds parent `UNIQUE (id,user_id)` and child
`FOREIGN KEY (supplement_id,user_id) REFERENCES supplement_stack(id,user_id)
ON DELETE CASCADE`. This makes the shared database enforce parent ownership for
both sister apps and the existing web client. All four columns are already
NOT NULL UUIDs. The old single-column FK and
`UNIQUE (supplement_id,log_date)` remain, preserving same-owner writes, daily
upsert identities and cascade deletion. A package-only parent check would not
protect other clients or eliminate a concurrent-change race.

The proposal locks only the two WiFit supplement tables during its transaction,
reports count-only missing-parent/mismatched-owner totals, and raises before any
DDL if either count is nonzero. It neither deletes nor reassigns existing data.
If counts are nonzero, investigate ownership with the owner before a separate
correction; do not add a data-cleanup clause to make this migration pass.

Before rollout, record a **current successful backup/recovery point** for this
project and validate the exact proposal on an isolated copy, including the
rejection of mismatched existing data. This phase has not established a current
restorable backup; the historical disposable-data waiver is not that evidence.
Convert the reviewed SQL to a migration through the normal migration workflow.
After application, rerun the rollback contract and require both **156/156** and
**`supplement_parent_owner_enforced=true`**, plus verified cleanup. Then exercise
the same-owner upsert/cascade paths through both apps and update the schema
references in the same migration commit. The proposal has not been applied and
the ownership gap remains open.

## Work carried into the next phases

| Work | Required next step / acceptance evidence |
|---|---|
| Native auth and load coordinator | Create app target, connect Keychain/GoTrue, profile-first loads and all failure tiers; prove failure never routes to onboarding |
| Partial-profile recovery | Read existing optional fields and resume completion without replacing saved goals/theme; verify actual row after save |
| Auth/RLS integration | Dedicated test users: own-row read/write, another user's exclusion, zero-row mutation failure, 401 rotation and 403 handling through the Swift client; do not pollute personal records |
| Supplement parent ownership | Validate/apply the prepared additive proposal after current backup and zero-mismatch preflight; require parent diagnostic true, unchanged daily conflict target and cascade behavior |
| TrainerHQ adoption | Locate its actual iOS target, depend on the same local package, build both apps; verify same personal record and assignment origin from both authorized paths |
| Trainer gateway | Verify command payload/response DTOs against gateway code/live contract, stable `operation_id` retry and each consent scope before implementing screens |
| Concurrent data writes | Define/reconcile cumulative-water and whole-session last-writer behavior across apps; do not claim same-day uniqueness solves lost updates |
| Durable workouts and interrupted saves | Per-user disk drafts with original day and pending write identity; terminate/relaunch and prove restored disk-only changes; reconcile a deliberately lost response without duplicate rows |
| Home and Workout | Implement the supplied layouts with real data and honest states; compare at 390×844 and on hardware in pastel/dark |
| Other screens / correction paths | Coherent native designs; custom-food edit/delete, session correction, plan editing and all features in the inventory |
| Additional nutrient/day coverage | Separate water reads, validated shared unsupported-nutrient totals, due denominators on absent dates, midnight/foreground reloads |
| HealthKit | Choose source ownership, consent and deduplication rules before bidirectional sync; test granted/denied/partial permissions and repeated imports |
| Watch and WidgetKit | Define shared storage/session ownership, conflict recovery and per-user clearing; prove device/widget behavior |
| Notifications | Real authorization and scheduled reminders; prove delivery while the app is inactive |
| Account deletion/privacy | Coordinate active trainer relationships and data-sharing disclosures; verify account deletion and credential/draft clearing |
| Release | Xcode project, signing/App Store configuration, real-device checks, archive/export/upload and TestFlight processing evidence |

The absence of the TrainerHQ iOS target, complete gateway command schemas and
native app/device evidence is explicit. It does not justify guessing at those
contracts, claiming cross-app completion, or silently removing requirements.

## Git and release discipline

Work stays in an isolated task worktree. Review the final changes before
committing. Use small Conventional Commits and report every pre-existing commit
in `origin/main..HEAD` before a push. Run the production web build before each
push; package tests do not replace it. `main` uses PRs and the required Vercel
check. No code signing, production deployment or TestFlight success is implied
by completion of the data foundation.

GitHub's live `main` setting was initially unprotected. The approved PR/Vercel
rule was applied and re-read on 2026-09-10 UTC: required PRs, up-to-date Vercel
status bound to GitHub App 8329, admin enforcement, no force pushes or branch
deletion. Zero additional approving reviewers keeps the solo-owner workflow
usable. No branch was merged. The local `.githooks/pre-push` runs the production
build; `npm install` activates it and each phase-one push also explicitly selects
that hook. No `--no-verify` bypass is used.

The first branch push was rejected because the saved GitHub token lacks
`workflow` scope. The unpushed commit was amended to retain the proposed workflow
under [docs/ci](ci/README.md). It is inactive; no GitHub Actions result is claimed.
The branch can carry the package, local checks and Vercel preview under existing
permissions. Activating the workflow requires separately authorized workflow
write access.
