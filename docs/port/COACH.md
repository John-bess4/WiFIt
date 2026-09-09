# WiFit — AI coach contract (port reference)

Source: `api/coach.js` (edge function, the only server-side code) and
`src/lib/coach.js` (client contract). The coach is app-level, not part of the
shared data-layer package — but both iOS apps that offer it hit the same
endpoint and the same shared rate limit.

## Endpoint

`POST {origin}/api/coach` — a Vercel Edge function proxying Anthropic so the
`ANTHROPIC_API_KEY` stays server-side. **Never move the Anthropic call
client-side; never let the client choose the model.**

- Auth: the user's Supabase JWT as `Authorization: Bearer <access_token>`, read
  at call time. The function verifies it against `/auth/v1/user`, **rejecting on
  any non-2xx** — a bad/expired token is a **403** (not 401). Client maps 403 →
  "session expired, sign in again".
- Request body: `{ max_tokens: 1200, system: <string>, messages: [{role, content}] }`.
- Model: pinned server-side (`MODEL = 'claude-sonnet-5'`). Model IDs retire; the
  proxy passes `upstream.status` through verbatim, so a retired model surfaces as
  a 404 that looks like a missing deployment. **If the coach breaks, check MODEL
  first, then the rate table.**
- Response: `{ content: [{ type:"text", text }] }`. Client reads
  `data.content[0].text`. A 429 carries `Retry-After` and a message.

## Rate limit — 60/hour + 400/day per user, and it is SHARED

Counted in `ai_coach_usage` (one row per accepted request), keyed to `user_id`
(not IP — mobile NAT/rotation). **Counted on ENTRY**, before the Anthropic call,
so a caller cannot burn quota and retry for free; a failed usage write fails
**closed** (unrecorded usage is unenforceable). Over the limit → **429** with the
seconds until a slot frees (the Nth-newest request in the window aging out).

`RATE_PER_HOUR = 60`, `RATE_PER_DAY = 400`. No UPDATE/DELETE policy on
`ai_coach_usage`, so a user can't reset it (RLS.md).

> **This budget is shared across web prod + localhost + BOTH iOS apps on the same
> account.** During iOS testing on Johnny's account a 429 WILL look like a client
> bug. It isn't — check `ai_coach_usage` for the user first. Every client that
> offers the coach draws from the same 60/hour.

## Request assembly — `buildRequestMessages`, exactly once

`messages` = prior turns (`buildContextMessages`) + the new user turn **exactly
once**. If the caller already appended the new message to history, it is not
added again. Sending it twice made the model act on every request twice (two DB
rows 6 ms apart, #17). The first message must be `role:"user"` (Anthropic 400s
otherwise); leading assistant turns are dropped, the window is the last 10, and
consecutive same-role turns are merged.

**Applied-action replay:** an applied action (logged water, logged food, …) is
replayed into context as a short assistant line — `[Logged 16 oz water]`,
`[Logged: Egg 50 g]`, `[Proposed supplements: …]`, `[Gave a recipe]`, etc. — so
the model knows what it already did. Filtering these out entirely made the model
re-emit the previous turn's action alongside the next request.

Never replay our own error bubbles or the unprompted check-in as model turns.

## System prompt: live context + ACTIONS spec + hygiene

`buildSystem({liveContext, userName})` embeds `buildContextBlock(liveContext,
userName)` — a live-data block (name, time/meal-slot, calories consumed/remaining,
macros remaining, water, workout-done, the supplement stack with taken marks, the
recent weight trend) — then the ACTIONS contract. `liveContext` shape:
`{calGoal, calConsumed, protGoal, protConsumed, carbGoal, carbConsumed, fatGoal,
fatConsumed, waterOz, workoutDone, suppList[{k,name,sub}], suppTaken, suppTotal,
suppTakenMap, weightLog[{date,lbs}]}`.

### Reply format
```
ACTIONS:[{"type":"...", ...}, {"type":"...", ...}]|Your coaching message here.
```
One block per reply; multiplicity is inside the array. `parseActions`:
- Not an `ACTIONS:` reply → `null` (legacy prefix parsers still exist as a
  fallback but should be removed once the model stops emitting them; do NOT port
  them to Swift as a first-class path).
- Corrupt JSON fails **CLOSED** (a half-parsed array is never half-executed).
- Individual invalid actions fail **OPEN**: valid siblings commit, dropped ones
  are named to the user (silence here is the swallow bug the contract exists to
  kill). Cap 10 actions; overflow is reported.

### The six action types (`ACTION_VALID` gates each)
| type | payload | valid iff |
|---|---|---|
| `water` | `{oz}` | oz is a finite number > 0 |
| `food` | `{items:[{name,grams,slot,cal,protein,carbs,fat,fiber,sugar,sodium}]}` | ≥1 item, each with name, grams>0, finite cal |
| `meal_suggestion` | `{items:[{…,description}]}` | ≥1 item with a name (a proposal, not logged) |
| `supplement` | `{items:[{name,dose,timing,category,note}]}` | ≥1 item with name AND category ∈ the 8 purpose enum |
| `recipe` | `{name,ingredients[],steps[],…}` | name + ≥1 ingredient |
| `workout_plan` | `{name,exercises[],…}` | name + ≥1 exercise |

`food` items are absolute macros for `grams`; the client scales to per-100
(`per100From`) before writing `food_log`. `supplement.category` is checked
against the enum, not just presence — a bad category used to store an anonymous
grey dot.

### ACTION HYGIENE (hard rules, each fixed a duplicate row)
- ONE action per intent; its quantity is the amount in THIS message only ("16 oz
  of water" → `oz:16`, never the running day total).
- If nothing should be logged, the array is empty: `ACTIONS:[]|message`.
- Water/food are logged immediately (they have one-tap undo in the app);
  supplement / workout_plan / recipe / meal_suggestion render as **proposals**
  the user accepts.
- If the user already has a supplement in their stack, say so after the `|`
  rather than re-adding it.

## Port notes
- `callCoach(userMsg, history, {liveContext, userName})` and `applyActions(parsed,
  {onAddWater, onAddFood, onAddSupp}) → {messages, hasSupp}` are already
  params-object shaped in `src/lib/coach.js` — translate directly.
- Chat history persists per user (`wifit_chat_<uid>`, last 30, error bubbles
  never persisted) → a native store.
