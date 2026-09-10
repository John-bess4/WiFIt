# FitDataKit

The shared Swift data contract for WiFit and TrainerHQ. Add this local package
to each Xcode project and link the `FitDataKit` product. It supports iOS 17,
macOS 14 and watchOS 10 with Swift 6 and has no external dependencies.

Both apps use the same Supabase project and these models. Each app owns its own
Keychain session and UI coordinator. Trainer consent and privileged commands
remain behind the existing gateway; sharing a package grants no extra access.

## Connect a client

```swift
import FitDataKit
import Foundation

let configuration = try SupabaseConfiguration(
    url: projectURL, publishableKey: projectPublishableKey
)
let auth = Auth(
    configuration: configuration,
    store: KeychainSessionStore(service: appBundleIdentifier + ".supabase")
)
let database = SupabaseREST(configuration: configuration, auth: auth)

// Resolve the session first; the app chooses login/retry/loaded presentation.
let resolution = try await auth.resolveSession()
let credentials = try await auth.credentials()
let profile = try await database.readAll(ProfileRow.self)
let food = try await database.readAll(FoodLogRow.self)

let today = try LocalDay(date: Date())
let saved = try await database.save(value: WaterLogWrite(
    userID: credentials.userID, logDate: today, oz: 24
))
// Adopt saved.id. Water is a complete daily total, not an atomic increment.
```

The app must read/gate the profile before parallel resource loading. A failed
read is never an empty array or permission to seed data. `readAll` requests all
pages with a stable key order, exact totals and duplicate detection. Offset
pagination is not a database snapshot: simultaneous changes that leave the
count unchanged can still move rows between pages. Refresh after a concurrent
write; use a server snapshot/cursor contract if atomic exports are required.

## Writes and errors

`save(value:)` couples the row, table and conflict target. Inserts return the
server UUID; natural-key upserts preserve the existing UUID. `update` and
`delete` require UUID and owner filters and exactly one returned row. Views and
coach-usage rows are read-only through this client. Write DTOs validate before
the request and preserve nullable values. Complete DTOs encode nil as JSON null:
use a narrow `DatabaseWrite` PATCH DTO for a single setting, rather than creating
a mostly-nil `ProfileWrite` that clears other settings.

Handle `DataError` at the resource's specified failure tier:

- `http`, `decoding`, `invalidResponse` and `unexpectedRowCount` are failures,
  never successful empty states or a save confirmation.
- `authenticationRequired` means credentials are unavailable/revoked;
  `sessionChanged` discards a result from a previous account session.
- `outcomeUnknown` means a mutation may have committed. Retain the draft and
  reconcile its identity with the server before retrying. No automatic replay
  occurs after a network failure or server error.
- `storage` keeps the app from treating an unpersisted credential rotation or
  failed local credential deletion as complete.

Only an explicit HTTP 401 permits one refresh/retry. Concurrent refreshes share
one request; 403 is not treated as an expired token. No tokens, response bodies,
passwords or personal rows are logged. Use the project's public publishable/anon
key; never put a service-role or model-provider key in a client.

`Nutrition` uses Decimal and Postgres rounding. The five database views remain
the saved-data authority; `LivePRs` is only the unsaved-session exception.
Workout JSON preserves trainer assignment origin, extra metadata and original
IDs. Malformed historical sets retain issues and cannot be silently resaved as
zero values.

## Verify

On macOS with full Xcode selected, run from the repository root:

```sh
bash scripts/test-fitdatakit.sh
```

This runs deterministic tests, an unsigned iOS Simulator build and a watchOS
Simulator SDK cross-compile. The watch compile does not launch a watch app.
The [prepared CI workflow](../../docs/ci/README.md) also defines the existing web
build, lint and tests. It is inactive until GitHub workflow permission is available.

The real JWT/RLS smoke test is skipped by default. To run it, supply these
variables through a local credential mechanism outside source control:

```text
WIFIT_RUN_LIVE_TESTS=1
WIFIT_SUPABASE_URL
WIFIT_SUPABASE_PUBLISHABLE_KEY
WIFIT_QA_A_EMAIL
WIFIT_QA_A_PASSWORD
WIFIT_QA_A_USER_ID
WIFIT_QA_B_EMAIL
WIFIT_QA_B_PASSWORD
WIFIT_QA_B_USER_ID
```

Use two pre-existing dedicated QA accounts with their exact expected UUIDs.
The test writes temporary marked food rows, verifies CRUD and server RLS using
real user JWTs, then awaits bounded cleanup and session logout even on failure.
A cleanup failure reports only a recovery marker and fails the test. This test
does not prove every table's live transport, Keychain entitlements, the app
coordinator or TrainerHQ consent flows.

See [the accepted contract](../../docs/port/DATA_LAYER.md),
[live schema reference](../../docs/port/SCHEMA.md) and
[phase-one evidence and remaining work](../../docs/GEN2_PHASE_ONE.md).
