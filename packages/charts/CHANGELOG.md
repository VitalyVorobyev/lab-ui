# @vitavision/charts

## 0.7.1

### Patch Changes

- Updated dependencies [3a82c8f]
  - @vitavision/ui@0.11.0

## 0.7.0

### Minor Changes

- 5671b43: Add fluid sizing, interaction, bands, markers and sequential colour maps.
  
  - **`variant="fluid"`.** `Frame`, `LineChart` and `LineProfile` take their container's width,
    measured with `useFluidSize`, at a fixed `height` (default 200). Text renders at its true
    size at any width. `areaFor(variant, size)` gives the fluid plot area.
  - **Interaction on `LineChart` and `LineProfile`.**
    - `onHover(x | null)` draws a crosshair and a value readout of every series at x.
    - `onPick(x)` reports a click.
    - `cursor` draws an x chosen elsewhere, e.g. the canvas a profile was sampled on.
  - **`bands`** (x ranges with a tone and a label) and **`markers`** (ticks on the x axis).
    `Bands`, `Markers`, `PlotInteraction` and `seriesValueAt` are exported for custom charts.
  - **`Scale.invert`.** Implementers of `Scale` must add it, which makes this a minor.
  - **Sequential colour maps (visual-language §4).**
    - `colormap("viridis" | "cividis", t)`, `colormapValue(map, value, domain)`, `colormapRgb`
      and `colormapGradient`.
    - `ColormapLegend` shows a map's scale with its units, which the spec requires beside every
      map.

## 0.6.4

### Patch Changes

- Updated dependencies [c2d73ad]
  - @vitavision/ui@0.10.0

## 0.6.3

### Patch Changes

- Updated dependencies [5115556]
- Updated dependencies [a037a0f]
  - @vitavision/ui@0.9.0

## 0.6.2

### Patch Changes

- Updated dependencies [a019b87]
  - @vitavision/ui@0.8.0

## 0.6.1

### Patch Changes

- bab71f8: Dark `--series-3` `#8ba3ff` → `#7ba8ff`, so every pair of series stays ≥ 9.4 OKLab ΔE×100 apart under protanopia too (it was 9.1), now held by a unit test. `BarChart` tracks and legend swatches use the radius tokens.
- Updated dependencies [bab71f8]
  - @vitavision/ui@0.7.0

## 0.6.0

### Minor Changes

- 9336e74: **Breaking (values, not names):** chart colours are design tokens now, not hex strings.
  
  - `SERIES_COLOURS` is `["var(--series-1)", …, "var(--series-6)"]`, and `seriesColour(i)`
    returns those. The palette is defined in `@vitavision/charts/styles.css` for the light
    and the dark theme, so that stylesheet must be imported (after `@vitavision/ui/styles.css`)
    for series to be coloured. Code that parsed or manipulated the hex strings (alpha
    suffixes, `color-mix` on a literal) has to work on the CSS value instead.
  - The palette itself changed. Old (both themes): `#3bc9db #f0883e #a78bfa #34d399 #f87171
    #8b949b`. New, light: `#0f92c5 #b57c38 #7e5be6 #482ab3 #e04b9b #595f65`; dark:
    `#27e4ef #c27421 #8ba3ff #4a6ee0 #f96dcc #7f878d` — cyan, orange, violet, blue, pink,
    neutral. The old series 4 and 5 were the dark theme's verdict colours, which PLAN §5
    forbids; every new colour holds 3:1 against the panel in its theme, and all six stay
    apart under simulated protanopia, deuteranopia and tritanopia.
  - `NORMAL_COLOUR` is `"var(--normal)"` and `DEFECT_COLOUR` is `"var(--defect)"` — the
    `@vitavision/ui` verdict tokens, so they follow the theme too.
  - Every chart (`Frame`, `Legend`, `LineChart`, `LineProfile`, `ScoreHistogram`,
    `StackedBars`) accepts `className`, merged with `cn`.
  - New prop types: `LegendProps`, `LegendItem`, `StackedBarsProps`.
  - Every export has TSDoc; the API report has no undocumented items.
- 7c6c4e4: Split `@vitavision/lab-ui` into four packages: `@vitavision/ui` (tokens, theme, primitives),
  `@vitavision/forms` (`SchemaForm`), `@vitavision/charts` and `@vitavision/stage2d` (`ImageStage`,
  `MeasureOverlay`, value planes). `@vitavision/lab-ui` is now a deprecated re-export of the four
  with the identical 0.5 surface; its `styles.css` imports the four stylesheets, each of which
  declares its own Tailwind `@source`, so consumers no longer need an `@source` line.
  
  Optional props that forward a value now accept `undefined` explicitly (for consumers on
  `exactOptionalPropertyTypes`).

### Patch Changes

- Updated dependencies [038fcec]
- Updated dependencies [7c6c4e4]
- Updated dependencies [51bdec5]
- Updated dependencies [b60a923]
  - @vitavision/ui@0.6.0
