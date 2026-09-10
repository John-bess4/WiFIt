# Phase Two implementation and verification

Implemented and locally reviewed on `codex/native-auth-loading`, stacked on the
Phase One branch. Live acceptance remains open.
The user approved Phase Two and preapproved Home after this phase is finished
and double-checked. This record separates local implementation evidence from
live acceptance that is not yet established.

## Implemented

- Checked-in native SwiftUI app and UI test targets, Swift 6 / iOS 17 minimum.
- One Keychain-backed Auth and REST client, profile-first app routing, distinct
  failed/absent/partial states, and independent typed resource loads.
- Captured account identity for setup drafts and asynchronous responses;
  logout clears visible state before secure-storage/network work suspends.
- Narrow profile completion PATCH, explicit target preservation, and safe
  create-if-missing that never overwrites a concurrently created profile.
  Every save re-reads; ambiguous results require reconciliation before retry.
- Foreground/day/timezone refresh, fresh-context write gates and a midnight
  timer that reschedules when the clock or timezone changes.
- Five paired themes, native abstract backgrounds, semantic colors, translucent
  cards and shared loading/failure controls. Dynamic Type and Reduce
  Transparency are supported; backgrounds are static and require no motion.

## Verified so far

| Check | Result |
|---|---|
| Web regression suite | 201 passing |
| Web lint | 0 errors; 22 existing warnings |
| Web production build | Passed; pre-push hook also passed on reference commit |
| FitDataKit complete suite | 71 passing after the live QA extensions; all three live tests explicitly skipped without opt-in |
| WiFitAppCore complete suite | 46 passing |
| Real macOS Keychain CRUD / service isolation | Passed outside the process sandbox |
| Xcode package/project resolution | Both local packages, app and UI test target resolve |
| Native compile | Debug and Release Simulator builds pass; Release excludes synthetic fixture markers |
| Complete final UI suite | Seven passing tests on iPhone 17 Pro, iOS 26.5, including all account/profile/failure flows and the ten-theme matrix |
| Final theme captures | Ten variants plus two failure states retained unchanged under `docs/verification/native-auth` |
| Compact accessibility check | Two passing sign-in/relaunch and profile-save flows on iPhone 17e (390×844 points), iOS 26.5, `accessibility-large` text |
| Live negative auth probe | Public native configuration reaches Auth; one synthetic nonexistent account returned HTTP 400 `invalid_credentials` |

Negative tests include failed profile reads without seeding, late account-A
responses after account B, missing-profile draft ownership, failed/unknown save
reconciliation, preserved user edits and unrelated server fields, current-day
write blocking, verified owner/date filters, and profile creation races.
Five final lifecycle cases also verify coalesced busy refreshes, slow profile
responses crossing midnight, logout/account replacement and cancellation.

The expanded real-JWT harness now covers profile conflict/narrow-update
preservation and supplement ownership/upsert/cascade behavior in addition to
food CRUD/RLS. The supplement test requires a separate explicit opt-in after
its constraint is applied. The opt-out run compiled and reported three skipped
tests with zero failures; it performed no live authentication or mutations.

The first UI build used `CODE_SIGNING_ALLOWED=NO`. It launched, but secure
storage failed before any fixture scenario could enter its expected route.
Xcode's ordinary ad hoc Simulator signing (`CODE_SIGNING_ALLOWED=YES`,
`CODE_SIGN_IDENTITY=-`) restored the app identity and Keychain access without
requiring a developer team. Later checks exposed inherited parent accessibility
identifiers overriding controls; container/leaf identifiers were corrected.
The affected tests were rerun and passed. No in-memory substitute was used for
the Keychain relaunch/logout tests.

The final native result bundle is `/private/tmp/wifit-phase-two-final.xcresult`.
The separate compact result is `/private/tmp/wifit-phase-two-compact.xcresult`.
Release output is `/private/tmp/wifit-phase-two-release-derived`; native test
fixtures, host and account markers are excluded from that executable.

The two-account UI fixture uses actual Auth/REST/Keychain with a transport that
cannot access the network. Profile mutation and its mandatory re-read are
verified within that fixture's lifetime. Only credentials persist across
relaunch in these tests; production row persistence remains the live gate.

## Count-only production preflight

On 2026-09-10 UTC, the following read-only query returned
`mismatched_supplement_owner_rows = 0`:

```sql
select count(*) as mismatched_supplement_owner_rows
from public.supplement_log as log
join public.supplement_stack as stack on stack.id = log.supplement_id
where log.user_id <> stack.user_id;
```

This establishes the current mismatch count, not the missing constraint or a
recovery point. Re-run under the migration's locks immediately before deployment.

## Live and release gates still open

- The user explicitly approved creation of two temporary QA accounts and their
  cleanup. Account creation is still pending dashboard access: the in-app
  browser reaches Supabase, but redirects to sign-in. No QA accounts have been
  created and the real JWT checks have not run. Neither service-role SQL nor a
  synthetic UI transport substitutes for real password authentication, row
  read-back and cross-account RLS.
- The proposed supplement-parent ownership constraint is not applied. The
  project is healthy, but available tools exposed no dated backup/PITR recovery
  range. Native computer control reported the Mac locked; the in-app browser
  subsequently worked but requires Supabase sign-in. A current recovery point
  and count-only preflight remain deployment prerequisites. An independent
  review found no blocking SQL defect in the additive proposal.
- TrainerHQ's separate Xcode target and same Supabase origin are now verified.
  Its dependency is still `supabase-swift` 2.55.1; no claim is made that both
  apps consume FitDataKit or pass a joint integration test.
- Physical-device visual/Keychain checks, App Store signing, HealthKit,
  active workouts, complete feature screens and TestFlight remain later work.

No production schema changes or personal-record writes were performed for the
local tests. No schema documentation was silently changed to describe the
unapplied ownership proposal as deployed.
