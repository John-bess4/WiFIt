# WiFitAppCore

App-specific SwiftUI state and profile completion over the shared `FitDataKit`.
This package owns no duplicated table DTOs, auth transport, or schema.

`AppCoordinator` is an observable main-actor coordinator. Inject an `AppService`
for deterministic negative tests, or use `LiveAppService(configuration:
keychainService:)`. The live adapter constructs one `Auth` and one REST client
sharing its session. Each app uses a distinct Keychain service.

The routing sequence is session → verified profile → independent resources.
A server/decoding/network profile failure stays `.profileFailure`; a received
auth denial enters `.sessionRecovery`. Only a successful missing/partial row can
show `.profileSetup`. No feature reads or automatic seed writes precede that gate.

Setup UI initializes from `coordinator.profileDraft` and captures the current
user UUID at the same time. Pass that captured UUID to
`rememberProfileDraft(_:userID:)` on field changes and
`completeProfile(_:userID:)` on submission. Never substitute the coordinator's
new current user at submit time: a draft with no original row has no embedded
owner. In-flight operations and retained rows also use account epochs.

Existing profiles use narrow PATCH completion values. A genuinely missing profile
uses `FitDataKit.createProfileIfMissing` with `resolution=ignore-duplicates`.
A concurrent profile creation is never overwritten by a full upsert; its empty
acknowledgement requires a fresh read. Every save reads back. A failed/unknown
write retains the draft and blocks another save until reconciliation. Rebasing
preserves actual edits and newly read fields changed by another app/device.

Thirteen resources hold typed payloads, failures and verification context. Meals,
water and supplement logs are today's rows; other resources include complete
paginated history or collections. Usage accounting and legacy workouts are absent.
Failed refreshes retain verified values with the failure visible. Day-scoped values
are cleared when the local day or timezone changes. `canWrite(dependingOn:)`
requires every dependent resource to have a successful current-context read and
checks the actual device day, even before a lifecycle event reaches the app.

Call `refreshForLifecycle()` on foreground, significant time/timezone changes and
the local-midnight timer. The package does not install lifecycle observers; the
native application owns that integration. It does not persist workout/chat drafts,
implement feature screens, or establish real JWT/Simulator verification by itself.

Run `swift test --package-path Packages/WiFitAppCore` on macOS. Coordinator tests
use controlled continuation gates for late responses, account switching and
profile-first ordering. Adapter tests assert JWT/owner/day query contracts without
using live accounts. The separate FitDataKit opt-in smoke and app UI tests remain
necessary for actual account/Keychain/relaunch evidence.
