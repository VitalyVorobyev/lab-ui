# The visual language of the `@vitavision/*` frontends

This is the normative spec (PLAN §5). Storybook's **Foundations** section is its living
specimen: every rule below has a page there, rendered from the real tokens and components.
The numbers come from `tools/visual-language/` and are recorded in
[`docs/measurements/l3-1-foundations.md`](measurements/l3-1-foundations.md).

- **Status.** Accepted in L3-1. Decision **D1** (§2) is settled: IBM Plex
  ([ADR-0003](adrs/0003-type-family-ibm-plex.md)).
- **Rule words.** *Must* is enforced, or will be by the ticket named. *Should* is the default,
  and a reviewer can accept a stated reason to break it.
- **Starting point.** lab-ui's own principle is an *instrument* design system. The chrome is
  true-neutral grey so the data can be loud. There is exactly one accent, and the verdict
  colours are reserved for verdicts.

## 1. Colour

The semantic tokens live in `@vitavision/ui/styles.css`. Specimen: *Foundations / Colour*.

| Group | Tokens | Rule |
|---|---|---|
| Surfaces | `ground`, `surface`, `raised`, `overlay`, `canvas`, `line` | True-neutral greys, never blue-tinted. `canvas` is dark in both themes, because an image reads against black. `line` is for dividers, which are decoration and exempt from contrast rules. |
| Boundaries | `line-strong` | The border that identifies a control: inputs, selects, segmented controls, switches, checkboxes, secondary buttons. ≥ 3:1 against `ground`, `surface` and `overlay` (WCAG 1.4.11). |
| Text | `fg`, `fg-muted`, `fg-subtle` | ≥ 4.5:1 on `ground`, `surface`, `raised` and `overlay`, in both themes. |
| Accent | `signal`, `signal-strong`, `signal-fg` | Means "you can act here": focus, selection, the active item, the primary action. It is never decoration. |
| Verdicts | `normal`, `defect`, `warn` | Only for a pass/fail/attention judgement the app has actually made. They are never a series colour, a decoration, or a continuous scale. `defect` also marks destructive actions. |

- **Must:** components use token names only. There are no raw Tailwind palette classes
  (`bg-gray-500`) and no hex literals. This is gate **G5.1**, a lint rule in
  `@vitavision/config-eslint` scoped to each app's migrated directories (L3-3..n).
- **Must:** a "verdict" means the app compared a value with a declared threshold and said
  so. A continuous quality (a score, an error in px) is a magnitude and uses a sequential
  map (§4), even when low values are "good".
- **Must:** every text and boundary pair above holds in both themes. `ui/src/contrast.test.ts`
  checks them against the values in `styles.css`, including each verdict colour and `signal`
  as text on their own /12 tint.
- **Must:** `signal` stays apart from every verdict colour for a reader with any dichromacy:
  ≥ 8 OKLab ΔE×100 in light, ≥ 9.3 in dark (the same test file).
  - L3-2 retuned both for this. The 0.6 values were 1.7 apart under tritanopia, so a
    tritanope saw "selected" and "passed" as one colour.
  - That is why the light accent is a deep slate-teal (`#235159`). It must stay dark enough
    for 4.5:1 text, which leaves hue as the only lever.
- **Should:** colour is never the only cue. A verdict carries its text or an icon, and a
  selection carries a shape (outline, fill, check).

## 2. Type — IBM Plex Sans + IBM Plex Mono (D1)

**Decision (2026-09-27, [ADR-0003](adrs/0003-type-family-ibm-plex.md)):** IBM Plex Sans for
text and IBM Plex Mono for values, in every package and migrated app.

- **Must:** the mono build carries the `zero` feature in weights 400 and 500: IBM's
  complete or split files, or a subset made from them. fontsource's build drops it, and
  there the slashed zero silently becomes a dotted one.
- **Must:** apps load the fonts with `@import "@vitavision/ui/fonts.css";`, next to
  `styles.css`.
  - The files ship inside `@vitavision/ui`, so every app gets the same build: Plex Sans
    variable (fontsource) and IBM's split Plex Mono 400/500, which keep `zero`.
  - They are vendored by `tools/visual-language/vendor-fonts.ts`.
  - With `unicode-range`, a page fetches about 80 KB: Plex Sans latin, plus the Plex Mono
    Latin1 file at 400 and at 500.
