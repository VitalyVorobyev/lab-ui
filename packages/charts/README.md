# @vitavision/charts

Small, hand-rolled SVG charts for the vitavision lab apps, on `@vitavision/ui` tokens.

```bash
bun add @vitavision/charts @vitavision/ui
```

```css
@import "@vitavision/ui/styles.css";
@import "@vitavision/charts/styles.css";
```

Both imports are required: `ui/styles.css` defines the chrome and verdict tokens
(`--normal`, `--defect`), and `charts/styles.css` defines the categorical series palette
(`--series-1` … `--series-6`, light and dark). `SERIES_COLOURS`, `seriesColour()`,
`NORMAL_COLOUR` and `DEFECT_COLOUR` are `var(--…)` paint values that resolve through those
tokens, so they follow the theme; use them anywhere a CSS colour or an SVG `fill`/`stroke`
is accepted.

**Charts** — hand-rolled SVG over the pure domain/tick/project math in `scale.ts`:
`Frame` + `Legend` (the axes/grid/label shell every chart composes), `LineChart`
(multi-series, optional log y), `StackedBars`, `ScoreHistogram` (two-class distribution
with a threshold rule), and `LineProfile` (one or more series against arc length in pixels
along a scan line or caliper axis, with detected edges drawn as labelled vertical rules).

**Fitting a chart to its container**: `variant="fluid"` takes the container's width at a fixed
`height`, for a chart in a resizable inspector.

**Interaction** on `LineChart` and `LineProfile`:
- `onHover` draws a crosshair with a value readout, and `onPick` reports a click's x.
- `cursor` draws an x chosen elsewhere, such as the pointer on the canvas a profile came from.
- `bands` shade x ranges, and `markers` tick positions on the x axis.

**Sequential colour maps**: `colormap("viridis" | "cividis", t)` and
`colormapValue(map, value, domain)`, for a magnitude such as an error, a validity or a
confidence. `ColormapLegend` shows the scale with its units; a map is never shown without one
(visual-language §4).

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
