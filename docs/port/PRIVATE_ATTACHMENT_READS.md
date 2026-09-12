# Private attachment reads and consent freshness

Fresh downloads in both native apps and the WiFit web portal use Storage’s
authenticated endpoint with a new `cacheNonce` UUID on every GET, plus disabled
local caching. Upload POST paths and operation UUIDs remain unchanged; their
independent byte verification also uses a fresh authenticated GET.

Live ordinary-QA evidence found cached HTTP200 private bytes after a trainer’s
message API correctly returned403 for paused consent. A fresh authenticated
request returned400/hidden-object immediately. Request Cache-Control:no-store
alone did not prevent the observed CDN HIT. No database policy was weakened or
changed; the existing bucket remains private.

The verified ownership contract preserves the client’s own archived conversation
history. Pausing a trainer denies their new reads. Removing messaging consent
revokes the trainer’s old membership and archives the direct conversation; later
regrant opens a new canonical thread instead of silently restoring old history.
The client keeps old history. An initial harness expectation that both parties
lose history, and a later expectation that old trainer access returns, were
incorrect and were corrected against the existing contract.

Evidence: `/private/tmp/wifit-phase8-live-media-cache-matrix.log` (active/paused
transport comparison); `/private/tmp/wifit-phase8-live-media-freshness-passed.log`
(pause and scope-denial checks before the corrected archive expectation);
`/private/tmp/wifit-phase8-live-media-final-readback.log` (9 passing final checks,
including archived trainer denial, original grant restoration, new-thread UUID
retention and new-thread access). Only disposable QA identities were used.

Fresh app requests recheck current access. Revocation cannot retract bytes already
delivered or copied by a recipient; old CDN responses are not evidence of current
permission. Native previews remain memory-only and clear when access changes.

Sources: [Supabase private downloads](https://supabase.com/docs/guides/storage/serving/downloads),
[cache bypass](https://supabase.com/docs/guides/storage/cdn/smart-cdn#bypassing-cache),
[download options](https://supabase.com/docs/reference/javascript/file-buckets-download).
