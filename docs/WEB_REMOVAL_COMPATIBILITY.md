# Legacy web compatibility for WiFit data removal

This focused change makes the existing web app read the canonical account data
generation, stamp personal writes and recover explicitly when native data removal
has invalidated an old page. It preserves shared identity and assigned workouts.
It does not offer a new delete action or apply a migration.

The generation, cross-tab, account-switch and 401-retry tests cover stale writes
and retained assignments. The synthetic browser script exercises Home, a rejected
water write, recovery and a fresh Home load. Live disposable-account browser
acceptance and production deployment verification are recorded before rollout.

Validation: 210 unit tests pass; lint has 0 errors and the existing 22 warnings;
production Vite build passes. The synthetic browser flow passed Home → rejected
old-generation write → recovery → fresh Home (31 observed requests, only the two
expected 409 console messages). The ordinary-JWT live browser check captures the
real generation5, adds8oz with the existing canonical UUID, and restores only
that QA total. The ordinary UI returned HTTP200 for its existing-row upsert; the same canonical
UUID changed0→8oz, then the exact QA row was restored to0 and independently
verified using SQL. No Supabase failure or application error occurred. The
existing optional /favicon.ico request returns404 in local Vite and is recorded
separately. Earlier harness assertions were corrected for existing-row HTTP200
and explicitly awaited the write response before inspecting captured requests.

Evidence: /private/tmp/wifit-web-compat-{tests,lint,build,browser,live}.log.
The branch contains no inherited commits relative to origin/main.

No credentials, account tokens or private link addresses are included.

