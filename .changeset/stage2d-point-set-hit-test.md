---
"@vitavision/stage2d": minor
---

`PointSet`, one hit-test across layers, and right-button and touch input on `ImageStage` (L6-2a).

- **`PointSet`**: thousands of points as a few batched paths, with a marker per kind from the overlay grammar (`dot`, `plus`, `cross`, `square`, `hollow`, `directed`; add your own through `markers`, a path generator), hover, selected (with ring) and dimmed states, labels only where points are 24 screen px apart (at most 200), and `onHoverChange` / `onItemPress`. Exported with `MARKER_SHAPES`, `circlePath` and the pure `buildPointIndex`, `buildPointIndexFrom`, `nearestPoint`, `pointsInRect` and `thinPoints`.
- **Hit-test**: `useStageHitTest()` returns `hitTest(point, radiusScreenPx = 6)` and `hitTestAll`, ranked by `STAGE_HIT_PRIORITY` (points above lines above areas above images), so a press handler decides select, draw or pan with one question. `PointSet` and `PolylineSet` answer it; `useStageHitLayer` registers any other layer.
- **`PolylineSet`**: additive `onHoverChange`, `onItemPress`, `layerId` and `priority`. A `PointSet` marker over a line now takes the press.
- **`ImageStage`**: `panButton` (`"left" | "middle" | "right"`, or a list; the right button also suppresses the context menu), `doubleClickFit` (default `true`), `touchPan` (`"one-finger"` by default). Two fingers pinch-zoom about their midpoint and pan; a tap is a press. The viewport sets `touch-action: none`. Defaults leave mouse behaviour unchanged.
