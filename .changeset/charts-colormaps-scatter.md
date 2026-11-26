---
"@vitavision/charts": patch
---

Add the `magma`, `inferno` and `blueOrange` colour maps, a vertical `ColormapLegend`, and `ScatterChart`.

- **Maps:** `magma` and `inferno` run from black to a pale end, for a heatmap over a dark image. `blueOrange` is a diverging map for a signed value: a deep blue through a neutral light grey to a deep orange, built so both arms fall in lightness at the same rate. `colormapRgb`, `colormapValue` and `colormapGradient` take every name in `COLORMAPS`; `isDivergingColormap` and `DIVERGING_COLORMAPS` say which are diverging, and `symmetricDomain([low, high])` gives the `[-m, m]` that puts a diverging map's middle on zero.
- **`ColormapLegend`:** `orientation="vertical"` stands the bar up beside a map, high end at the top, unit after the label, with `length` for its height. `ticks` labels values along the bar (a list, or a rough count of round values plus the two ends), and `symmetric` centres the scale on zero. Without them the legend is the one line it was.
- **`ScatterChart`:** points over two axes on the shared frame, palette and variants. `colourBy` colours each point by its `value` through a map and shows the scale in the footer; `referenceLines` draw dashed rules at a value of either axis; `onHover`, `onPick` and `highlighted` ring and report the nearest point. Points are drawn as a few batched paths.
