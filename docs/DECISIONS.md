# DECISIONS — WiFit

Decisions that took thought, with the reason attached. A decision belongs here
when the *obvious* thing to do is different from what the code does, so that the
next person does not "fix" it back.

This is not a changelog and not a bug list. Bugs live in
`PROJECT_CONTEXT.md` §Known issues; the schema lives there too. Entries are
newest first and dated absolutely.

**A native SwiftUI rewrite is planned** (see `PROJECT_CONTEXT.md` §Where
this is going). That is the main reason this file exists: the rewrite should
inherit these lessons rather than rediscover them. So entries say what would
**structurally prevent** a problem, not that someone should have been more
careful.

---

## 2026-09-06 — Verify reachability before fixing reachability

**A code pattern that permits a bug is not the same as a bug a user can reach.**
Before fixing a failure mode, exercise it in the running app. If it cannot be
reproduced, that is the finding.

**Why.** Commit `0e032ee` persisted the in-progress workout and justified it in
its message like this:

> Every tab renders as `{tab===X && <Component/>}`, and activeWorkout lived in
> WorkoutTab. Tapping Food or Supps between sets — normal behaviour in a workout
> app — unmounted the tab and destroyed the session.

The pattern is real. The conclusion was false. `ActiveWorkout` renders as
`position:fixed`, inset 0, opaque `T.bg`, `zIndex:190` (`App.jsx:3606`); the
bottom nav is `zIndex:99` (`App.jsx:7007`); `App`'s root is `position:relative`
with no `z-index`, so it creates no stacking context and 190 simply wins. **The
nav is unreachable during a workout, so the tab switch could never happen.**

Both z-index values have been what they are since the first commit `eca72a5`.
The failure mode was never reachable at any point in the project's history.

The check that would have caught it, run in the app during a workout:

```js
const label = [...document.querySelectorAll('div')]
  .find(d => d.textContent === 'Train' && d.style.fontSize === '10px');
const r = label.getBoundingClientRect();
document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
// -> a set row inside ActiveWorkout, NOT the nav item.
```

It returns a workout row. One tap, or three lines in the console, against a
reasoning chain that ran from a real pattern to a wrong conclusion and shipped
with a confident commit message. Neither the author nor the reviewer ran it.

**How to apply.** Reading the code tells you a bug is *possible*. Only the
running app tells you it is *reachable*, and `AGENTS.md` §Verification already
says a green screen is not evidence — this is the same rule pointed at the
premise instead of the result. Reproduce first, then fix. When you cannot
reproduce, write down why not: that is the more valuable finding, and it is the
one that does not survive being left in someone's head.

---

## 2026-09-06 — The workout snapshot stays, justified by reload and eviction

The `wifit_workout_<uid>` snapshot from `0e032ee` is kept, with its stated
reason corrected. It is **not** protection against tab switching (see above,
which was never possible). It is protection against the app being torn down and
rebuilt underneath a live session.

**Why.** The remaining exposure is not theoretical for a phone in a pocket
during a 45-minute workout: hard reload, accidental refresh, the OS evicting a
backgrounded tab, the tab being closed. One detail makes this sharper than it
first looks — `index.html` sets `apple-mobile-web-app-capable` but the project
has **no service worker and no manifest**. On iOS "Add to Home Screen", a
backgrounded standalone web app frequently gets a **full reload** on return. For
the phone-in-pocket case the reload is not an edge case; it is close to the
normal path back into the app.

Everything else the snapshot does — per-uid keying, sign-out clearing, the 6h
age rule measured from `startedAt`, the 500ms debounce — is independent of how
the user navigates and is unaffected by the correction.

**How to apply.** Keep the mechanism, cite the right reason for it. A right
answer resting on a wrong premise is one refactor away from being deleted by
someone who checks the premise.

### How to test a restore without fooling yourself

Verified end to end on 2026-09-06 against a signed-in account. Recording the
**method**, because the obvious test is worthless here:

> "Reload and the sets are still there" is passed identically by a workout that
> never unmounted. The state that survived a reload and the state that survived
> because nothing tore down look the same from outside.

**The discriminator: mutate the snapshot in `localStorage` after the app writes
it, then reload.** Injected values exist only on disk, so if the restored UI
shows them, the state provably came off disk — in-memory React state cannot
produce a number written to storage after it was captured.

