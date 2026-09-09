# TrainerHQ / WiFit shared Supabase integration

Updated 2026-09-09 UTC. **Owner hold: do not update WiFit remote `main` or deploy/promote to production. TrainerHQ remains an independent iOS application/project.** **Six additive migrations and the authenticated Edge gateway are live on the existing WiFit Free project.** No upgrade, second database, destructive migration or deletion of existing records was performed. Native and consent-portal integration is implemented; real trainer onboarding and client consent are verified; live assignment, scheduling, messaging, private media and Broadcast checks are verified; release requirements are described below.

## Ownership and compatibility

WiFit repository `John-bess4/WiFIt` is the sole canonical owner of migrations, SQL tests and Edge Functions. TrainerHQ remains a separate SwiftUI codebase consuming the same contract. The shared project is `vghqqksbjpgdzmvfmnru`, region `us-east-1`, PostgreSQL 17.6. WiFit's existing Vercel project and domain `wifit.vercel.app` remain in use. Existing Auth configuration, Auth user IDs, original tables/views/policies and Storage objects are preserved.

The original 11 WiFit tables and five invoker-security views remain canonical. Food, supplements, completed workouts, weight and water are never copied into TrainerHQ-owned log tables. Original owner-only RLS is unchanged. The only original-table schema additions are nullable `trainer_assignment_id` columns and ownership-enforcing foreign keys on `workout_plans` and `workout_sessions`. Normal WiFit logging omits these fields; accepted trainer workouts carry their origin through plan loading, completion and readback.

Preflight source was preserved at commit `cc8bb95`, based on WiFit `3415ab1`. Original inventories, migration checksums and rollback-only logging tests are in `supabase/preflight` and `supabase/tests`. A private JSON export of original public records and Storage metadata exists outside Git in TrainerHQ `.private-backups`; it excludes Auth credentials and is not a complete restorable backup. The user explicitly waived the backup gate for this disposable development dataset. Historical design/preflight is retained in `TRAINERHQ_PREFLIGHT_20260908.md`.

## Migrations applied

| Canonical SQL file prefix | Live version | Migration | Result after application |
| --- | --- | --- | --- |
| 20260908165845 | 20260908170811 | trainerhq_identity_and_consent | 22 logging + 25 authorization; 163 WiFit tests |
| 20260908170956 | 20260908172953 | trainerhq_assignments_scheduling_messaging | 80 SQL checks; 163 WiFit tests |
| 20260908185559 | 20260908200526 | trainerhq_adherence_realtime_push | 102 SQL checks; 163 WiFit tests |
| 20260908200706 | 20260908200904 | trainerhq_roster_projection_contract | 102 SQL checks; 163 WiFit tests |
| 20260908220640 | 20260908221003 | trainerhq_pending_group_consent | 104 SQL checks; 178 WiFit tests |
| 20260908224233 | 20260908224545 | trainerhq_conversation_display_names | 106 SQL checks; 188 WiFit tests |

All migrations were tested in isolation and committed before application. No live migration failed. The fourth corrects roster projection aliases and a progress invalidation scope; the fifth closes revoked pending-group invitation metadata access. The sixth adds approved member display names to the existing authorized conversation projection. The complete current application suite now contains 191 tests, including Edge gateway and consent/API tests.

CLI-created timestamps precede MCP server application timestamps. Original legacy files also differ from server history and lack an initial-schema migration. The committed results JSON records actual versions. **Do not blindly run `supabase db push` or replay historical backfills.** See `supabase/testing/README.md` for isolated replay, provenance and the controlled application procedure.

Rollback is `supabase/rollbacks/trainerhq_disable.sql`: disable TrainerHQ authorization through the private integration switch without deleting users, data, schema, policies or Storage. If a future migration fails, stop, report the exact failure and use that documented compatibility rollback when needed. Do not attempt unrelated SQL repairs.

## Tables and access control

All exposed tables have RLS. New public tables grant authenticated SELECT only; clients cannot directly mutate protected approval, grants, messages, schedule or adherence records. The public `trainerhq_api` RPC is SECURITY INVOKER and executable only by service_role. Privileged implementations live in the unexposed, grant-restricted `trainerhq_private` schema and validate actor plus a currently valid Auth session before resource authorization. No user-editable metadata is trusted.

