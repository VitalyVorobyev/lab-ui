---
"@vitavision/stage2d": minor
---

`AreaSet`, `GridLayer`, `HeatmapLayer`, a rotated `ShapeEditor`, draft previews and shape moving (L6-2b). All additive.

- **`AreaSet`**: closed regions (marker quads, polygons, annotations) as batched outline-plus-12 %-fill paths per state and role, with hover, selected and dimmed states, labels where regions are 24 screen px apart, an optional `firstVertexTick` on corner 0, and `onHoverChange` / `onItemPress` at `STAGE_HIT_PRIORITY.area`. A press near an outline picks that region, else the smallest region that contains it. Exported with the pure `buildAreaIndex`, `nearestArea`, `areasInRect`, `pointInPolygon`, `areaPath` and `areaCentre`.
- **`GridLayer`**: a detected lattice. Nodes `{ id, i, j, x, y }` are a `PointSet` (`plus` by default, picked at point priority); the edges between lattice neighbours are two batched paths, restyled per axis through `edges`; `indexLabels` shows `i,j`. Exported with the pure `latticeEdges`.
- **`HeatmapLayer`**: a `ValuePlane` and a `colormap` (`(t) => [r, g, b]`, optional `range` and `channel`), or an `rgba` buffer with its size, as one image placed over the image (or at `rect`, in image coordinates), with `opacity`, `visible` and pixelated rendering from 4 CSS px per cell. Rasterised in an effect into an object URL that is revoked when replaced and on unmount; server-rendering safe. Exported with the pure `rasterizePlane` and `planeRange`.
- **`ShapeEditor`**: a rotated rectangle or ellipse `{ cx, cy, width, height, rotation }` with eight handles that resize in the shape's own frame (the opposite side stays put), a rotation handle (Shift rounds to 15°), move by the interior, `minSize`, and keyboard nudges (arrows, Alt + arrows, `[` / `]`). **`rotation` is in radians, clockwise on screen.** Exported with the pure `resizeShape`, `rotateShape`, `moveShape`, `shapeHandlePoint`, `rotationHandlePoint`, `shapeHandleCursor`, `toShapeFrame`, `fromShapeFrame`, `shapeFromCorner`, `shapeCorner`, `sameShape` and `normalizeAngle`.
- **`DraftShape`** and **`MarqueeRect`**: the dashed preview of a point, line, polyline, polygon, rectangle or ellipse being drawn, and the rubber band of a multi-select.
- **`useShapeDrag`** and `translatePoints`: a press on an item becomes image-space displacements with click slop, for select → drag → commit of manual shapes.