Concretely: tick 3 sets, type weight `185`, wait past the 500ms debounce, then
rewrite the stored snapshot with weight `999` and `startedAt` backdated 20
minutes. React state holds `185` and a 15-second-old start; storage holds `999`
and 20 minutes. The two sources now disagree, so the reload has to pick a side.

| After reload | Means |
|---|---|
| `999`, elapsed `20:19` | read from storage — **pass** |
| `185`, elapsed `00:05` | never unmounted — **fail** |
| empty workout list | snapshot not read — **fail** |

Observed: `999`, `20:19`, banner "Resumed · started 8:12 PM". Supporting proof
the context was destroyed: a `window.__probe` nonce set before the reload came
back `undefined`.

The negative cases are what actually prove the rules, and each needs its own
discriminating assertion:

- **6h staleness.** Backdate `startedAt` 7h while setting `savedAt` to *now* —
  that separates "age judged on start" from "age judged on last save". Assert
  not just that nothing restored, but that **the key was removed**:
  `readWorkoutSnapshot` does `removeItem` before returning null, so key-absent
  proves the staleness branch ran. Without that, a mistyped key name passes
  identically.
- **Foreign uid.** Plant `wifit_workout_<other>` holding a workout named
  `LEG DAY SENTINEL`. Assert the sentinel never renders, **and** that the
  foreign key is byte-identical afterwards — not read, not deleted. Assert no
  bare / `undefined` / `null` key was ever created.
- **Clearing.** Cancel → *Keep going* must **leave the key intact** (this is the
  case that catches a dialog wired to clear on open); Cancel → *Discard* and
  Finish must both clear it, with a following reload restoring nothing.

---

## 2026-09-06 — Cancel asks; the nav dot stays

Two affordances around the same session, deliberately not merged.

**Cancel confirms when there is work to lose.** It is the only exit that
destroys a session — it clears the snapshot as well as the state, so nothing
survives it, not a reload and not the dot. It is also 13px of text in the
top-left corner, exactly where a thumb reaching for the back-swipe gesture
lands. The dialog is gated on `doneSets > 0`: starting a workout and immediately
changing your mind still closes on one tap, because a dialog with nothing to
warn about is only friction.

**The nav dot stays, and the resumed-session banner does not replace it.** The
dot has two feeds. `onActiveChange` (`App.jsx:3808`) fires while the workout is
live — and every dot it sets is behind the `zIndex:190` overlay, so it is never
seen. App's mount seed (`App.jsx:6876`) reads the snapshot on `[uid]`, and that
one is visible: after a reload the user lands on Home with the nav showing.

It is tempting to conclude the dot is dead and a banner inside the workout view
should replace it. Two things say otherwise:

- After a reload `activeWorkout` is null until `WorkoutTab` mounts, so
  `ActiveWorkout` is not rendered at all. **A banner inside the workout view
  cannot advertise its own existence.** The dot is the only thing that can tell
  a user sitting on Home that there is a live session to come back to.
- The unobservable feed is not useless either. Its *set-true* is never seen, but
  its *set-false* is load-bearing: finish and cancel both null `activeWorkout`,
  which is what clears a dot the mount seed set. Remove that feed and the dot
  survives finishing the workout.

They answer different questions — "there is a session, come back" versus "the
sets and clock you are looking at were carried over, not invented" — so both
exist.

---

## 2026-09-06 — USDA `servingSize` is trusted only when the unit says so

`usdaServingGrams` (`App.jsx`, above `searchUSDA`) reads `servingSizeUnit`.
Grams pass through, ounces convert at 28.3495, **everything else returns null**.

**Why.** The old code was `servingG: f.servingSize || null` — the number taken
regardless of the unit beside it. USDA reports `ml`/`MLT` for drinks, `IU` for
vitamins, `oz` for some branded packs. So a 414 ml shake became 414 g, and a
5000 IU vitamin D rendered as "5000g/serving" in the supplement list.

Ounces convert because 1 oz **is** 28.3495 g — a unit conversion, not a guess.
Millilitres do not, because ml→g needs a density, and density is a property of
the food. The custom-food form already refuses to guess precisely this (it makes
the user supply grams for food-dependent units), and §Known issues #3 documents
the app already holding two contradictory positions on what a cup weighs. This
side does not add a third.

null is safe here because the food UI already handles it honestly: it falls back
to 100 g **and says so** ("1 serving = 100g"). A disclosed default beats a
silent wrong number.

**How to apply.** When an external API hands you a number and a unit, the unit
is part of the value. Dropping it is not simplification.

---

## 2026-09-07 — "The model did it twice" was the client asking twice