| New public table(s) | Read policy / mutation authorization |
| --- | --- |
| trainer_profiles | Own profile; approved identity relevant to an invitation/relationship. Trainer applies pending; trusted owner/admin approves; self-approval denied. |
| trainer_client_relationships | Matching trainer or client only. Client alone accepts/activates, pauses, revokes and changes scopes using expected version. |
| trainer_client_permissions | Relationship participants only. Independent grants per relationship, never per client globally. |
| trainer_workout_assignments | Owning client or authorized trainer with workouts scope. Trainer assigns; client accepts into existing WiFit plans. |
| trainer_appointments, trainer_appointment_changes | Owning client or authorized sessions relationship. Trainer writes schedule; client requests changes. Overlap and optimistic-version checks. |
| trainer_availability | Own trainer rows; scoped service projection for the related client. |
| trainer_conversations, trainer_conversation_members, trainer_messages | Current member with current consent. Clients retain their own history; trainers require active authorized relationships. |
| trainer_message_receipts, trainer_message_attachments | Visible message/current membership, with attachment Storage policy recheck. |
| trainer_reminders | Own trainer only. |
| client_tracking_preferences, client_nutrition_targets | Own client; trainer target projection only with nutrition permission. |
| trainer_notification_preferences | Own account. |

Private RLS tables: integration_control, platform_administrators, trainer_reviews, invitations, audit_events, operations, conversation_relationships, adherence_rules, adherence_summaries, push_applications, device_installations, notification_jobs and integration_diagnostics. No client policies intentionally means deny by default. Server-managed approval and current database consent, rather than JWT role claims alone, decide authorization.

Scopes: workouts, nutrition, nutrition_adherence, supplements, sessions, progress_measurements, progress_photos, health_summaries and messaging. Nutrition history and derived diet adherence are independently selectable. A trainer changing a client ID cannot obtain another trainer's clients. Invitation tokens are random, stored hashed, expire after seven days and require the verified intended recipient email. No invitation email is sent by this implementation; trainers share the generated link themselves.

Initial groups contain one client and two to eight independently authorized trainers. The client creates a group and each trainer explicitly joins. Revoking one trainer removes their access to history, new messages, attachment metadata/bytes and pending group invitation titles. Other participants and historical messages remain. All access rechecks current consent; channel epochs rotate. Multi-client groups are outside this initial consent model.

## Edge API, native services and portal

`supabase/functions/trainerhq-api` is deployed with JWT verification enabled. The handler independently verifies the bearer through Supabase Auth, checks the verified user/session, rejects caller-supplied actor/session IDs, limits request size, allow-lists actions and returns generic errors without logging tokens, health values or message text. It uses only server-runtime credentials for the restricted RPC. Browser origins are the existing WiFit domain and localhost development origins. Unauthenticated HTTP returned 401; an untrusted Origin returned 403.

TrainerHQ pins official `supabase-swift` 2.55.1 and its Package.resolved. SDK calls remain in service/repository adapters; SwiftUI does not import Supabase. SessionManager owns the only durable session copy in Keychain; SDK session storage is transient. Device-local sign-out does not sign out WiFit sessions. Repository protocols, fixtures, previews and existing local-reminder behavior are preserved. The iOS configuration contains only the project URL and publishable key; no service-role or APNs signing secret.

The existing WiFit app owns `/trainer-consent`, using its unchanged hand-rolled `sb` Auth wrapper. It supports invitation review, explicit unchecked sharing choices, accept/decline, independent active trainers, pause/revoke, tracking configuration, accepting assigned plans, appointment change requests, client-led groups, messages and authenticated private attachment viewing. The main WiFit route remains intact. Routes load separately so the portal does not enlarge WiFit's initial application bundle.

Writes show saving, saved or failed and retain an operation UUID for explicit retries. Important records persist in PostgreSQL. Server timestamps, optimistic versions, transaction locks and idempotency records handle conflicts/duplicate submissions. There is no silent offline save or complex bidirectional engine. Native protected responses are held in memory; portal text drafts use session storage scoped to user/thread. Logout and permission changes clear protected UI/drafts; private attachment previews are memory-only and clear on background/dismissal. Storage requests bypass HTTP caching.

