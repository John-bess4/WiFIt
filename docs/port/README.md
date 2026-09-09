# docs/port/ — the WiFit → SwiftUI migration package

Written 2026-09-09 for two Swift clients (WiFit-iOS, TrainerHQ-iOS) built against
this Supabase project. Evidence-backed, not summaries: schema from
`information_schema`, RLS proven from a real JWT.

| File | What |
|---|---|
| [SCHEMA.md](SCHEMA.md) | every WiFit table/view: columns, types, nullability, defaults, `on_conflict` targets; TrainerHQ tables marked present-but-out-of-scope |
| [RLS.md](RLS.md) | per-table policies + what a user JWT can actually read/write, proven from a client (the MCP bypasses RLS) |
| [DATA_LAYER.md](DATA_LAYER.md) | **the shared Swift package spec** — client surface, selectAuth ladder, on_conflict, Decimal math, view reads, uuid write-back, 401 retry |
| [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md) | every user-reachable function → ported / native / v1? / cut |
| [COACH.md](COACH.md) | `/api/coach` shape, ACTIONS format + 6 types, exactly-once rule, replay, hygiene, the shared 60/hr limit |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | reimplement / don't / platform gap / pre-launch blocker |

Read alongside, not duplicated here: `../PROJECT_CONTEXT.md` (live reference +
numbered known issues), `../DECISIONS.md` (why the code is the way it is),
`../HANDOFF.md` (the rewrite brief), `../TRAINERHQ_CONTRACT.md` (the trainerhq-api
contract). > `docs/PORT_READINESS_GATES.md` was referenced in earlier sessions but never
> actually landed in the repo. Do not look for it — **this `docs/port/` package
> supersedes it.**

The JS to translate is `src/lib/` + `HomeTab.jsx` + `src/lib/ui.jsx`.
