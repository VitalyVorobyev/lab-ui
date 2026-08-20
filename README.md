# @vitavision/lab-ui

The shared visual language and component primitives for the vitavision lab apps — extracted
from `visual-anomaly-lab` so it and a new visual-metrology lab draw from one design system
("instrument": true-neutral greys, one accent, verdict colours reserved for verdicts)
instead of two copies drifting apart.

Package manager: **bun**. Do not use npm, yarn or pnpm in this repo or against this package.

## Install (as a `file:` dependency)

From a consuming app's `frontend/` directory:

```bash
bun add "@vitavision/lab-ui@file:../../lab-ui"
```

(adjust the relative path to wherever `lab-ui` is checked out beside the consumer). Bun
resolves a `file:` dependency by symlink, so `bun run build` in this package while the
consumer's dev server is running picks up changes on the next reload — there is no publish
step for local development.

## Consumer wiring

Three things, all at the consumer's own entry point:

**1. Pull in the tokens and base layer**, once, from your app's own CSS entry (the file that
already has `@import "tailwindcss";` in it):

```css
/* frontend/src/styles.css */
@import "tailwindcss";
@import "@vitavision/lab-ui/styles.css";

/* Tell Tailwind v4 to scan the package's *built* output for the utility classes its
   components use — @source only looks at literal source text, and dist/index.js is where
   those class names actually live once this package is built. */
@source "../node_modules/@vitavision/lab-ui/dist";
```

`@vitavision/lab-ui/styles.css` is shipped **unprocessed** — it is Tailwind v4 *source*
(`@import "tailwindcss"`, `@theme inline { … }`), not compiled CSS. Your own Vite +
`@tailwindcss/vite` build is what resolves it, which is exactly why the `@source` line
above matters: without it, Tailwind never sees the class names inside this package's
bundled components and drops them from your build's generated CSS.

**2. The no-flash theme script**, in your `index.html`, kept in agreement with
`initTheme`/`theme.ts` — the class has to be on `<html>` before your first paint, which is
before any JS module has loaded:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem("vitavision-theme"); // DEFAULT_THEME_STORAGE_KEY
      var dark =
        stored === "dark" ||
        ((stored === null || stored === "system") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (dark) document.documentElement.classList.add("dark");
    } catch (_) {
      // Storage unavailable: fall through to the light palette defined on :root.
    }
  })();
</script>
```

Then, once your app mounts:

```ts
import { initTheme } from "@vitavision/lab-ui";