## Adherence and data accuracy

Server formula version 1: calories 50%, protein minimum 30%, carbohydrates 10%, fat 10%; calories ±10% and carbs/fat ±15% tolerance ranges. Weights and tolerances are private configuration. A client explicitly confirms a dated nutrition target and tracking timezone/days; historical days before configuration are not retroactively scored. Missing eligible logs before cutoff are pending, after cutoff incomplete; unshared and unconfigured never become zero.

Overall adherence uses equal category weights renormalized across available configured/eligible/shared categories. Coverage accompanies every score; fewer than two suppresses overall score with Insufficient Shared Data. Derived summaries retain calculation version and source hash. Workout adherence initially covers due trainer assignments with linked client-authored completions; session adherence covers appointments. Workout Completion remains completed appointments; Nutrition Compliance remains logging consistency. Native Decimal rounding mirrors WiFit's numeric per-row macro rounding. Date-only logs preserve the client's local day. Unknown frequency and supplement timing are not presented as invented zero-frequency/midnight schedules.

Progress-measurement authorization reads existing WiFit weight logs. Health summaries and progress-photo permissions reserve the future WiFit upload contract; this phase does not invent HealthKit values or a new client photo collection workflow.

## Realtime and APNs preparation

Private Broadcast carries only `{refresh:true}` invalidations, never message bodies or health values. Authorized relationship/conversation topics use rotating epochs; clients refetch PostgreSQL under current authorization. Native subscription refresh and foreground refresh recover missed signals. Original WiFit logging survives trigger/Broadcast failures. Realtime is an update hint, not permanent storage.

Messaging uses durable sequence numbers, sent/read/delivered timestamps, unread cursors, private Storage upload reservations and authenticated downloads. Upload retry can recognize an already-landed identical object without creating a duplicate message.

APNs is **prepared, not delivering**: per-installation token tables, preferences, protected registration/unregistration and content-minimized deduplicated notification jobs exist. Applications are disabled until real Apple configuration is supplied. A protected sender, APNs signing credentials, retry/invalid-token cleanup and physical-device delivery verification remain release work. Local reminders continue independently.

## Verification and release requirements

- 106 live SQL assertions: 22 original WiFit logging, 25 identity/consent, 37 domain/Storage, 22 adherence/Realtime/APNs preparation. Same suites pass on isolated PGlite 0.5.8 / PG18.3 with all six migrations replayed.
- 191 WiFit JavaScript/DOM tests passed. Lint: zero errors, 22 existing unused-variable warnings. Production build passed; separate route chunks remove the former >500 kB warning.
- TrainerHQ: 75 standard unit tests passed (one opt-in live test is skipped by default) on iOS 26.5; signed simulator build succeeds. The corrected large-text Chat test and all-six-tabs test passed on iPhone 16 Pro. Together with the earlier seven analytics and two Chat tests, 11 distinct UI regression cases passed. The complete 36-case UI suite was interrupted for user account creation and is not reported as fully passing. The assignment stage saved successfully before an earlier combined live test encountered a subsequently corrected Schedule selector; the assignment’s database record and WiFit acceptance/completion were independently verified. Native assignment Save is now in the navigation bar and remains reachable while the keyboard is open; draft presentation survives routine detail refreshes.
- The user signed in with the original WiFit account, configured nutrition tracking and activated the independently approved trainer relationship with all nine selected scopes. Native signup/email verification, owner review, invitation creation, approved account identity, all six live entry screens and authorized client detail loading are verified. Reopening an already-used invitation no longer hides active relationships; reduced sharing clears protected drafts/conversation views. Browser food, supplement and workout writes returned HTTP 201, were re-read in PostgreSQL, and the food survived a full reload. Initial logging checks had no console errors/warnings and 2xx responses. Later the existing Auth wrapper successfully refreshed an expired session and retried, logging two refresh notices without token values. Trainer/client messages and read receipts were stored and re-read. The native assignment was accepted into one existing WiFit plan and completed as one linked workout session. Native appointment creation and message sending passed their separate live UI tests. The appointment appeared in the client portal; an inline client change request returned 200 and was verified in PostgreSQL. The inline form replaces the unsupported browser prompt, preserves failed text, and retries the same operation ID. An opt-in native service test passed private Broadcast invalidation within ten seconds, private Storage upload/download with byte equality and unauthenticated denial. The client portal decoded the trainer’s private test PNG; public-key-only HTTP returned 400 with a hidden-object response. Labeled development records are retained for review.
- Security advisor: no errors. Thirteen INFO notices are intentional deny-all private tables. Existing leaked-password protection warning is preserved; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Auth settings were not changed.

