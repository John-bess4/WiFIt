# TrainerHQ API contract (reference)

> **TrainerHQ is a separate app** sharing this Supabase project (see
> `PROJECT_CONTEXT.md` §TrainerHQ). This file documents the `trainerhq-api`
> edge-function contract so the Swift clients (WiFit-iOS and TrainerHQ-iOS)
> have it written down. It was reverse-documented from `src/lib/trainerAPI.js`
> — the JS client for the web consent flow (`/trainer-consent`, routed by
> `src/main.jsx`). WiFit sessions do not call this API; it is recorded here,
> not owned here.

## Transport

`POST {SUPABASE_URL}/functions/v1/trainerhq-api` with the user's Supabase JWT
(the `sb._fetch` bearer). `cache: 'no-store'`. One command per request.

## Command envelope

```
{ action: "<domain>.<verb>", payload: { ...fields, operation_id: <uuid v4> } }
```

- `operation_id` is a client-generated `crypto.randomUUID()`, added to every
  command's payload — the idempotency key. A retry of the same operation must
  carry the same id so the server can dedupe (writes must be idempotent on it).
- Success: HTTP 2xx, JSON body returned as-is.
- Failure: non-2xx; the client throws `body.error.message` when present, else a
  generic message. 401 is surfaced as "session expired, sign in again". A 200
  with an unreadable/`null` body is treated as an error, not as success.

## Actions observed (client side)

The full set lives in the `trainerhq-api` function; these are the ones the web
client issues. `<domain>.<verb>`:

- **account**: `account.get`
- **relationships**: `relationships.list`, `relationship.update`
- **assignments**: `assignments.list`, `assignment.accept`
- **invitations**: `invitation.review`, `invitation.respond`
- **messages**: `messages.list`, `messages.threads`, `messages.open`,
  `messages.read`, `messages.send`, `messages.create_group`
- **schedule**: `schedule.list`, `schedule.request_change`
- **tracking**: `tracking.get`, `tracking.configure`
- **device**: `device.register`

## Sharing categories (consent scopes)

The scopes a WiFit user grants a trainer. `nutrition` and `nutrition_adherence`
are **separate** permissions; granting one does not grant the other.

| scope | label |
|---|---|
| `workouts` | Workout information |
| `nutrition` | Nutrition history |
| `nutrition_adherence` | Nutrition adherence score |
| `supplements` | Supplement history |
| `sessions` | Session history |
| `progress_measurements` | Progress measurements |
| `progress_photos` | Progress photos |
| `health_summaries` | Health summaries |
| `messaging` | Messaging |

## Message attachments — client-side validation rules

Before fetching an attachment (`readAttachment`), the client rejects unless ALL
hold — and re-verifies the downloaded blob's size and type against the metadata:

- `bucket === "trainerhq-message-attachments"`
- `mime_type ∈ { image/jpeg, image/png, application/pdf }`
- `byte_count ≤ 10485760` (10 MiB)
- fetched from `/storage/v1/object/authenticated/<bucket>/<object_path>` with
  each path segment `encodeURIComponent`-ed
- after download: `blob.size === byte_count` and `blob.size ≤ 10485760`, and the
  returned Blob is re-typed to the declared `mime_type`

## Auth precondition

Every call requires a signed-in Supabase user (`sb.getUser()`); the client
throws "Sign in with your WiFit account…" before issuing the request. The
consent web flow runs `resolveSession()` first and registers
`setAuthLostHandler`, same as WiFit.