Two identical `food_log` rows 6 ms apart, `water_log` at 32 for "16 oz". The
chat log showed two water cards from one reply, the second carrying the
client's default text — so the model *had* emitted two actions, and the first
diagnosis was "the model hedged; contract decision". That diagnosis was wrong
in a way worth recording.

**What actually happened.** `send` passed `[...messages, userMsg]` as history
and `callClaude` appended `userMsg` again. Every request ended with the user's
message twice. The model logged what it was asked, twice — and on a cleared
chat, after the prompt was tightened, it said so out loud: "Logged both 16oz
entries". Not hedging. Obedience.

**Why the first diagnosis was wrong.** It stopped at the model's *output* and
never read the model's *input*. The screenshot, the DB rows and the stored
cards all describe the reply; none of them describe the request. A duplicate
in the output has two candidate causes — the model, or what it was shown — and
only the request body separates them. The prompt tightening that followed was
work against the wrong cause; it made the model *explain* the duplicate
rather than stop it.

**What structurally prevents it.** Request assembly is one pure function,
`buildRequestMessages(userMsg, history)`, and its test asserts the new turn
appears exactly once. Before, assembly was split across two functions with an
implicit contract about whether `history` already contained the new message
— the kind of contract that lives in nobody's head. In Swift the same shape:
build the transcript in one place, from a value type, and make "append the
current turn" the builder's job rather than the caller's.

**How to apply.** When the model appears to misbehave, read the request
before the reply. Log or replay the exact `messages` array. A verify pass on
a model integration is not complete until it has looked at both sides.

---

## 2026-09-07 — A correct write with a stale literal is its own bug class

`OnboardingWizard`'s profile upsert wrote `theme:"dark"` — right table, right
column, checked payload, wrong **content**: the pre-families shape, three
schema fixes stale. It sat through the entire data-layer audit because that
audit was scoped to write *paths* (does the write happen, is the result
checked, do the columns exist). This was a write *value*. Found only because a
verify account created on the new code came back with `theme = "dark"`.

**Why it is a separate class.** Every check in the archive is structural:
column exists, NOT NULL satisfied, `on_conflict` named, return value read. A
stale literal passes all of them. It is not caught by the type of the column,
by the request succeeding, or by the UI — the wizard rendered under the app
default and never read the value back. The only detector is a **reader that
expects the current vocabulary**, and `resolveTheme` silently coerced the
old one to a default instead of noticing.