Required values: real Apple Developer Team ID, confirmed registered TrainerHQ bundle identifier (current project value com.trainerhq.trainerhq has no team configured), APNs key ID/team/signing key in server secrets, installation environment and a physical device. Future WiFit native bundle ID is absent from this web repository. No identifiers or credentials were invented.

**Before any real users or meaningful client data:** establish managed backups, separate development/production environments, tested recovery procedures, retention/deletion jobs, APNs delivery operations and a security release review. Current private invitation/idempotency/audit/notification records are retained until a reviewed cleanup workflow exists; progress/media bytes are not durably cached by the new clients. Define concrete retention periods and account-removal handling before launch. Minimum-supported iOS 17 and physical-device checks remain outstanding because this environment has only iOS 26.5 simulators.

## Deployment status

The consent portal and WiFit assignment-origin support are committed locally but have not been pushed or deployed. Automatic approval review rejected pushing `main` because it triggers a production Vercel deployment and an earlier UI test was unresolved. The failed Chat assertion is now corrected and its rerun passes. An explicit production-deployment approval is still required before retrying that action; no alternate deployment method has been used. The existing production site is unchanged. The local consent route at `http://127.0.0.1:5173/trainer-consent` uses the live shared backend and the existing WiFit account.

TrainerHQ now has its own local Git history; no remote has been invented. Opt-in `LiveIntegrationUITests` require `TRAINERHQ_LIVE_CHECKS=disposable-test-data`, a verified expected trainer email and client name. They never enter credentials, approve a trainer, change sharing grants or delete records. Run only against the designated development test accounts, with Simulator parallel cloning disabled so the explicitly signed-in installation is used.

`LiveSupabaseIntegrationTests` additionally requires `TRAINERHQ_TEST_CLIENT_ID`. Its private media/Broadcast check restores the normal app Keychain session and refuses unexpected accounts before writing; it never prints or exports credentials. Both live suites are disabled by default. Ordinary unit tests do not create remote records.

## Owner release gates (2026-09-09 UTC)

Before any WiFit production deployment, complete the full native UI suite,
physical-device testing, full backup/recovery verification, hosted consent
preview verification and final WiFit Auth/logging/workout/nutrition/Storage/RLS
regression checks. Another explicit owner approval is required even after all
checks pass. No main push, merge, production alias change or production deployment
is authorized. TrainerHQ retains its own Git repository, SwiftUI UI, app
architecture, `com.trainerhq.trainerhq` local identifier and separate release cycle.

The current production deployment is `dpl_7c8kcAZY3bvaVtUtjvusp2hKa3wm` at remote
main `f2849f0a09f03acc9b2050285c1bea3a35d911eb`; no production update occurred.
The local base also includes pre-existing unpublished WiFit commits `5cd8353`
and `3415ab1`, preserved from before the TrainerHQ work. Review them separately
when choosing a future release candidate.

The attempted separate `codex/trainerhq-consent-preview` push was rejected by
automatic approval review because this GitHub repository is public and publishing
the new integration code needs explicit approval. No branch was pushed; no
alternate publication was attempted. Hosted preview remains unverified.

An in-memory recovery drill restored 51 original public development records,
replayed the seven candidate migrations, preserved original owner policies and
passed 112 SQL assertions plus the 22-check logging suite after the compatibility
rollback. The target-date rollback/reapplication also passed. This **does not**
verify real Auth, Storage files or a full current-project restore. See
`supabase/preflight/2026-09-09-development-recovery-drill.json` and
`supabase/testing/README.md`. The device Release target compiles, but no physical
iPhone is connected and no Apple Developer Team is configured.

The seventh migration is prepared and isolated-tested: it corrects only two
TrainerHQ nutrition-target date lookups to use the client's configured timezone.
Original WiFit tables, policies, auth and logging functions are unchanged.
