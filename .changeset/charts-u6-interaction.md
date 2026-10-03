---
"@vitavision/charts": minor
---

Add fluid sizing, interaction, bands, markers and sequential colour maps.

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
