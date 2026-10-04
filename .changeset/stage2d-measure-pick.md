---
"@vitavision/stage2d": minor
---

`MeasureOverlay` can be hovered and picked by primitive `id`, so an app no longer hit-tests caliper boxes or contours itself.

- **`onHoverChange(id | null)`** and **`onItemPress(id, event)`** make the overlay pickable. It then answers the stage's hit-test: the pointer picks the nearest primitive that has an `id`, within the stage's pointer tolerance (6 screen px for a mouse, 12 for a touch). A dot, a filled circle and a caliper box are picked anywhere inside; every other kind by its strokes (a circle's or an arc's rim, a dimension's lines, a caliper's arrow). On a tie the later primitive, drawn on top, wins. Primitives without an `id` are drawn but never picked.
- A press on a primitive is claimed, so the stage does not pan from it. Return `false` from `onItemPress` to decline it: the press then goes to the next layer under the pointer, or to the stage.
- The hovered primitive is drawn in the hover state (a selected one stays selected). Pass **`hoveredId`** when the app controls hover, for example from a table beside the stage; otherwise the overlay tracks the pointer's hover itself. The SVG carries `data-hovered`, and the hovered primitive's `<g>` carries `data-state="hover"`.
- **`layerId`** and **`priority`** (default `STAGE_HIT_PRIORITY.line`) place the overlay among the stage's other layers, and `useStageHitTest` finds its primitives too.
- The SVG still takes no pointer events and is still hidden from assistive technology. Without a handler nothing changes, and the overlay still renders outside an `ImageStage`. With one it must sit inside an `ImageStage`.
- The geometry is exported: `measurePrimitiveDistance(primitive, point, strokeScale)` (image pixels, 0 inside a dot, a filled circle or a caliper box) and `nearestMeasurePrimitive(primitives, point, radius, strokeScale)`. The latter grids the primitives by bounding box once per `primitives` array and keeps the grid while the array lives, so pass a new array when the primitives change rather than editing one in place. A pick among 10,000 primitives takes microseconds.
