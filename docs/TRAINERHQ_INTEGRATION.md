# TrainerHQ integration — accepted decisions and preflight

Status: **Approved development integration on the existing Supabase Free project.**

The user explicitly waived the managed/restorable-backup prerequisite on 2026-09-08 because current data is disposable development data. No upgrade or separate permanent database is required. Preserve users, test logs and existing objects; use small additive migrations. If a live migration fails, stop and apply the documented non-destructive disable rollback.
Inspected 2026-09-08 against WiFit commit `3415ab1664bb3e2eb94abfecc79aa86cff4779f3`.
No integration migrations, roles, policies, buckets or Edge Functions have been applied.

## Canonical ownership

This repository, `https://github.com/John-bess4/WiFIt.git`, is the sole canonical
owner of shared Supabase migrations, database tests and Edge Function source.
Local path: `/Users/johnbessemer/Documents/wifit`.
TrainerHQ remains its separate native app at
`/Users/johnbessemer/Downloads/TrainerHQ_Project_Source`; it consumes the API
contract and must not maintain a competing migration directory.

The saved project at `Documents/ChatGPT/WiFit` is an empty Git repository with
no commits or remote. The separate `training-app` repo uses a different custom
JWT/Prisma architecture and was not modified or adopted as the backend.

Shared production project: `vghqqksbjpgdzmvfmnru`, WiFit, `us-east-1`,
PostgreSQL 17.6.1.111. Preserve its existing Auth configuration and user IDs.

The working WiFit surface is currently React/Vite at `https://wifit.vercel.app`.
A native Swift rewrite is planned; no native WiFit bundle ID or Apple team is
present in this repository. Do not invent one. TrainerHQ currently declares
`com.trainerhq.trainerhq` but has no configured development team.

## Evidence recorded now

- `supabase/preflight/2026-09-08-inventory.json`: metadata for 11 public tables,
  5 invoker-security views, 12 existing public policies, columns, constraints,
  indexes, grants/default grants, functions, triggers, extensions, publications,
  migration history and Storage counts. **This is not a data backup.**
- `supabase/tests/wifit_logging_baseline.sql`: 22 passing live database
  assertions using temporary synthetic accounts/logs. All test writes run in
  a deliberately rolled-back subtransaction; it also checks account cleanup.
  No existing account or log is edited. This is a SQL/RLS test, not an
  authenticated browser or GoTrue test.
- Existing WiFit regression suite: **163 tests in 25 files passed**.
- WiFit lint: **0 errors, 22 existing unused-variable warnings**.
- WiFit production build passed; existing minified bundle exceeds 500 kB.
- TrainerHQ build/test baseline: **64 tests passed** on iPhone 16 Pro,
  iOS 26.5 Simulator. These cover existing local/mock/HTTP-double services,
  not a working Supabase integration.
- No Supabase Edge Functions or development branches were present.
- Storage inventory: **0 buckets, 0 objects** at inspection time.
- Security advisor: existing leaked-password protection warning. Auth settings
  were left unchanged. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The installed system Node was too old for current Vitest. Tests/build passed
