---
"@vitavision/charts": patch
---

`LineChart` draws an error band around a series, and writes its x labels with a formatter. `ColormapLegend` marks values and shows a saturated end.

- **`Series.band`** takes `lower` and `upper` (one value per point, by index) and an optional `label`. The band is a translucent area in the series colour under all the lines; a missing or non-finite edge leaves a gap rather than a bridge; the y domain grows to hold it unless `yDomain` is fixed. The legend swatch shows a band with the label after the name (`± band` by default), and the hover readout reads `value ± half-width`, or the value with its `[lower, upper]` range when the band is not symmetric. `bandPath` and `formatWithBand` are exported for charts you draw yourself.
- **`LineChart` `xFormat`** writes the x tick labels and the x in the hover readout (a date from a timestamp). Ticks stay at round numbers of the x unit, not at calendar boundaries.
- **`ColormapLegend` `marker`** ticks one value or a list (`number`, or `{ value, label? }`) on the bar, with its text beside it: the label, or the value with the unit. A horizontal legend with a marker puts the values under the bar and the markers' text above it.
- **`ColormapLegend` `clipped`** (`"high"`, `"low"` or `"both"`) says the scale saturates: the end gets a cap in its colour and its value reads `≥ max` or `≤ min`, even when a `ticks` list leaves the end out.

Nothing changes for a chart or legend that does not use them.