- **Should not:** load Plex from fontsource or Google Fonts as well. Those builds lose the
  slashed zero, and two faces with one family name race.

The comparison the decision was made on follows. Before the decision, lab-ui and VAL used
IBM Plex Sans/Mono, and vitavision and calibration-rs used Inter/Geist Mono. The side-by-side
specimen is in PR #35's Storybook. Today's specimen is *Foundations / Type*.

Measured from the files each candidate would ship (`tools/visual-language/fonts.py`):

| | IBM Plex Sans + IBM Plex Mono | Inter + Geist Mono |
|---|---|---|
| x-height / em | 0.516 (mono 0.516) | 0.546 (mono 0.530): about 6 % larger at the same px |
| Width of a typical inspector line | 24.0 em | 25.0 em: about 4 % wider |
| Sans digits | tabular by default: prose and tables align with no feature | proportional; tabular needs `tnum` |
| Side effect of `tnum` | none (Plex has no `tnum`) | also re-spaces `- . , : ( ) + − ×`, so global tabular figures visibly space the hyphens in prose |
| I / l / 1 | distinct (`l` has a tail) | identical `I` and `l` by default; `cv05` + `cv08` fix it (serifed `I`, tailed `l`) |
| Mono zero | dotted in fontsource's build, which drops `zero`; slashed in IBM's complete build, where the existing `slashed-zero` rule works | slashed by default |
| Files | Plex Sans 45 KB + Plex Mono 48 KB per weight (IBM complete; a latin subset that keeps `zero` would be ~15 KB) | Inter 97 KB (latin, `opsz` + `wght`) + Geist Mono 23 KB |
| npm source | fontsource + `@ibm/plex-mono` (IBM) | `inter-ui` (a third-party repackaging; Inter's author does not publish to npm) + fontsource |
| Personality | engineered, slightly technical, IBM | neutral, contemporary, the default of many products |

The specimen shows each pair **as it would ship**, meaning the builds and features above.
The *Confusables* story also shows both pairs the way the apps load them today.

Rules that hold whichever pair wins:

- **Must:** numbers that are compared — table columns, readouts, axes, live counters — use
  tabular figures, and mono values use a slashed zero. Plex's digits are tabular by
  default and Plex has no `tnum`, so the global `tabular-nums` and `slashed-zero` of
  `styles.css` cover it.
- **Must:** the sans and mono families are two tokens (`--font-sans`, `--font-mono`) in
  `@vitavision/ui/styles.css`.
- **Boundary:** Source Serif 4 stays on vitavision's editorial pages.

## 3. Scales

Specimen: *Foundations / Scales*. These values are the ones the packages already use
(surveyed in L3-1). The spec names them so new code picks a role, not a size.

### Type roles

| Role | Classes | px / weight | Used for |
|---|---|---|---|
| title | `text-xl font-semibold tracking-tight` | 20 / 600 | `PageHeader` h1, one per screen |
| heading | `text-sm font-semibold tracking-tight` | 14 / 600 | Panel, Section and Dialog titles |
| body | `text-sm` | 14 / 400 | values, table cells, prose |
| label | `text-xs font-medium` | 12 / 500 | field labels, small buttons, segments |
| meta | `text-xs text-fg-muted` | 12 / 400 | hints, descriptions, captions, legends |
| eyebrow | `text-[11px] font-semibold uppercase tracking-wider text-fg-muted` | 11 / 600 | compact panel titles only |
| micro | `text-[10px]` | 10 / 400 | chart ticks, compact table headers |

- **Should:** no other sizes in shared packages. `text-base` and larger appear only as
  `title`.
- **Leading:** `leading-snug` for UI text, `leading-relaxed` for prose (dialog
  descriptions, help paragraphs).

### Spacing

Steps are in Tailwind units (1 = 4 px): **0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8**. Gaps between
controls are `gap-1.5` to `gap-3`; panel bodies use `p-4`, or `p-2.5` when compact. A value
outside the list needs a reason.

### Density

`DensityProvider` sets `comfortable` (the default, for a page you read through) or
`compact` (for a permanent tool surface such as an inspector column). Compact drops
padding and leading, never hit targets or type below 10 px.

| Where | Comfortable | Compact |
|---|---|---|
| control height (`useControlHeight`, `Button`) | `h-8` (32 px), `md` | `h-7` (28 px), `sm` |
| panel header | `min-h-11 px-4 py-2.5`, heading role | `min-h-8 px-2.5 py-1`, eyebrow role |
| panel body | `p-4` | `p-2.5` |
| field | `gap-1.5`, label 12 px | `gap-1`, label 11 px |
| table cell / header | `py-2 pr-3` 14 px / `pb-2` 12 px | `py-0.5 pr-2` 11 px / `pb-1` 10 px |

Every control, the `Select` trigger included (fixed in L3-2), takes its height from
`useControlHeight`.

### Radii and elevation

- **Radii:**
  - `rounded-control` (6 px) for controls.
  - `rounded-panel` (10 px) for panels, cards and dialogs.
  - `rounded-full` for pills, dots, switches and line swatches.
  - There is no bare `rounded`; L3-2 moved the last seven to the tokens.
- **Elevation:**
  - The page and panels are flat, separated by `ground` vs `surface` and a `ring-line`.
  - Only floating layers cast a shadow: popovers, menus and tooltips use `shadow-lg`;
    dialogs use `shadow-xl`.
- **Focus:** always an outline (`focusRing`: 2 px `signal`, offset 2), never a shadow.

## 4. Data-visualisation palette

Specimen: *Foundations / Data-vis palette*.

- **Categorical.** Use `--series-1..6` (`@vitavision/charts`, `SERIES_COLOURS`).
  - Each colour is ≥ 3:1 against `surface` and `ground` in its theme.
  - Under the Machado simulations of protanopia, deuteranopia and tritanopia, no two
    colours are closer than **9.4** OKLab ΔE×100, in either theme.
    - L3-2 nudged dark series 3 from `#8ba3ff` to `#7ba8ff`. It had been 9.1 under
      protanopia.
    - `charts/src/palette.test.ts` holds both rules.
  - A seventh series reuses a slot and is told apart by its legend text.
- **Sequential**, for magnitude. Use perceptually uniform maps only:
  - `viridis` is the default on the chrome: residual size, per-cell error, confidence.
  - `inferno` is for heatmaps drawn over an image. Low values go to black, so the image
    shows through. VAL's anomaly maps already use it.
  - `cividis` is for when the map alone carries the finding and the reader's colour vision
    is unknown.
- **Diverging**, for signed values around a meaningful zero: `PuOr`, purple for
  negative and orange for positive. Examples are a signed residual component, or a
  disparity difference.
- **Must not:** `jet`, `hot`, `turbo`, or any red→green ramp. Uniform steps in them do not
  look uniform, so bands read as edges that aren't in the data, and red/green is a verdict.
  - Today's users are vitavision's radsym heatmap (`jet` and `hot` options) and
    calibration-rs's disparity (`jet`).
  - calibration-rs's stepped teal→red error ramp (`colorForError`) and vitavision's
    red/amber/green score glyphs become sequential maps with their thresholds in the
    legend.
- **Must:** a chart or map shows its scale: a legend with units, and the gain for anything
  drawn exaggerated.
- **Where the maps will live:** the LUTs ship as data in `@vitavision/charts`, used by
  `stage2d`, when the second app needs them (the promotion rule; L5/L6). Until then the
  specimen holds the anchors.

## 5. Overlay grammar

Geometry drawn over an image, in `stage2d`, `overlays` and `three`. Specimen:
*Foundations / Overlay grammar*.
- **Tokens.** The roles are `--stage-feature`, `--stage-model`, `--stage-structure`,
  `--stage-selection`, `--stage-label` and `--stage-halo`, in `@vitavision/stage2d/styles.css`.
  They are also Tailwind colours (`stroke-stage-feature`).
- **In code.** `overlayRole(role)` gives an SVG paint. `OverlayState` and the state widths and
  opacity are exported beside it, and `useScreenPx` sizes strokes in screen pixels.

**Screen pixels.**
- **Must:** stroke widths, marker sizes and label sizes are screen pixels at every zoom.
  They are drawn as `size / scale` (`strokeWidthFor`, `imageLengthFor`).
- `vector-effect: non-scaling-stroke` is not used: it is unreliable under a CSS transform.
  VAL's `VectorLayer` uses it today, and calib-targets' `1/√scale` is also out.
- Geometry that *is* data scales with the image: a residual's length, or a fitted ellipse.

**Role colours.** Overlays sit on the image, not on the chrome, so there is one set for
both themes.

| Role | Colour | For |
|---|---|---|
| feature | `#ed9d43` | what was detected or observed: corners, markers, rings, keypoints |
| model | `#9dbdff` | what the model predicts: reprojections, fitted geometry, predictions |
| structure | 55 % white | context: the board outline, grid lines |
| selection | `#2db2d4` (dark `signal`) | the selected feature, always with a ring |
| label | `#e8ebed` on the halo | ids and indices |
| halo | `rgba(8, 10, 11, .72)` | under every stroke (+2 px) and label (3 px, `paint-order: stroke`), so a glyph holds on a white or a black image |

- **How `feature` and `model` were chosen:** by an OKLCH search
  (`tools/visual-language/colours.py`).
  - Under typical vision and each simulated dichromacy, they stay ≥ **7.3** OKLab ΔE×100
    from each other, from `selection`, from the label white, and from every verdict
    colour.
  - The obvious magenta/cyan pair fails: 1.9 under deuteranopia.
- **Colour is never the only channel.** Every role also has its own glyph shape.
- **Must:** verdict colours appear on an overlay only when the overlay *is* a verdict.
  - Allowed: VAL's matched / false-positive / missed boxes, or a defect region.
  - Not allowed: vitavision's red/amber/green score glyphs, or calib-targets' red corners
    and green far-ring. These move to role colours, or to a sequential map for a score.
- **Class colours:** when regions are coloured by class, the classes use the categorical
  series palette, as VAL's label maps already do.

**Glyphs, one per feature kind.**

| Kind | Glyph |
|---|---|
| corner, X-junction | plus with 5 px arms (the centre stays visible) |
| marker (ArUco, AprilTag) | quad outline, corner 0 ticked, id inside |
| blob, circle centre, keypoint | dot, r 2.5 px |
| ring or ellipse target | fitted ellipse, plus at the centre |
| reprojected / predicted point | hollow circle r 4 px, model colour |
| residual | line from observed to model, drawn × gain; the gain is printed in the legend |
| ground truth vs prediction | truth dashed `4 3`, prediction solid |
| origin | ring r 7 px with i and j axes |
| region, annotation | outline plus 12 % fill |
| measurement | `MeasureOverlay` primitives (lab-ui), unchanged |

**States.**

| State | Rendering |
|---|---|
| default | 1.5 px (1 px for model and structure) |
| hover | 2 px. Nothing else changes, so hovering doesn't move the scene. |
| selected | 2.5 px in `selection`, plus a ring. There is one selection colour everywhere; vitavision's cyan `#00ffff` and orange selections go. |
| dimmed | 35 % opacity, for features outside the current filter or set |

**Labels.**
- 11 px mono in `label` over a 3 px halo.
- Shown only once features are ≥ 24 screen px apart, i.e. above a zoom threshold. Below it
  the specimen hides them, as vitavision and calib-targets already do.

## 6. Motion

- **Must:** shared packages use CSS transitions only. There is no motion library in any
  `@vitavision/*` package (PLAN §2).
- **Durations:**
  - Colour, opacity and transform changes use Tailwind's default 150 ms.
  - Progress bars use 300 ms.
  - Nothing animates on mount or unmount.
- **Must:** `prefers-reduced-motion: reduce` collapses every transition and animation.
  `@vitavision/ui/styles.css` does this globally, so components need no `motion-safe:`.
- An app may animate its own editorial pages (vitavision uses `motion`), but not the
  interactive surfaces built from the packages.

## 7. Boundary

- vitavision's editorial and blog pages keep their typography and layout: Source Serif 4,
  heading tracking, prose widths. Only their **tokens** migrate: colours, radii, spacing.
- Everything interactive adopts the packages: the editor, demos, canvas and forms.
- The migrated directories of each app are listed in its lint config for G5.1 (L3-3..n).

## Where each rule is enforced

| Rule | Enforced by |
|---|---|
| tokens only, no palette classes or hex literals | G5.1 lint rule, L3-3..n |
| text contrast ≥ 4.5:1, UI boundaries ≥ 3:1, signal vs verdicts under dichromacy | `ui/src/contrast.test.ts` |
| axe, light and dark | the story harness, today (Foundations included) |
| series palette ≥ 3:1 and CVD separation | `charts/src/palette.test.ts`; `tools/visual-language/colours.py` prints the numbers |
| overlay strokes in screen px | `stage2d` view-math unit tests; the role tokens and `useScreenPx` (U-5) |
