# WiFit native app

Open `WiFit.xcodeproj` in Xcode 26.6 or later and select the shared `WiFit`
scheme. The minimum app OS is iOS 17. The project resolves two local packages:
`../Packages/FitDataKit` (the sister apps' database/auth contract) and
`../Packages/WiFitAppCore` (WiFit routing and profile completion).

`WiFit/Config/Shared.xcconfig` contains the public Supabase origin and
publishable key. These are client configuration; requests use the signed-in
user's JWT and RLS. No admin key, password or token belongs in that file.
An optional ignored `WiFit/Config/Local.xcconfig` can override build settings.
The provisional bundle ID is `com.wifit.gen2`; App Store registration, physical
device signing and TestFlight delivery remain release work.

The app stores credentials only in Keychain under `com.wifit.gen2.auth.v1`.
Local theme/appearance preferences use AppStorage and do not modify profiles.
Profile failure, absence and incomplete rows are distinct routes. All app data
loads use the single live service; no SwiftUI view constructs a REST client.

## Simulator verification

List available devices with `xcrun simctl list devices available`, then run the
following command from the repository root:

```sh
xcodebuild -project iOS/WiFit.xcodeproj -scheme WiFit \
  -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_UUID' \
  -derivedDataPath /private/tmp/wifit-ios-derived \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test
```

Use Xcode's ad hoc Simulator signing for Keychain tests. Disabling signing
can produce an app that builds and launches but cannot access secure storage.
It is not sufficient to replace Keychain with an in-memory fixture to make
those tests green.

The UI test target launches an explicit DEBUG-only synthetic service. It uses
the real FitDataKit Auth/REST code and a separate Keychain namespace for each
test session, with a transport that has no network fallback. Every test screen
is visibly labeled **UI TEST • SYNTHETIC DATA**. The fixture is excluded from
Release builds. Its profile rows last for a process; only its Keychain session
persists across app relaunch. This does not prove production data persistence.

Package checks:

```sh
swift test --package-path Packages/FitDataKit
swift test --package-path Packages/WiFitAppCore
```

The live two-account test is deliberately opt-in. See
`Packages/FitDataKit/Tests/FitDataKitTests/LiveSupabaseTests.swift` for the
external environment variables and cleanup behavior. No credentials should
be pasted into this repository or test output. A skipped live test is not a
successful authentication/RLS check.

Updated appearance references live in `design-reference/updated-themes`.
Phase Two establishes auth/setup and the resource status surface; the approved
Home phase follows the plan in `docs/GEN2_PHASE_THREE_HOME_PLAN.md`.
