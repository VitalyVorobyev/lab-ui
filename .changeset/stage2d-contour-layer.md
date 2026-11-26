---
"@vitavision/stage2d": patch
---

Add `ContourLayer`, iso-lines of a scalar field over an `ImageStage`.

It takes the same `plane`, `channel` and `rect` as `HeatmapLayer`, so a contour layer and a heatmap of one plane line up. `levels` is a list of values or `{ step, origin? }` (every multiple of `step` in the channel's finite range, widened by whole multiples if that would be more than 64 levels); `dashedLevels` draws given levels dashed (a significance threshold, zero), also when `levels` does not list them. The lines come from marching squares over the plane's nodes, linear along cell edges, with a saddle resolved by the mean of its four corners; a cell touching a `NaN` node holds no line, so a line ends at a hole instead of crossing it. They are drawn as one halo path and one path per style, at constant screen width, and recomputed only when the plane, channel or levels change. `labels` (`true` or a formatter) writes the level along lines at least 90 screen pixels long, inside the viewport. The layer takes no pointer events.

`contourPaths` (the lines as polylines in plane nodes), `resolveLevels` and the `ContourLine` type are exported for use outside a stage.
