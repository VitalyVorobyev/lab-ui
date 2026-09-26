# @vitavision/ui

The vitavision *instrument* design system: true-neutral greys, one accent, and verdict colours
reserved for verdicts. Tailwind v4 design tokens, a theme controller, and the React primitives
every lab app shares. React 19, no CSS-in-JS, no runtime theme engine.

## Install

```bash
bun add @vitavision/ui
```

`react` and `react-dom` are peers. Until the router decoupling (PLAN L1-3) lands, so is
`react-router`: `PageHeader`'s back link, `ReadoutStrip`'s linked items and `ButtonLink` render
its `<Link>`.

## Getting started

### 1. Import the tokens

From the CSS entry that already has `@import "tailwindcss";`:

```css
@import "tailwindcss";
@import "@vitavision/ui/styles.css";
/* and, for each other @vitavision package you use: */
@import "@vitavision/stage2d/styles.css";
```

Each stylesheet ships **unprocessed** — Tailwind v4 *source*, resolved by your own build — and
declares its own `@source "./"`, which Tailwind resolves against that stylesheet: the package's
class names are found without an `@source` line of yours.

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
import { initTheme } from "@vitavision/ui";

initTheme(); // or initTheme("my-app-theme") for a non-default storage key
```

### 3. Mount the two contexts the components need

```tsx
import { TooltipProvider } from "@vitavision/ui";
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

**Primitives** — `Badge`, `CountRun`, `StatusDot` · `Button`, `ButtonLink` (a router link styled as a button — never nest a `Button` in a `Link`), `buttonClasses` · `Dialog`, `ConfirmDialog`,
`DialogClose` · `Disclosure` · `Callout`, `Empty`, `ErrorBox`, `ProgressBar`, `Skeleton`,
`SkeletonRows` · `Field` · `Input`, `NumberInput`, `Textarea` · `PageHeader`, `Panel`,
`ReadoutStrip`, `Section` · `SegmentedControl` · `Select` · `Slider` · `Table` ·
`Checkbox`, `Switch` · `ToggleChip` · `InfoHint`, `Tooltip`, `TooltipProvider` ·
`ThemeToggle` · plus `cn`, `focusRing`, `focusRingInset`.

### Density

Every primitive with two spacings reads `useDensity()`. The default, `comfortable`, is what
a page wants and is unchanged from before this existed; `compact` is for a permanent
inspector column beside a canvas, where the page-sized padding is simply less of the
instrument on screen:

```tsx
<aside className="w-96 overflow-y-auto">
  <DensityProvider value="compact">{inspector}</DensityProvider>
</aside>
```

It drops leading and padding, not hit targets: controls go from `h-8` to `h-7` and stop
there. An explicit `size` on a `Button` still wins.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
