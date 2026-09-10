# WiFit Gen 2 design reference

**Latest update (2026-09-09 Pacific):** the user supplied five new paired
light/dark theme families and three page concepts during Phase Two. See
[updated-themes/README.md](updated-themes/README.md) for the current background,
surface and palette authority. The earlier references below retain layout
context where the newer examples do not replace it.

The user's supplied screenshots are the authority for **Home and Workout
layout, hierarchy and proportion**. This supersedes contradictory bundle and
Claude conversation prose. The user approved coherent improvisation for other
screens using the same design theme. The screenshots are visual references;
their sample records must never be loaded as a real user's data.

## Reference files

| File | Role |
|---|---|
| [screenshots/home-layout.png](screenshots/home-layout.png) | Supplied Home layout, showing the pastel and dark variants side by side |
| [screenshots/workout-layout.png](screenshots/workout-layout.png) | Supplied Workout layout, including Today/My Plans/History, body figure and exercise rows |
| [home-reference.html](home-reference.html) | Supplementary historical Home rendering; useful for styling details only where consistent with the screenshots |
| [themes.js](themes.js) | Existing palette source, to be translated to centralized Swift theme tokens |

The PNGs retain the supplied images, not regenerated approximations. Original
attachments were named `Screenshot 2026-09-09 at 5.32.20 PM.png` (Home) and
`Screenshot 2026-09-09 at 5.34.06 PM.png` (Workout). The HTML and palette export
do not overrule the newer screenshots or the user's latest design direction.

## Home layout

Use a narrow, single-column mobile layout with generous rounded corners and
small, consistent gaps. Preserve this order and relative emphasis:

1. Compact date/greeting header with small action chips/avatar.
2. Rounded week rail, seven daily rings, quiet calorie labels and a small
   on-target summary.
3. Large calorie hero with a broad semicircular gauge, oversized number,
   spaced compact labels and supporting eaten/burned positions.
4. One compact protein/carbs/fat row with thin progress tracks.
5. Today's workout card, strong name, small plan metadata and Start action.
6. Slim water row with droplet, progress track, amount and +8 action.
7. Supplement stack card with pill/capsule blocks and a concise status footer.
8. Meals-today card with restrained separators and compact metadata.
9. Persistent Home/Food/Train/Supps tab bar with raised central quick add.

Pastel is the initial palette: pale mint/lavender/pink surfaces, bright but soft
accents and dark readable text. The supplied dark example keeps the same layout
with deep violet surfaces, vivid magenta/cyan accents and light text. Color
changes must come through one theme system, not different hardcoded view code.

The calorie hero is visually dominant. Section headings are compact; data
numbers and tracked labels use a consistent monospaced treatment where shown.
The reference uses fine borders, soft translucent surfaces and controlled
gradients/shadows. Preserve that balance instead of adding unrelated effects.

The screenshot's burned number is a data dependency, not permission to invent
calories. Until a verified source exists, adapt that supporting area honestly.
Use live profile goals and successful summary reads; preserve the hero/card
structure for empty, unavailable and loading states. Retain weight logging and
coach access through coherent secondary entry points without crowding the
specified hierarchy.

## Workout layout

Preserve the large Workout title and top-right outlined + New action. Below
it, use the Today / My Plans / History segmented control, then horizontal
plan chips. The selected plan card places a tappable front/back body figure
on the left and plan information, primary/secondary muscle legend and Start
action on the right. Exercise cards below use a small colored marker, strong
exercise name, quiet muscle/sets/reps/weight line and right-aligned volume.

The screenshot is light, with warm off-white background, near-white cards,
lavender borders/text and purple actions. It shares Home's rounded cards,
compact data labels, tab bar and raised quick-add treatment. Adapt it through
the same palette tokens for dark themes. Do not trace the old React Train UI.

The figure and muscle emphasis are presentation assets/mappings. Do not invent
new schema columns because the screenshot contains an illustration or label.
Use real selected-plan data for names, duration, set counts and volume. A blank
account has an honest create-plan state; a failed read has Retry; the sample
Leg Day plan and listed lifts are never automatic seed data.

## Shared native implementation rules

- Implement shared Card, SectionHeader, EmptyState, FailedState, MacroRow,
  typography and tab/quick-add components once.
- Views consume semantic theme tokens. Keep color literals in the theme registry.
- Use native layouts for Food, Supps, auth, Profile, Settings, Calendar,
  Progress and trainer screens, preserving the visual family and behavior in
  [FEATURE_INVENTORY.md](../docs/port/FEATURE_INVENTORY.md).
- Failure and unknown data remain visibly distinct from empty/zero. Screenshot
  fidelity never turns a failed read or unconfirmed save into apparent success.
- Match composition at an iPhone viewport; account for safe areas and the home
  indicator without obscuring the final card or quick-add controls.
- Verify at 390×844 and on real hardware. Check both supplied theme directions,
  scrolling, larger text, hit targets, contrast, safe areas and OLED gradients.
  Document differences that are needed for real data or accessibility.

This reference establishes the target. Phase one contains no rendered SwiftUI
screen, so it does not establish visual fidelity or device behavior.