initTheme(); // or initTheme("my-app-theme") for a non-default storage key
```

**3. `peerDependencies`.** This package expects the consumer to supply `react`,
`react-dom` and `react-router` (Panel's `PageHeader`/`ReadoutStrip` render `<Link>`, so a
router context is required at render time). Radix primitives, `clsx`, `tailwind-merge` and
`lucide-react` are ordinary `dependencies` of this package and install normally — nothing
extra to add for those.

## What's in it

### Design tokens (`styles.css` / `theme.ts`)

| Token | Meaning |
| --- | --- |
| `ground` / `surface` / `raised` / `overlay` | Elevation, lightest (`ground`) to nearest the user (`overlay`, e.g. a dialog). |
| `line` / `line-strong` | Borders — quiet, and emphasised. |
| `canvas` | The dark well an image or plot sits in, independent of the light/dark theme. |
| `fg` / `fg-muted` / `fg-subtle` | Text, most to least prominent. |
| `signal` / `signal-strong` / `signal-fg` | The one accent: "you can act here." Focus, selection, the primary button. |
| `normal` / `defect` / `warn` | The verdict palette. Reserved for verdicts; never decoration. |
| `--radius-control` / `--radius-panel` | The two corner radii the whole system uses. |

Both themes are defined in this one file; light is `:root`, dark is `.dark`. `theme.ts`
exports `ThemeChoice` (`"light" | "dark" | "system"`), `readThemeChoice`, `resolveTheme`,
`setThemeChoice` and `initTheme`, each taking an optional `storageKey` (default
`DEFAULT_THEME_STORAGE_KEY = "vitavision-theme"`) so two apps sharing a browser profile can
use independent keys.

### Component inventory

**Primitives** (`components/ui`, all re-exported from the package root):
`Badge`, `CountRun`, `StatusDot` · `Button` · `Dialog`, `ConfirmDialog`, `DialogClose` ·
`Disclosure` · `Callout`, `Empty`, `ErrorBox`, `ProgressBar`, `Skeleton`, `SkeletonRows` ·
`Field` · `Input`, `NumberInput`, `Textarea` · `PageHeader`, `Panel`, `ReadoutStrip`,
`Section` · `SegmentedControl` · `Select` · `Slider` · `Table` · `Checkbox`, `Switch` ·
`ToggleChip` · `InfoHint`, `Tooltip`, `TooltipProvider` · plus `cn`, `focusRing`,
`focusRingInset`.

**Layout & forms**: `Tabs` · `SchemaForm` (renders a `JSON Schema → form`, paired with the
pure `api/schemaForm.ts` logic: `describeFields`, `initialValues`, `toOptions`,
`missingRequired`, `outOfRange`, `jsonErrors`, `overrideCount`).

**Image viewing**: `ZoomPanCanvas` — a pannable/zoomable frame that transforms every
stacked child layer together (image, mask, measurement overlay) so they never drift apart;
exports the pure `zoomAt`/`contentUnder`/`nativeZoomFor` it's built on. `api/mapValues.ts`
decodes the `VAM1` float32-plane wire format into indexable values (`decodePlane`,
`valueAt`, `valuesAt`, `fractionOf`, `fetchPlane`) — it never draws; colour range and
colormap stay the caller's decision.

**Charts** (`components/charts`, hand-rolled SVG over `scale.ts`'s pure domain/tick/project
math): `Frame` + `Legend` (the axes/grid/label shell every chart composes), `LineChart`
(multi-series, optional log y), `StackedBars`, `ScoreHistogram` (two-class distribution
with a threshold rule), and:

- **`LineProfile`** — a 1-D profile chart: one or more series plotted against arc length
  (in pixels) along a scan line or caliper axis, with detected-edge positions drawn as
  labelled vertical rules over the series.

**Measurement overlay** (`components/MeasureOverlay.tsx` + `measureGeometry.ts`):

- **`MeasureOverlay`** — a pure-props SVG layer meant to sit inside `ZoomPanCanvas`'s
  transformed stack, drawing measurement primitives (`point`, `segment`, `circle`, `arc`,
  `caliper`, `dimension`) given in **source-image pixel coordinates**, each with an
  optional `tone` (`signal` / `normal` / `defect` / `warn` / `muted`). No app state, no
  DOM measurement — a `strokeScale` prop (the current image-px→screen-px scale) is all it
  needs to keep every stroke and label a constant size on screen at any zoom. The geometry
  (`arcPath`, `caliperCorners`, `caliperArrow`, `arrowHeadPoints`, `dimensionGeometry`,
  `crossSegments`, `polygonPath`, `strokeWidthFor`, `rotatePoint`) is factored out and unit
  tested independently of React.

Tones for the overlay and `LineProfile`'s edge marks share one vocabulary,
`MeasureTone`/`toneColor` (`src/tone.ts`) — distinct from `components/ui/Badge`'s own
`Tone`, which is the verdict-badge vocabulary (`normal`/`defect`/`warning`/…) and keeps its
established name since it is copied verbatim from the source app.

## Development

```bash
bun install
bun run typecheck   # tsc --noEmit
bun run test         # vitest run
bun run build        # tsup -> dist/index.{js,d.ts} + dist/styles.css
```

## What was deliberately not extracted

- **The app-shell layout rules** from `visual-anomaly-lab/frontend/src/styles.css` (the
  `html, body, #root { height: 100%; overflow: hidden }` fixed-frame block) — that is a
  decision about how *that* app's shell is laid out, not part of the shared visual
  language. A design-system package should not force every consumer into a fixed-viewport
  shell.
- **`CurveChart`/`ThresholdCurve`** (ROC/PR curves) — explicitly out of scope per the
  extraction plan; anomaly-lab specific and not part of the metrology gap.
- **The generated-types coupling** in the source app's `SchemaForm`/`schemaForm.ts` — the
  copy here types the schema input structurally (`SchemaNode`/`OptionsSchema`), so it has
  no dependency on any app's generated OpenAPI types.
- **URL builders** in `mapValues.ts` (`anomalyMapValuesUrl`, `sourceValuesUrl`,
  `diagnosticValuesUrl`) — those encode one app's API routes; `fetchPlane` takes a URL, so
  each consumer supplies its own.
- **A component-library CSS build step** — `styles.css` ships as raw Tailwind v4 source on
  purpose (see "Consumer wiring" above); pre-compiling it here would fix its utility
  classes against *this* package's own Tailwind config rather than the consumer's.

## Releasing

Publishing is driven by a git tag, not by a branch, so `main` can move without
releasing and every release is a named, immutable point in history:

```bash
# bump "version" in package.json first — the workflow refuses a tag that
# disagrees with the manifest rather than publishing something else
git tag v0.2.0
git push --tags
```

`.github/workflows/release.yml` then typechecks, tests, builds, publishes to npm
with [provenance](https://docs.npmjs.com/generating-provenance-statements) (the
registry records which commit and workflow run produced the tarball), and opens a
GitHub release. It needs one repository secret, `NPM_TOKEN` — an npm automation
token with publish rights on the `@vitavision` scope.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
