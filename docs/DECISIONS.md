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

## 2026-09-07 — A claimed capability is the feature-level case of the lying class

Supplement reminders were a `setTimeout` in the current tab wrapped in
"Daily reminder — Notify me to take this supplement", a Settings section
offering "Daily push notification to train" and "Alerts for each supplement",
and two toggles wired to `()=>{}`. Nothing fired when the tab was closed,
backgrounded on iOS, or the phone was locked; what did fire fired once and
never re-armed; timers were never cleared. The UI was not showing a wrong
value — it was asserting a capability the platform does not have.

**Why it is the same class as "saved" on an unchecked insert.** Both are the
UI reporting an outcome it never observed. The value case lies about one row;
the capability case lies about every future event. A toggle that does nothing
is the purest form: it exists only to be believed.

**Decision.** Don't build web notifications. Make the UI say what the code
does: a time label plus an in-app nudge while the tab is open; no "notify",
no "push", no "alert" where none exists; dead toggles removed. What exists is
made correct (timers cancelled on unmount, re-armed daily). The real feature
is `UNUserNotificationCenter` in the iOS app — pre-launch, `PROJECT_CONTEXT`
#26 — which is one of the four reasons the rewrite exists at all.

**How to apply.** Read every toggle, banner and label as a promise and ask
what code keeps it. A promise with no keeper is removed or reworded before
launch, not after.

---

## 2026-09-07 — Derived values belong in the database, not in client state

**Decision.** When a value can be computed from rows we already store, compute
it in Postgres (a view, a generated column, or a query) rather than caching it
in client state and writing it back.

**Why.** `prHistory` was a client-side cache of per-exercise best weight — a
value `workout_sessions` already contained. Because it had its own writer, it
could drift from its source, and every one of the five PR bugs (P1–P5, audit
2026-09-07) was a form of that drift: computed at the wrong moment, from an
incomplete window, or never recomputed after the underlying set changed.
Replacing it with the `exercise_bests` view didn't fix five bugs individually;
it made four of them structurally impossible. A value with one writer cannot
drift.

**Second reason, specific to this project.** The SwiftUI client is a second
consumer of the same data. Derived state in the React client has to be
reimplemented in Swift, and any divergence between the two implementations is
a bug that only appears on one platform. Derived state in the database is
correct for both by construction and gets ported for free.

**When this does NOT apply.** Presentation formatting, values that are
genuinely per-session and never re-read, and anything where the query cost is
real and measured (not assumed). This is not an argument for pushing business
logic into Postgres generally — it's an argument against caching a derivation
next to its source.

**Three tests before caching a derived value:**
1. Can it be computed from rows we already store? If yes, default to
   computing it.
2. If it drifts from its source, does anything detect that? If nothing
   recomputes or reconciles, the drift is permanent and silent.
3. Would a second client reimplement this logic? If yes, the
   reimplementation is a future divergence bug.

**Corollary.** A derived read must fail loud. An empty `exercise_bests` read is
indistinguishable from a new lifter, and that branch stamps a genuine PR as
`false` — permanently, since nothing recomputes it. Use `selectAuth` and
surface the failure, per the laundering entry.

