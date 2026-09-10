# Phase two — native authentication and loading

Phase one provides the shared package and a reviewed database contract. The next
phase creates the WiFit iOS application target and connects that foundation to
real authentication and honest loading states. The user approved this phase on
2026-09-09 Pacific. Implementation and verification are in progress.

## Updated theme direction

The user subsequently supplied [13 updated reference images](../design-reference/updated-themes/README.md)
and explicitly asked to add them to the plan and continue. Implement five theme
families—Cotton Candy, Purple, Rose, Aqua and Teal—with a light/dark variant for
each. Recreate their flowing abstract backgrounds, translucent cards and fine
highlighted edges through shared native SwiftUI tokens and shapes. Cotton Candy
light is the initial pastel direction; honor system appearance or an explicit
local appearance choice. Preserve existing stored profile theme values and do
not change the shared schema or silently rewrite another app's theme setting.

The included Food/Workout/Supplements page concepts guide the later screen
plans. They do not bypass the auth/profile-first build order or introduce sample
records into a user's account. The referenced ChatGPT conversation was read as
design context; embedded older prompts remain reference material.

## Scope

1. Create a native SwiftUI app target depending on the existing local FitDataKit
   product. Keep environment/public project configuration separate from secrets,
   and leave signing and TestFlight distribution for the release phase.
2. Build login and session restoration around one Auth instance and the app's
   Keychain service. Handle loading, expired/revoked sessions, temporary network
   failures and sign-out/account switching without showing another user's state.
3. Implement a profile-first coordinator. A failed profile read offers Retry;
   it never creates a profile or routes to onboarding. A genuine missing row may
   begin onboarding; a partial profile resumes completion while preserving saved
   values. Read back every successful save.
4. Once the profile gate is satisfied, load each resource independently with the
   failure tier in DATA_LAYER.md. Clear account-specific in-memory state on
   account changes. Refresh local-day data on foreground/day/timezone changes.
5. Establish shared theme tokens and minimal reusable loading, empty and failure
   views. Use the updated five paired themes for auth and setup;
   Home and Workout layout implementation remains the subsequent screen phase.
6. Wire the existing opt-in smoke to two dedicated QA accounts and run real
   sign-in, own-row CRUD and cross-account rejection. Verify credential clearing,
   response handling and persistence through app relaunch, including negative
   network/profile states. Do not substitute a service-role query for this.

The sister apps continue to share the existing Supabase project and FitDataKit.
TrainerHQ's consent gateway remains the path for trainer-authorized cross-user
commands. Its actual native target must be identified before claiming both apps
have built against the package; no second hand-written data layer is introduced.

The actual target was located during Phase Two at
`/Users/johnbessemer/Downloads/TrainerHQ_Project_Source/TrainerHQ.xcodeproj`.
Its checked-in configuration uses the same Supabase origin. It currently depends
on `supabase-swift` 2.55.1, so shared FitDataKit adoption is still a concrete
integration task; locating the project does not establish completion.

## Continuation approval

The user preapproved Phase Three (Home) after Phase Two is finished and
double-checked. Continue under that approval once this phase's acceptance gates
are assessed; do not ask for another routine phase sign-off. Record any unmet
verification gate honestly rather than treating a fixture test as a live test.

## Database follow-up

The confirmed supplement-parent ownership gap has a separate additive proposal
and isolated verification. Deployment requires a recorded current recovery point
and the count-only preflight, then a real migration with the schema docs updated
in the same commit. No automatic cleanup of mismatched historical rows is allowed.
The server contract test must return both 156/156 assertions and
`supplement_parent_owner_enforced=true` before claiming the gap is fixed.

## Acceptance

The app builds and launches in Simulator; account switching cannot retain the
previous user's data; a deliberately failed profile read never triggers signup
or onboarding; partial-profile completion preserves existing values; actual QA
rows are re-read after mutation and removed after testing. Record console and
request failures, exact device/runtime and any remaining real-device limitation.
No Home fidelity, HealthKit, TrainerHQ adoption or TestFlight claim follows merely
from passing this auth/loading phase.
