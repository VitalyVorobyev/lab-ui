# @vitavision/overlays

## 0.2.1

### Patch Changes

- 1914f7f: READMEs, Storybook descriptions and editor documentation no longer refer to the project's internal tickets, decision records or private apps; the text now stands on its own.
- Updated dependencies [f2bbd10]
- Updated dependencies [c372abc]
- Updated dependencies [10a673a]
- Updated dependencies [4de3793]
- Updated dependencies [c63afbc]
- Updated dependencies [f2ff333]
- Updated dependencies [c372abc]
- Updated dependencies [0cd879b]
- Updated dependencies [c57c6ef]
- Updated dependencies [df4dfce]
- Updated dependencies [1914f7f]
  - @vitavision/stage2d@0.13.0

## 0.2.0

### Minor Changes

- cc3132a: stage2d gains a pickable ellipse layer, a second marker angle, fit options and a compositor hint; overlays follows.
  
  - `EllipseSet` (and `ellipsePath`) move from `@vitavision/overlays` into stage2d, next to `AreaSet`. It now registers with the stage's hit-test: `hoveredId`, `onHoverChange`, `onItemPress`, `layerId`, `priority`, and `pickable={false}` to stay out of it. The pure index is exported too: `buildEllipseIndex`, `nearestEllipse` (outline within the pointer's radius, else the smallest containing ellipse; true Euclidean distance), `ellipsesInRect`, `pointInEllipse`, `ellipseBounds`. `@vitavision/overlays` re-exports `EllipseSet`, `EllipseSetItem`, `EllipseSetProps` and `ellipsePath`, and `TargetOverlay` draws its rings and edge bits with `pickable={false}`, so its picking is unchanged. Its peer range on stage2d is now `>=0.11.0`.
  - `MarkerShape.path(x, y, unit, angle, angle2)` receives `PointSetItem.angle2` (`undefined` when the item has none); existing shapes ignore it. overlays' `directed` marker reads `angle` and `angle2` directly, so `packAxes` and `unpackAxes` are removed (breaking for overlays: put the two directions in `angle` and `angle2`).
  - `fitScale`, `fitView`, `isFit`, `initialView` and `preserveCenter` take `FitOptions` (`padding` in CSS pixels per side, `upscale: false` to cap fit at 1:1); the defaults give today's numbers. `ImageStage` has a `fit` prop applied to every fit path: `initialView`, the handle's and the context's `fit()`, the `0` key, the double-click toggle, the toolbar's Fit button and `data-fit`.
  - `ImageStage` sets `will-change: transform` (and `data-moving`) on its transformed box while the view changes and for 150 ms after, so a pan stays on the compositor; left on permanently, Chromium keeps the layer at the raster scale it had when the hint was applied and a zoomed-in image goes blurry.

### Patch Changes

- Updated dependencies [cc3132a]
- Updated dependencies [a7fae89]
  - @vitavision/stage2d@0.11.0

## 0.1.1

### Patch Changes

- 2b38012: Ship the compiled `dist/`. 0.1.0 was published without it, so neither the package entry (`dist/index.js`) nor its types resolved; it also carried `workspace:^` ranges in `devDependencies`. The source is unchanged.

## 0.1.0

### Minor Changes

- 5e71fa8: New package: calibration-target overlays on the `@vitavision/stage2d` stage. One `TargetOverlay` draws a chessboard, ChArUco board, marker board, PuzzleBoard, ring grid or a loose set of corners from a normalised `TargetDetection`, in place of a separate overlay and glyph component per board.
  
  - **Input**: `TargetDetection` (`corners`, `markers`, `circles`, `rings`, `edgeBits`, and a `kind`) in image pixels with the pixel centre at integer coordinates. No detector package is imported. `edgeBitsFromPuzzleboard` turns a PuzzleBoard decode (observed edges and the mod-501 alignment) into `edgeBits`.
  - **Drawing**: each part goes to a batched stage2d layer (`GridLayer`, `AreaSet`, `PointSet`) or to `EllipseSet`, the new layer for ellipses whose size is data (fitted ring edges, edge-bit dots). Overlay roles only; polarity and bits are shapes. Hover, selected and dimmed states, label level-of-detail, and picking through the stage's hit-test index.
  - **Pure pieces**: `cornerGrid`, `gridEdges`, `idByGrid`, `markerPolygons`, the `TARGET_MARKERS` glyph path generators (`directed`, `circle-white`, `circle-black`), `packAxes` / `unpackAxes` and `ellipsePath`.
  - `@vitavision/stage2d` (`>=0.10.0 <1`, for `AreaSet` and `GridLayer`) is a peer dependency: the layers read the stage's context, so the app and this package must share one copy.

### Patch Changes

- Updated dependencies [2f31859]
  - @vitavision/stage2d@0.10.0