**Second corollary — a derived source of truth inherits the quality of its
source; there is no window that ages out a bad row.** The old cache had an
accidental safety valve: rebuilt from the last 20 sessions, a bad value fell
out of the baseline eventually. The view has no window. A test session with a
500 lb bench, left in `workout_sessions`, is now the user's permanent bench
PR baseline — no real bench will ever register as a PR again, and nothing in
the app can change that, because path #8 of the Train inventory (edit or
delete a logged session) does not exist. Product consequence, promoted to a
**required pre-launch item** (`PROJECT_CONTEXT` #25): a PR baseline with no
correction path is a permanent wrong number in the user's face. More
generally: the moment a derived value becomes the source of truth, every
write path into its source becomes a write path into the derived value, and
the user must be able to correct each one.

**One more thing it exposed.** `workout_sessions.exercises[].sets` stored each
set as its *display string* (`"10×80lbs"`), so any baseline computed from the
rows had to regex a render format. The migration adds `setsData: [{reps,
weight}]` alongside (backfilled once) and the view reads the number. A stored
value should never depend on how it was once formatted.

---

## 2026-09-07 — A stored derived value is only as right as the moment it was derived

`workout_sessions.prs` is the app's one computed-and-stored value, and nothing
ever recomputes it. The Train audit found it wrong in four independent ways,
each a different way of getting the *moment* wrong: decided at set-tick time
(before the user finished editing), from a truncated number (`parseInt`), against
an incomplete baseline (last 20 sessions), or against a baseline that was
silently empty (a 401 laundered to `[]`). Two sessions existed; zero were
corrupted; the fix went in before the third.

**What structurally prevents it.** Derive at the *commit boundary* from the
*final* state through *one* function (`computePRs`), against a baseline that is
either complete or explicitly unavailable — never silently partial. When the
baseline is unavailable, refuse to commit (Start is paused behind Retry) rather
than commit a value that looks decided. In Swift the same shape: the PR is a
pure function of (final session, complete history), evaluated once when the
session is saved, and history is `Result<[Exercise: Weight], Error>` — a
failure is a case, not an empty dictionary.

**How to apply.** For any value that is both computed and stored, ask three
questions before trusting it: when was it computed, from what, and what did
"unknown" look like at that moment? If the third answer is "the same as
empty", it is already wrong somewhere.

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

## 2026-09-07 — `daily_summary`: one definition per number, and it is numeric

**Decision.** The per-day numbers Progress shows (kcal/macros, workouts, supps
taken and due, weight) are computed by the `daily_summary` view; the client keeps
only a date spine and joins by day. `supplement_due_from` and `weight_monthly`
carry the two derivations that need history outside the range. The view returns
only days with data — a view that needs a range parameter is a function, a bigger
surface for no gain.

**Why.** Four places re-derived the same day totals (Home rail, Calendar,
Progress, `calc`), with two subtly different adherence denominators and a weight
read whose `limit:30` froze every weight number at row 31. The Swift port would
have reimplemented all of it. Deciding it once in SQL is what "derived values
belong in the database" means for aggregates.

**The rounding finding.** `round(per100 * grams / 100)` in Postgres `numeric` and
in IEEE doubles disagree on 21 of 3,996 exact-.5 products in a 0.1-step grid
(`32.3 × 500 / 100` is 161.5 exactly; the double is 161.49999999999997 → 161).
The owner's rows all agree today; the discrepancy is a bug on the JS side, not
the view's. Consequence: the view is the definition, the remaining JS derivations
are provisional, and Swift must not use `Double` for this — `Decimal`, or read
the view.

**Adherence denominator.** A supplement counts as due from
`least(created_at::date, first log_date)`. Retroactively punishing the user for
adding a supplement (29 misses on day 29 of 30) looked like the app punishing
them for using it; the first-log clause covers the UTC-vs-local day boundary
for a supplement logged on the local day it was created.

**Deferred on purpose.** `exercise_pr_events` (PR *events* as a read, deleting
`workout_sessions.prs`) is approved in principle but sequenced after #25 —
session edit/delete — so two structural changes to session data do not land in
the same week without a correction UI.

## 2026-09-07 — PR events are a read; the live banner is the only client PR logic

**Decision.** `exercise_pr_events` derives "this session set a PR for this
exercise" from `setsData` with a window over all earlier sessions. The client
stopped writing `workout_sessions.prs` and `exercises[].isPR`; the column stays
until a later migration drops it. The one PR computation left on the client is
ActiveWorkout's live banner — `computePRs` against `exercise_bests` loaded at
session start — because the session is not saved yet and no view can see it.

**Why #28 before #25.** An edit/delete UI built while `prs` was stored would
have had to maintain a derived column on every edit: recompute it (the work the
view deletes) or leave it stale (an edit feature that corrupts a column). With
nothing derived stored, edit/delete has nothing to maintain and the view
recomputes by itself.

**Why stop writing now and drop later.** A column drop is not reversible and
nothing is waiting on it. Stop the write, prove nothing reads it, drop at leisure.

**Verification shape.** Seeded history with three intended PRs and five decoys
(lower lift, tie, first-ever lift, same-day tie, bodyweight set); the view
returned exactly the three. Zero sessions → zero rows. Seeds deleted.

## 2026-09-07 — Session edit/delete: re-read is the state change

**Decision.** A session mutation (delete, set edit) never touches client state
directly. It writes, checks the result, and on success calls `retryHistory()`,
which re-reads history, `exercise_bests` and `exercise_pr_events` through the
same ok-keyed `selectAuth`. If that re-read fails, `historyStatus` is `failed`:
Start is paused and the History list is replaced by a message — not the
pre-mutation list, which is now wrong in a way that looks right.

**Why no optimistic delete.** The list is the last 20 rows. A local filter after
a delete leaves 19 while row 21 exists in the table — a silent wrong state,
where the re-read gives the visible right one. And the delete is not just a
list change: deleting the session that set a PR promotes a later lift, in a
card the user may not be looking at. Only the views know; only a re-read shows.

**Why whole-array PATCH and last-writer-wins.** PostgREST PATCH sets a column
to a literal; `jsonb_set` needs an RPC, a new surface with its own grants for a
race that needs two windows editing the same set in the same seconds. v1: the
editor re-reads the row when it opens (edits the current array, not the
mount-time copy) and `retryHistory()` after the write closes the window to the
seconds the editor is open. Accepted, documented, revisit if it ever bites.

**Scope held to reps/weight on completed sets.** Exercise name and date are the
views' group and ordering keys — editing either moves lifts between histories.
Adding or removing sets changes `sets_completed`/`total_sets`, which are stored
columns. All three are a second surface; none is the correction path
`exercise_bests` required.

**Sequence with #28.** `exercise_pr_events` landed first so this UI never had a
stored derived value to maintain: with `prs` unwritten, an edit has nothing to
recompute and nothing to leave stale.

## 2026-09-08 — Extract the port layer, not the components

**Decision.** The non-UI layer the Swift client must reimplement — the REST
client, nutrition arithmetic, dates, the coach contract, constants, workout
shapes, search — was extracted from App.jsx into `src/lib/`, one module per
commit, with zero JSX and no imports of App.jsx. The React components stay in
App.jsx.

**Why not decompose App.jsx.** The React UI is being replaced. Splitting
components we are about to rewrite is wasted work; what the port needs is a
named file list for the logic, so translation replaces excavation.

**Why now, before the Food/Train/Supps redesigns.** Each redesigned screen
imports the shared layer. Done screen by screen, the HomeTab ↔ App circular
import would have been fixed four times — and `useTheme` was the actual edge,
not any of the six modules first proposed: `theme.js` had to be in the set or
every later extraction still cycled.

**The one closure that was not a straight cut.** The coach's `buildSystem`,
`callClaude` and `applyActions` closed over the panel's props and state. They
take an explicit params object now (`{liveContext, userName}`; handlers for
`applyActions`, which returns `{messages, hasSupp}` and leaves `setMessages`
to the component). The `liveContext` shape is the contract the Swift client
builds — it was implicit before.

**Verification technique for a no-behaviour-change refactor.** Full suite,
lint count unchanged, and a byte-compare of 390×844 screenshots of all six
tabs against a baseline taken before the first commit, repeated after every
commit. Two things the technique had to learn: CSS *transitions* are not
covered by the reduced-motion rule (only animations), so the settle is 1.5 s;
and the same code renders the Home page gradient in two states that differ by
≤3 channel levels (GPU compositing), so the compare passes max delta ≤4 and
prints the numbers rather than being silent. A real change is 50–255. The
first commit's Food diff and the second's Home diff were both this, and both
were proved so before the commit went in — one by re-shooting three times,
one by decoding the PNGs and locating the pixels.

**A refactor's worst outcome.** `ACTIVITY` existed twice — the onboarding
array and ProfilePage's literal multipliers. Deduplicating them was approved
only with a test that keeps the old literal as the expected value and asserts
all seven, value for value: a silent TDEE change would have moved the number
the user lives by, inside a commit labelled "no behaviour change".

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