**What structurally prevents it.** Put the vocabulary in one place and write
*through* it: the fix here is `theme: DEFAULT_THEME_KEY`, a constant every
reader also uses, not a string. In Swift this is an enum with a raw value —
`Theme.pastelLight.rawValue` — and a literal `"dark"` cannot be assigned to a
`Theme` at all. In Postgres it is the CHECK constraint the category column is
still waiting for (§Known issues #14): the database refuses the stale shape
instead of storing it. And for the reader side, a legacy branch that keeps the
user's intent (bare `"dark"` keeps dark) rather than a fallback that quietly
replaces it.

**How to apply.** When auditing writes, grep the *payloads* for literals, not
just the call sites — multi-line payloads hide them from one-line greps. The
sweep on 2026-09-07 found one other: `workout_plans` insert writes
`sort_order:0` for every new plan. Harmless today (nothing orders by it) and
logged rather than changed.

---

## 2026-09-06 — Fire-and-forget async is a different bug from an ignored result

`App.jsx:4337` is not a variant of "ignored return value". It is a distinct
class, and the rewrite should treat it as one.

```js
setSuppList(prev=>{
  const arr=[...prev];
  const [moved]=arr.splice(from,1);
  arr.splice(i,0,moved);
  if(uid){
    arr.forEach((s,idx)=>{
      try{sb.update("supplement_stack",{sort_order:idx},{filter:"id=eq."+s.k+"&user_id=eq."+uid});}catch{}
    });
  }
  return arr;
});
```

**The failure is not ignoring a return value. It is never waiting to learn there
was one.** Every other site in §Known issues #1 at least resolves before its
handler returns, so the value exists and is discarded. This one does not
`await`, so nothing observes success, failure, or even a rejected promise. The
drag-reorder appears to persist, the list re-renders in the new order from local
state, and whether Postgres agreed is information the app never had.

Two things make it worse than the un-awaited call alone:

- **It runs inside a React state updater.** `setSuppList(prev => {…})` must be a
  pure function of `prev`. StrictMode is on (`src/main.jsx`), and React
  double-invokes updaters in development, so N supplements fire **2N** writes on
  every reorder in dev — a rate the code never intended and nobody would see,
  because nothing reports.
- **The `catch{}` compounds it**, for the reason in the entry below: it is
  wrapped in exactly the shape that stops a reviewer looking.

**What structurally prevents it.** Not discipline — the language. In Swift,
calling an `async` function without `await` is a **compile error**
("expression is 'async' but is not marked with 'await'"). Fire-and-forget stays
possible, but only by writing `Task { … }`, which is a visible, greppable
declaration that you meant it. `@discardableResult` inverts JavaScript's
default: discarding a result warns unless the *API author* marked it
discardable, so the decision lives once at the definition instead of silently at
every call site. And typed throws (`throws(DBError)`) put the error channel in
the signature, so "this can fail" is checked rather than remembered.

That is the whole shape of the fix: make ignoring a result a **deliberate,
visible choice** rather than something that happens by omission. The current
`sb` contract is the exact opposite — `null` on failure, no throw, nothing that
notices when a call site says nothing.

Until then, in JS: the reorder write should be awaited and batched (one call,
not one per row), and moved out of the state updater into an effect or handler.
`eslint-plugin-promise`'s `catch-or-return` would catch the floating promise;
it is not currently installed.

---

## 2026-09-06 — A catch block around code that cannot throw is worse than none

Five sites share this shape (`App.jsx` 2924, 4228, 4236, 4251, 6623):

```js
try{ await sb.delete("supplement_stack","id=eq."+k+"&user_id=eq."+uid); }catch{}
```

**`sb` never throws.** `select` returns `[]` on any non-2xx; `insert`/`upsert`/
`update`/`delete` return `null`. So the `catch` is not empty-by-oversight, it is
**structurally unreachable** — no execution path can enter it. The `null` sails
straight past and the delete silently fails.

**The property worth recording: code that performs safety is more dangerous than
code that visibly lacks it.** A bare unchecked `await sb.delete(…)` looks
unfinished, and a reviewer reads on. This looks considered. The `try`/`catch`
is a claim that failure was thought about, and it costs a reviewer the one
signal that would have made them check. Five sites carried that claim for
months. The empty `catch{}` even reads as a deliberate "failure here is
acceptable" — a decision nobody made.

This is why it is filed separately from "ignored return value". The ignored
return is an omission; this is a **false positive in the reader's model of the
code**. Omissions get found by grep. False assurances do not, because nobody
greps for the thing that already looks handled.

**What structurally prevents it.** Swift refuses to compile the lie. `try` on a
non-throwing call warns ("no calls to throwing functions occur within 'try'
expression"), and the handler itself is diagnosed — "'catch' block is
unreachable because no errors are thrown in 'do' block". The mismatch between
where errors actually come from and where the code claims to handle them is a
**compile-time** disagreement, not something a reviewer has to hold in their
head across 6,800 lines. With typed throws the signature states which errors are
possible, so an impossible handler cannot be written by accident.

The deeper point for the rewrite: `sb`'s "never throws, returns null/[]" contract
is what makes both of these classes possible. It is load-bearing here and must
not change (16 `select` call sites depend on `[]`, see §Standing conventions),
but it is a contract carried entirely in prose. Anything that replaces it should
put failure in the type — `Result`, a typed `throws`, an optional the compiler
forces you to unwrap — so that "I did not handle this" becomes something the
build says out loud.

See `PROJECT_CONTEXT.md` §Known issues #1 for the full table of all 10
sites. Both classes are documented there, not fixed.

---

## 2026-08-29 — `completed_date` derives from `startedAt`, not `today`

A workout session is dated from when the work **started**, not from when Finish
was tapped and not from `today`.

**Why.** `today` is computed once per `App` mount (§Known issues #8), so a
session resumed after a reload took whatever day the app last mounted on — the
stamped day was an accident of mount timing. And an 11pm session finishing at
12:30am belongs to the day it was trained. Deriving from `startedAt`, which the
session already carries, makes both cases correct without touching the
`today`-per-mount limitation itself.

The snapshot's staleness rule follows the same logic for the same reason: it is
an **age** rule (6h from `startedAt`), not a calendar-day rule, because a
calendar-day rule misfires on exactly that 11pm session.

**Exercised 2026-09-06** with Playwright's clock API, which is the only way to
reach this case on demand — the 6h window means a cross-midnight restore is
otherwise only reproducible between 00:00 and ~06:00 local. Clock installed at
**23:50**, workout started, fast-forwarded 30 minutes to **00:20**, then
**reloaded** so `App` remounted on the *following* day before the session was
restored and finished. That reload is what makes the test discriminate: without
it, `today` and `localDate(startedAt)` are the same day and both the old and new
implementations pass.

Result: mounted on `2026-09-07`, stamped `2026-09-06`. Confirmed in Postgres,
not just the UI — `workout_sessions` row `completed_date 2026-09-06`,
`duration_secs 1815`, against a real `created_at` of `2026-09-07 03:35Z`. The
pre-fix code would have written `2026-09-07`.

The arithmetic is pinned in `src/__tests__/sessionDate.test.js` so it keeps
running in CI; the wiring is what needed the browser.

**Playwright clock gotcha, learned the expensive way.** `page.clock.install()`
is **context**-level and has no `uninstall()` in this version. `setSystemTime`
+ `resume()` makes `Date` read correctly again, but the fake timers stay
installed — and Playwright's own screenshot stabiliser runs on in-page timers,
so **every `page.screenshot()` afterwards times out** with no useful message.
Twelve screenshots failed in a row before the cause was found. After any clock
test, close the browser and reopen: the persistent profile keeps the session.

**Second cause of the same symptom (2026-09-07):** an *occluded* tab. When
another tab is in front, Chromium stops giving the page frames, so
`page.screenshot()` times out AND CSS transitions never advance — the fan's
items read `opacity: 0` forever while the FAB's inline transform said "open".
Not a code bug either time. `await page.bringToFront()` first; then a
screenshot takes ~90 ms. A verify run that cannot screenshot should call that
before concluding anything about the UI.

---

## 2026-08-29 — Snapshot keys are per-uid, and no uid means no key

`workoutKey(uid)` returns `null` when there is no uid, and every read, write and
clear is a no-op on a null key.

**Why.** Four accounts exist. An unkeyed snapshot would restore one person's
workout for another on a shared device. Writing a bare
`wifit_workout_undefined` would be that same leak wearing a different name, so
the absent-uid case returns null rather than a fallback string.

**Consequence worth knowing:** demo mode has no uid (`uid` is
`sb.getUser()?.id`, and demo has no session), so **the snapshot and restore path
cannot be exercised in demo mode at all**. Verifying anything that depends on a
restore needs a signed-in account. This is the design working, but it is a real
gap in what browser verification can cover without credentials.

---

## 2026-08-29 — `react-hooks/exhaustive-deps` is off on purpose

See `PROJECT_CONTEXT.md` §Known issues #11 for the full entry.
`rules-of-hooks` is on as an **error** — it is what would have caught the
`RecipeCard` blank-screen. `exhaustive-deps` produces 7 advisory warnings and no
correctness gain today. Revisit if a stale-closure bug ever appears.

---

## 2026-08-29 — The `supplement_stack.category` CHECK constraint is deferred

See `PROJECT_CONTEXT.md` §Known issues #14 for the SQL and the trigger to
apply it. Short version: the unvalidated legacy `ADD_SUPP` path is live until C2
retires it, so the constraint today would turn a model's out-of-enum response
into a failed insert that the user reads as "check your connection" — a database
error surfacing as a network error. Apply it as the first commit after C2.

---

## Standing conventions

These are not dated decisions so much as long-standing ones. `AGENTS.md` is the
enforceable short list; the reasons are here.

- **`sb` never throws.** `select` returns `[]` on *any* non-2xx — 401, 500 and
  "no rows" are indistinguishable, and 16 call sites depend on it. `insert` /
  `upsert` return `null` on failure, so `try/catch` around them catches nothing
  and **callers must check the return value**. This gap is why food and workouts
  appeared to save for months while the tables stayed empty. Do not change the
  wrapper; fix the callers (§Known issues #1 lists the 10 that still ignore it).
- **String concatenation over template literals** throughout `App.jsx` is
  intentional legacy, not an oversight. Do not "fix" it.
- **`MODEL` is pinned server-side in `api/coach.js`** and callers must not be
  able to choose it. Dateless IDs are still snapshots, not evergreen pointers —
  a retired model surfaces as a 404 that looks exactly like a missing
  deployment. Check it first when the coach breaks (§Known issues #10).
- **`App.jsx` is a known decomposition target**, but splitting it is its own
  deliberate piece of work — never a side effect of another task.
