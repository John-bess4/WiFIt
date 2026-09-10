# Phase two proposal — native authentication and loading

Phase one provides the shared package and a reviewed database contract. The next
phase creates the WiFit iOS application target and connects that foundation to
real authentication and honest loading states. This proposal is the sign-off
point required by the original kickoff; it does not claim implementation.

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
   views. Use the supplied screenshots' pastel/lavender style for auth and setup;
   Home and Workout layout implementation remains the subsequent screen phase.
6. Wire the existing opt-in smoke to two dedicated QA accounts and run real
   sign-in, own-row CRUD and cross-account rejection. Verify credential clearing,
   response handling and persistence through app relaunch, including negative
   network/profile states. Do not substitute a service-role query for this.

The sister apps continue to share the existing Supabase project and FitDataKit.
TrainerHQ's consent gateway remains the path for trainer-authorized cross-user
commands. Its actual native target must be identified before claiming both apps
have built against the package; no second hand-written data layer is introduced.

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
