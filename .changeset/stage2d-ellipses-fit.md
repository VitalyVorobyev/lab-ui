---
"@vitavision/stage2d": minor
"@vitavision/overlays": minor
---

stage2d gains a pickable ellipse layer, a second marker angle, fit options and a compositor hint; overlays follows (lab-ui#88).

- `EllipseSet` (and `ellipsePath`) move from `@vitavision/overlays` into stage2d, next to `AreaSet`. It now registers with the stage's hit-test: `hoveredId`, `onHoverChange`, `onItemPress`, `layerId`, `priority`, and `pickable={false}` to stay out of it. The pure index is exported too: `buildEllipseIndex`, `nearestEllipse` (outline within the pointer's radius, else the smallest containing ellipse; true Euclidean distance), `ellipsesInRect`, `pointInEllipse`, `ellipseBounds`. `@vitavision/overlays` re-exports `EllipseSet`, `EllipseSetItem`, `EllipseSetProps` and `ellipsePath`, and `TargetOverlay` draws its rings and edge bits with `pickable={false}`, so its picking is unchanged. Its peer range on stage2d is now `>=0.11.0`.
- `MarkerShape.path(x, y, unit, angle, angle2)` receives `PointSetItem.angle2` (`undefined` when the item has none); existing shapes ignore it. overlays' `directed` marker reads `angle` and `angle2` directly, so `packAxes` and `unpackAxes` are removed (breaking for overlays: put the two directions in `angle` and `angle2`).
- `fitScale`, `fitView`, `isFit`, `initialView` and `preserveCenter` take `FitOptions` (`padding` in CSS pixels per side, `upscale: false` to cap fit at 1:1); the defaults give today's numbers. `ImageStage` has a `fit` prop applied to every fit path: `initialView`, the handle's and the context's `fit()`, the `0` key, the double-click toggle, the toolbar's Fit button and `data-fit`.
- `ImageStage` sets `will-change: transform` (and `data-moving`) on its transformed box while the view changes and for 150 ms after, so a pan stays on the compositor; left on permanently, Chromium keeps the layer at the raster scale it had when the hint was applied and a zoomed-in image goes blurry.
