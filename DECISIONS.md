# DECISIONS — WiFit

Decisions that took thought, with the reason attached. A decision belongs here
when the *obvious* thing to do is different from what the code does, so that the
next person does not "fix" it back.

This is not a changelog and not a bug list. Bugs live in
`docs/PROJECT_CONTEXT.md` §Known issues; the schema lives there too. Entries are
newest first and dated absolutely.

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

See `docs/PROJECT_CONTEXT.md` §Known issues #11 for the full entry.
`rules-of-hooks` is on as an **error** — it is what would have caught the
`RecipeCard` blank-screen. `exhaustive-deps` produces 7 advisory warnings and no
correctness gain today. Revisit if a stale-closure bug ever appears.

---

## 2026-08-29 — The `supplement_stack.category` CHECK constraint is deferred

See `docs/PROJECT_CONTEXT.md` §Known issues #14 for the SQL and the trigger to
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