using the bundled Node runtime at
`/Users/johnbessemer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.
Initial sandbox write failures concerned Vite cache/build files, not product defects.

## Preservation and model conflicts

Keep `src/lib/supabase.js` and WiFit authentication behavior intact. Its methods
have deliberately different error contracts; do not replace it with an SDK as
a side effect. The Supabase Swift SDK is for TrainerHQ's adapter layer.

Canonical user-created records remain in existing WiFit tables:

| TrainerHQ information | Existing source / integration constraint |
| --- | --- |
| Account identity | `auth.users`; no duplicate TrainerHQ identities |
| Client profile | `public.profiles`; expose a minimal identity projection only |
| Nutrition logs | `public.food_log`; retain grams and per-100-gram columns |
| Nutrition totals | PostgreSQL numeric arithmetic, matching `daily_summary` rounding |
| Planned workouts | `public.workout_plans`; `public.workouts` is legacy and unused |
| Completed workouts/sets | `public.workout_sessions.exercises`, including `setsData` |
| Exercise performance | Existing `exercise_bests` and `exercise_pr_events` semantics |
| Supplement regimen/logs | `public.supplement_stack` / `public.supplement_log` |
| Body weight | `public.body_weight_log` |
| Water | `public.water_log`; no automatic health-summary sharing |

Do not copy food, supplement, completed-workout or weight records into new
TrainerHQ tables. New trainer assignments, appointments, consent and messages
are new concepts, not copies of client evidence.

`profiles` combines identity with health and nutrition fields. Granting broad
trainer SELECT would disclose unshared data. Existing owner-only policies stay
unchanged; use narrowly authorized server projections with explicit columns and
bounded dates. A privileged projection must check the caller's current
relationship and each requested scope in the same database operation.
Do not return the mixed-category `daily_summary` row wholesale.

The supplement FK binds `supplement_id` alone, not its owner. New privileged
joins must also match `supplement_log.user_id = supplement_stack.user_id`.
The passing baseline does not claim every possible legacy FK misuse is denied.

WiFit stores local dates in `*_date` columns and UTC instants in timestamps.
Do not recreate local dates by slicing UTC strings. New plans need explicit
IANA timezone, effective dates, tracking days and cutoff rules.

Eight of the nine local migration filenames differ from the server's recorded
version. Some local versions contain only a date; three share `20260907`.
The initial 11-table schema is not represented by a baseline migration.
**Do not blindly run `db push`, repair remote history, or replay the directory.**
After backup, reconcile by recorded name/content and exact remote version,
preserving original history, then prove an isolated restore/replay. Historical
backfills must not run again merely because a filename differs.

## Accepted authorization and consent design

Create protected trainer approval records tied to existing Auth users.
Only an owner/platform administrator can approve an application; self-approval
and user-editable metadata can never grant privileges. Resolve authorization
from live protected records so stale JWT claims cannot restore revoked access.

Use a dedicated `trainer_client_relationships` table with invited, accepted,
active, paused, revoked and ended states. Accepting identity and activating
chosen sharing are explicit client decisions. Declining closes the invitation.
Keep a separate grant for each relationship and scope. Support independent
multi-trainer relationships, not a single trainer field on the client.

Scopes: workout information, nutrition history, supplement history, session
history, progress measurements, progress photos, health summaries and messaging.
Nutrition adherence is separately explicit; sharing an aggregate need not share
meal history. No grant means no access. All exposed new tables use RLS with
minimum explicit grants; privileged mutations go through secured Edge Functions.

The interim consent portal uses existing WiFit Auth, separate from onboarding:
review invitation/trainer identity, accept/decline, scope selection, active
trainers, pause/revoke. A failed read must never trigger profile onboarding.
Use the existing controlled WiFit domain with a dedicated consent path; exact
callback allow-list entries must be verified before deployment. Do not rewrite
the working WiFit app or introduce a second auth system.

Group conversation membership is checked on every read, send and attachment
access. Revocation removes the affected trainer from the participant set and
rotates the channel epoch. Other authorized members keep history and continue.
The revoked trainer cannot read old or new messages. Preserve history server-side;
do not archive the entire group merely because one trainer was revoked.

## Accepted online-first behavior

Server acknowledgment is required before reporting a write saved. Expose online,
saving, saved and failed states with retry; preserve unsent text drafts locally.
No complex bidirectional synchronization engine or automatic silent write replay.
Use operation IDs for retryable submissions and compare row versions for edits.
Use server-generated timestamps and transactional authorization checks.

Cache dashboard/schedule data briefly; do not durably cache progress photos,
detailed health data or unnecessary sensitive records. Purge protected data on
logout, account removal and detected revocation. Foreground/reconnect must
revalidate access before showing protected cached content. Keep repository
interfaces independent of caching and Supabase so fuller offline support can
be added later. Existing previews, fixtures and local reminders remain.

## Accepted adherence rules

Version calculations and effective plans; calculate on the server. Store the
rule version, source/plan version, category status and coverage with each summary.
Historical results must not silently change when the formula changes.

Diet eligibility requires a configured active target/plan, client-enabled
tracking, an eligible local day and a nutrition-adherence sharing grant.

- Calorie target adherence: 50%.
- Protein target adherence: 30%.
- Carbohydrate and fat target adherence together: 20%.
- Keep weights and tolerances configurable; use acceptable ranges, with protein
  primarily a minimum. The exact initial tolerance/range values and the split
  within the final 20% belong to the versioned plan, not hardcoded UI arithmetic.
- After the configured local cutoff, missing expected logs mean incomplete or
  non-adherent according to that plan. Before cutoff, the day remains pending.
- Unshared = **Not Shared**; no target = **Not Configured**; neither is zero.

Overall starts with equal 25% weights for workout, diet, supplement and session.
Include only configured, eligible, shared categories and renormalize those
weights. Return coverage, e.g. 3 of 4 categories available. Fewer than two means
**Insufficient Shared Data**, not a numeric overall score. Period averages and
chart exports must retain matching eligibility, source dates and denominators.

Keep Workout Completion (appointment completion) and Nutrition Compliance
(logging consistency) distinct from workout and diet adherence. Unknown data
must not become zero, a no-log alert, or a fabricated fixture value.

## Realtime, media, notifications and health

Persist records in PostgreSQL; private Broadcast carries minimal invalidations.
Refetch under current authorization. Channel authorization is cached, so rotate
epochs on membership/consent changes and stop publishing to prior topics.
Do not assume a joined socket automatically loses cached authorization.

Use private Storage buckets and current membership/consent checks. Prefer
authenticated downloads for protected content; do not embed enduring signed
URLs in messages or avatar models. Clear in-memory images on revocation.

Store APNs tokens per installation, app, user and environment. A protected
server sender uses Apple credentials, preferences, deduplication and invalid
token cleanup. APNs acceptance is not proof of delivery. Preserve local reminders.

HealthKit remains exclusively in future WiFit. Cloud health summaries require
separate upload consent and trainer-sharing consent. Production diagnostics
must not contain tokens, message contents or private health values.

## Historical backup assessment and current release requirements

The following original backup assessment is retained as history, not an implementation gate. No restorable backup has been created or verified. The current Supabase MCP
connection exposes schema/SQL tools but no backup export. No database password,
PG service/pass file, Supabase CLI credential or authenticated dashboard session
was available. Docker/OrbStack and PostgreSQL client tools were also absent;
tool installation can proceed once a usable backup connection is supplied.

Provide a local `PGSERVICEFILE`/`PGPASSFILE` configuration for the project's
session pooler, or a current restorable backup path. Keep credentials out of
chat, both apps and Git. The metadata JSON alone does not satisfy this gate.
See [official backup guidance](https://supabase.com/docs/guides/platform/backups).

Then:
1. Produce and checksum a protected schema/data/Auth backup plus Storage metadata;
   verify restore in an isolated environment. Keep production objects untouched.
2. Reconcile migration provenance and establish reproducible baseline/replay.
3. Add trainer approval, relationships/consent and RLS with adversarial tests.
4. Connect the official pinned stable Supabase Swift SDK behind TrainerHQ
   protocols, then verify real trainer/client authentication and portal consent.
5. Expose read-only authorized WiFit data; rerun this SQL baseline and WiFit
   browser logging flows with a designated test account.
6. Add assignments/scheduling, messaging/private attachments, versioned adherence,
   private Realtime and server APNs, testing each stage before rollout.

Later configuration still required: owner/admin Auth user ID for protected
bootstrap, designated test accounts, confirmed callback entries, Apple team,
registered TrainerHQ bundle ID, future WiFit native identifier, APNs credentials
and a physical device. Do not infer these from an email or local filesystem owner.
No second production approval is required; the user has already authorized safe
additive implementation subject to the stated backup/regression gates.


## Mandatory before real-user onboarding

Managed backups, a separate development/production environment strategy, tested data-recovery procedures, deletion/retention workflows and an access-control release review must be established before onboarding real users or storing meaningful client data. The development waiver does not apply to real-client operation.

Existing migrations/inventory were preserved in commit cc8bb95. A private JSON export of the current public tables and Storage metadata was saved outside Git in the TrainerHQ workspace; it excludes Auth credentials and is not a complete recovery backup.

Migration 1 was applied successfully on 2026-09-08: protected trainer approval, invitations, independent relationships/scopes, RLS and scoped read-only projections of existing WiFit logs. See supabase/tests/trainerhq_identity.sql and supabase/rollbacks/trainerhq_disable.sql. No original WiFit policy is replaced.

After migration 1: 25 authorization assertions, 22 original logging assertions and 163 WiFit tests passed. Lint has zero errors and 22 existing warnings; the production build passes with its existing bundle-size warning.

Migration 2 was applied successfully. All 33 domain authorization assertions, 25 identity assertions, 22 original logging assertions and 163 WiFit application tests passed afterward. It adds client-accepted assignments linked into existing workout_plans, optional origin IDs on workout plans/sessions, conflict-checked scheduling, client-led multi-trainer groups, durable messages/receipts, and a private attachment bucket. Deferred consent checks remove only the affected trainer, preserving group history for remaining members. Tests cover authorization, idempotency, conflicts, read receipts and immediate read denial after revocation. The non-destructive integration-disable rollback also applies to this migration.

Migration 3 is prepared and isolated-PostgreSQL tested for adherence/coverage, target privacy, weighted numeric scores, private topics and disabled APNs preparation. New triggers publish only refresh signals, catch errors without failing WiFit logging, and never publish message bodies or health values. No APNs application identifier or secret is fabricated. Tracking targets start when a client explicitly confirms them; earlier dates remain Not Configured. The rollback is the same non-destructive integration-disable switch.
