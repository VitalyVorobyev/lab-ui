# @vitavision/lab-ui

The shared visual language and component primitives behind the vitavision lab apps — an
*instrument* design system: true-neutral greys, one accent, and verdict colours reserved
for verdicts. React 19 + Tailwind v4, no CSS-in-JS, no runtime theme engine.

It exists so `visual-anomaly-lab` and the vision-metrology lab draw from one design system
instead of two copies drifting apart.

## Install

```bash
bun add @vitavision/lab-ui
```

`react`, `react-dom` and `react-router` are peer dependencies — the app supplies its own,
and a router context is a hard requirement at render time (step 3 below). Everything else
the components need (Radix primitives, `lucide-react`, `clsx`, `tailwind-merge`) comes with
the package.

## Getting started

Three steps, all in your app's own entry points. Every component is exported from the
package root: `import { Button, PageHeader, ThemeToggle } from "@vitavision/lab-ui"`.

### 1. Import the tokens

From the CSS entry that already has `@import "tailwindcss";` in it:

```css
/* src/styles.css */
@import "tailwindcss";
@import "@vitavision/lab-ui/styles.css";

/* Tailwind v4 only finds class names in literal source text, and this package's live
   in its built bundle — without this line they are dropped from your generated CSS. */
@source "../node_modules/@vitavision/lab-ui/dist";
```

`@vitavision/lab-ui/styles.css` ships **unprocessed**: it is Tailwind v4 *source*
(`@import "tailwindcss"`, `@theme inline { … }`), not compiled CSS, and your own Vite +
`@tailwindcss/vite` build is what resolves it. That is why the `@source` line matters.

### 2. Set the theme before the first paint

The class has to be on `<html>` before any JS module loads, so this goes in `index.html`,
kept in agreement with `theme.ts`:

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

Then, once your app mounts, subscribe so a choice of `"system"` keeps following the OS:

```ts
import { initTheme } from "@vitavision/lab-ui";

initTheme(); // or initTheme("my-app-theme") for a non-default storage key
```

### 3. Mount the two contexts the components need

```tsx
import { TooltipProvider } from "@vitavision/lab-ui";
import { HashRouter } from "react-router";

createRoot(container).render(
  <TooltipProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </TooltipProvider>,
);
```

Neither degrades gracefully. `ThemeToggle`, `Tooltip` and `InfoHint` render Radix
tooltips, which **throw** without a provider; `PageHeader` with a `back` prop and
`ReadoutStrip` with a linked item render a react-router `<Link>`, which needs a router
context to exist at all. Under React 19 a throw during render unmounts the entire root —
so the symptom of a missing provider is not a broken button, it is a blank window.

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

Both themes live in that one file — light on `:root`, dark on `.dark`. `theme.ts` exports
`ThemeChoice` (`"light" | "dark" | "system"`), `readThemeChoice`, `resolveTheme`,
`setThemeChoice` and `initTheme`, each taking an optional storage key (default
`DEFAULT_THEME_STORAGE_KEY = "vitavision-theme"`) so two apps sharing a browser profile
keep independent preferences.

### Components

**Primitives** — `Badge`, `CountRun`, `StatusDot` · `Button` · `Dialog`, `ConfirmDialog`,
`DialogClose` · `Disclosure` · `Callout`, `Empty`, `ErrorBox`, `ProgressBar`, `Skeleton`,
`SkeletonRows` · `Field` · `Input`, `NumberInput`, `Textarea` · `PageHeader`, `Panel`,
`ReadoutStrip`, `Section` · `SegmentedControl` · `Select` · `Slider` · `Table` ·
`Checkbox`, `Switch` · `ToggleChip` · `InfoHint`, `Tooltip`, `TooltipProvider` ·
`ThemeToggle` · plus `cn`, `focusRing`, `focusRingInset`.

**Layout & forms** — `Tabs`; `SchemaForm`, which renders a JSON Schema as a form and is
paired with the pure logic in `api/schemaForm.ts` (`describeFields`, `initialValues`,
`toOptions`, `missingRequired`, `outOfRange`, `jsonErrors`, `overrideCount`).

**Image viewing** — `ZoomPanCanvas`, a pannable/zoomable frame that transforms every
stacked child layer together (image, mask, measurement overlay) so they never drift apart;
it exports the pure `zoomAt` / `contentUnder` / `nativeZoomFor` it is built on.
`api/mapValues.ts` decodes the `VAM1` float32-plane wire format into indexable values
(`decodePlane`, `valueAt`, `valuesAt`, `fractionOf`, `fetchPlane`) — it never draws;
colour range and colormap stay the caller's decision.

**Charts** — hand-rolled SVG over the pure domain/tick/project math in `scale.ts`:
`Frame` + `Legend` (the axes/grid/label shell every chart composes), `LineChart`
(multi-series, optional log y), `StackedBars`, `ScoreHistogram` (two-class distribution
with a threshold rule), and `LineProfile` (one or more series against arc length in pixels
along a scan line or caliper axis, with detected edges drawn as labelled vertical rules).

**Measurement overlay** — `MeasureOverlay` is a pure-props SVG layer meant to sit inside
`ZoomPanCanvas`'s transformed stack, drawing `point`, `segment`, `circle`, `arc`, `caliper`
and `dimension` primitives given in **source-image pixel coordinates**, each with an
optional `tone`. No app state and no DOM measurement: a `strokeScale` prop (the current
image-px→screen-px scale) is all it needs to keep strokes and labels a constant size on
screen at any zoom. Its geometry lives in `measureGeometry.ts` and is tested without React.

Overlay and `LineProfile` edge marks share one tone vocabulary, `MeasureTone`/`toneColor`
(`signal` / `normal` / `defect` / `warn` / `muted`). `Badge`'s `Tone` is a separate,
verdict-badge vocabulary and keeps its own name.

## Development

This repo uses **bun**.

```bash
bun install
bun run typecheck   # tsc --noEmit
bun run test        # vitest run
bun run build       # tsup -> dist/index.{js,d.ts} + dist/styles.css
```

To try a change against a consuming app before publishing, `bun link` this package there;
`bun run dev` (tsup watch) rebuilds `dist/` and the app's dev server picks it up on reload.

## Releasing

A release is a git tag, never a branch, so `main` can move without publishing and every
release is a named, immutable point in history:

```bash
# bump "version" in package.json first — the workflow refuses a tag that
# disagrees with the manifest rather than publishing something else
git tag v0.2.0
git push --tags
```

`.github/workflows/release.yml` then typechecks, tests, builds, publishes to npm, and opens
a GitHub release. It holds **no npm token**: publishing is authorised by
[trusted publishing](https://docs.npmjs.com/trusted-publishers), where npm verifies the
short-lived OIDC token GitHub mints for the run against the publisher registered for the
package — repository `VitalyVorobyev/lab-ui`, workflow `release.yml`, environment `npm`.
Change any of those three and publishing stops until npm is told about it. The same
identity signs the
[provenance](https://docs.npmjs.com/generating-provenance-statements) attestation, so the
tarball still records verifiably which commit and run produced it.

## Scope

Deliberately not here:

- **App-shell layout rules.** How an app fills the viewport is that app's decision; a
  design system should not force every consumer into a fixed-viewport shell.
- **Compiled CSS.** `styles.css` is Tailwind source on purpose — pre-compiling it would
  fix its utilities against *this* package's Tailwind config instead of yours.
- **API routes and generated types.** `fetchPlane` takes a URL and `SchemaForm` types its
  input structurally, so neither is coupled to any one app's backend.
- **ROC/PR curves** (`CurveChart`/`ThresholdCurve`) — anomaly-lab specific.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
