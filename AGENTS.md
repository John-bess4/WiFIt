# AGENTS.md — WiFit

> Read automatically at the start of every agent session — Codex natively,
> Claude Code via the `@AGENTS.md` import in `CLAUDE.md`. Edit this file only;
> `CLAUDE.md` is a pointer, not a copy.

**Before touching any data code, read `docs/PROJECT_CONTEXT.md`.** It is verified
against the live schema and is the source of truth for tables, columns, the `sb`
wrapper, auth, and known issues. This file is the short list of rules; that file
is the map. If you change the schema, update it **in the same commit** — the last
time it drifted, three column-name mismatches shipped as silent HTTP 400s.

## What this is

Single-user fitness PWA: food logging with macros, workout plans and sessions,
supplements, water, body weight, AI coach. React 18 + Vite 5, deployed on Vercel
at `wifit.vercel.app`, backed by Supabase (Postgres + Auth, RLS on all 11 tables).

| Path | What |
|---|---|
| `src/App.jsx` | Almost the entire app — ~7,000 lines. Components, the `sb` client, auth, parsers. `HomeTab.jsx` and `src/lib/` are the first pieces outside it. |
| `src/main.jsx` | Mount point. |
| `api/coach.js` | Vercel Edge function proxying Anthropic. The only server-side code. |
| `supabase/migrations/` | Applied migrations, recorded after the fact. |
| `docs/PROJECT_CONTEXT.md` | Verified schema + architecture reference. |
| `docs/HANDOFF.md` | **Migration brief for the SwiftUI rewrite.** Bug archive by class, what survives, what is deliberately unfixed. |
| `docs/DECISIONS.md` | Why the code is the way it is, when the obvious thing differs. |

## Commands

```
npm run dev       # vite → http://localhost:5173
npm run build     # vite build
npm run preview   # serve the production build
npm run lint      # eslint 9, flat config; 25 known no-unused-vars warnings, 0 errors
npm test          # vitest, node env (+ jsdom per file); 107 tests, ~1.5s. TZ pinned for localDate.
```

Package manager is **npm** (`package-lock.json`). `npm test` is a deliberately
small vitest suite over the load-bearing logic — `parseActions`, `sb._fetch`'s
401 retry, `localDate`, `resolveSession`, macro scaling. It is a regression net,
**not** an integration check: it never touches the DOM, the database or a model.
The browser is still the only thing that proves a write landed, which is why the
verification rules below are not optional.

## The one rule that causes real bugs

`sb` is a hand-rolled Supabase REST client. **None of its methods throw.**

- `select` returns `[]` on *any* non-2xx — a 401, a 500, and "no rows" are
  indistinguishable. 15 call sites depend on this. **Do not change it.**
- `insert` / `upsert` return `null` on failure. A `try/catch` around them catches
  nothing. **Callers must check the return value** and surface the failure:

```js
const row = await sb.insert("food_log", {...});
if (!row) throw new Error("insert returned no row");
```

This gap is why users saw food and workouts "save" for months while the tables
stayed empty. `addFoodItem` and `saveWorkoutSession` do it correctly — copy their
shape. Ten call sites still ignore the return value (listed in PROJECT_CONTEXT
§Known issues); fixing one is always in scope.

## Verification (before reporting done)

Because `sb` swallows non-2xx, **a green screen is not evidence.** The failure
signal lives in the console and the network tab, so:

1. `npm run lint` — no new errors.
2. Run the affected flow in the browser with Playwright MCP:
   - `browser_console_messages` — any `[sb.<method>] <table> <status>` line is a
     failed write, even if the UI looked fine. This logging is the only reason
     past schema mismatches were ever found.
   - `browser_network_requests` — no non-2xx against the Supabase host.
3. For a write path, confirm the row actually landed — re-read it, or check the
   table — rather than trusting the optimistic UI update.

**If the AI coach breaks, check the pinned `MODEL` constant in `api/coach.js`
first** — then `coach_usage`: localhost proxies `/api` to production and shares
the user's 60/hour limit with every other client on that account. Model IDs retire; the proxy passes `upstream.status` through verbatim, so
a retired model surfaces as a 404 that looks exactly like a missing deployment.

## Conventions

- **String concatenation over template literals is intentional legacy. Do not
  "fix" it.**
- Dates go through `localDate()` — never `toISOString().slice(0,10)`.
- Read the routing rule in PROJECT_CONTEXT §Auth before changing navigation; the
  documented failure mode there is data loss.
- `App.jsx` is a known decomposition target. Do not start splitting it as a side
  effect of another task — that is its own deliberate piece of work.

## Never

- Commit `ANTHROPIC_API_KEY`, or move the Anthropic call client-side. It lives in
  the Edge function so the key stays server-side.
- Let a caller choose the model — `MODEL` is pinned server-side on purpose.
- Add `@supabase/supabase-js`. The hand-rolled `sb` client is the contract the
  whole app is written against.
- Change the schema without updating `docs/PROJECT_CONTEXT.md` in the same commit.
