# @vitavision/overlays

## 0.1.1

### Patch Changes

- 2b38012: Ship the compiled `dist/`. 0.1.0 was published without it, so neither the package entry (`dist/index.js`) nor its types resolved; it also carried `workspace:^` ranges in `devDependencies`. The source is unchanged.

## 0.1.0

### Minor Changes

- 5e71fa8: New package: calibration-target overlays on the `@vitavision/stage2d` stage (L7-1). One `TargetOverlay` draws a chessboard, ChArUco board, marker board, PuzzleBoard, ring grid or a loose set of corners from a normalised `TargetDetection`, replacing the per-board overlays and glyph components each app wrote for itself.
  
  - **Input**: `TargetDetection` (`corners`, `markers`, `circles`, `rings`, `edgeBits`, and a `kind`) in image pixels with the pixel centre at integer coordinates. No detector package is imported. `edgeBitsFromPuzzleboard` turns a PuzzleBoard decode (observed edges and the mod-501 alignment) into `edgeBits`.
  - **Drawing**: each part goes to a batched stage2d layer (`GridLayer`, `AreaSet`, `PointSet`) or to `EllipseSet`, the new layer for ellipses whose size is data (fitted ring edges, edge-bit dots). Overlay roles only; polarity and bits are shapes. Hover, selected and dimmed states, label level-of-detail, and picking through the stage's hit-test index.
  - **Pure pieces**: `cornerGrid`, `gridEdges`, `idByGrid`, `markerPolygons`, the `TARGET_MARKERS` glyph path generators (`directed`, `circle-white`, `circle-black`), `packAxes` / `unpackAxes` and `ellipsePath`.
  - `@vitavision/stage2d` (`>=0.10.0 <1`, for `AreaSet` and `GridLayer`) is a peer dependency: the layers read the stage's context, so the app and this package must share one copy.

### Patch Changes

- Updated dependencies [2f31859]
  - @vitavision/stage2d@0.10.0
