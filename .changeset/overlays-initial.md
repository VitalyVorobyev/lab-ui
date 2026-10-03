---
"@vitavision/overlays": minor
---

New package: calibration-target overlays on the `@vitavision/stage2d` stage (L7-1). One `TargetOverlay` draws a chessboard, ChArUco board, marker board, PuzzleBoard, ring grid or a loose set of corners from a normalised `TargetDetection`, replacing the per-board overlays and glyph components each app wrote for itself.

- **Input**: `TargetDetection` (`corners`, `markers`, `circles`, `rings`, `edgeBits`, and a `kind`) in image pixels with the pixel centre at integer coordinates. No detector package is imported. `edgeBitsFromPuzzleboard` turns a PuzzleBoard decode (observed edges and the mod-501 alignment) into `edgeBits`.
- **Drawing**: each part goes to a batched stage2d layer (`GridLayer`, `AreaSet`, `PointSet`) or to `EllipseSet`, the new layer for ellipses whose size is data (fitted ring edges, edge-bit dots). Overlay roles only; polarity and bits are shapes. Hover, selected and dimmed states, label level-of-detail, and picking through the stage's hit-test index.
- **Pure pieces**: `cornerGrid`, `gridEdges`, `idByGrid`, `markerPolygons`, the `TARGET_MARKERS` glyph path generators (`directed`, `circle-white`, `circle-black`), `packAxes` / `unpackAxes` and `ellipsePath`.
- `@vitavision/stage2d` (`>=0.9.0 <1`) is a peer dependency: the layers read the stage's context, so the app and this package must share one copy.
