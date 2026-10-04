# @vitavision/stage2d

## 0.11.0

### Minor Changes

- cc3132a: stage2d gains a pickable ellipse layer, a second marker angle, fit options and a compositor hint; overlays follows (lab-ui#88).
  
  - `EllipseSet` (and `ellipsePath`) move from `@vitavision/overlays` into stage2d, next to `AreaSet`. It now registers with the stage's hit-test: `hoveredId`, `onHoverChange`, `onItemPress`, `layerId`, `priority`, and `pickable={false}` to stay out of it. The pure index is exported too: `buildEllipseIndex`, `nearestEllipse` (outline within the pointer's radius, else the smallest containing ellipse; true Euclidean distance), `ellipsesInRect`, `pointInEllipse`, `ellipseBounds`. `@vitavision/overlays` re-exports `EllipseSet`, `EllipseSetItem`, `EllipseSetProps` and `ellipsePath`, and `TargetOverlay` draws its rings and edge bits with `pickable={false}`, so its picking is unchanged. Its peer range on stage2d is now `>=0.11.0`.
  - `MarkerShape.path(x, y, unit, angle, angle2)` receives `PointSetItem.angle2` (`undefined` when the item has none); existing shapes ignore it. overlays' `directed` marker reads `angle` and `angle2` directly, so `packAxes` and `unpackAxes` are removed (breaking for overlays: put the two directions in `angle` and `angle2`).
  - `fitScale`, `fitView`, `isFit`, `initialView` and `preserveCenter` take `FitOptions` (`padding` in CSS pixels per side, `upscale: false` to cap fit at 1:1); the defaults give today's numbers. `ImageStage` has a `fit` prop applied to every fit path: `initialView`, the handle's and the context's `fit()`, the `0` key, the double-click toggle, the toolbar's Fit button and `data-fit`.
  - `ImageStage` sets `will-change: transform` (and `data-moving`) on its transformed box while the view changes and for 150 ms after, so a pan stays on the compositor; left on permanently, Chromium keeps the layer at the raster scale it had when the hint was applied and a zoomed-in image goes blurry.
- a7fae89: Touch input, so an app can use `StageSurface`, `PolylineSet` and `ShapeEditor` without writing its own surface (lab-ui#88).
  
  - **`StageSurface` tells a touch from a mouse.** `StagePress` gains `touch`, `client` (client coordinates, for anchoring a tooltip) and `radius` (the hit-test tolerance in screen pixels: 12 for a touch, 6 otherwise). `StageDrag` gains `claimsTouch`. A touch whose drag does not set it is now *watched*, not claimed: the stage still pans (one-finger mode) and pinches, `onMove` fires once the finger leaves the tap slop, `onEnd(point, event, moved)` fires on release (`moved` is `false` for a tap), and `onCancel` fires on `pointercancel` or when a second finger lands. `onHover` is no longer called for a touch. New `onDoubleClick` prop: when given, the surface handles the double click and the stage's double-click-to-fit does not run. **Behaviour change:** an unclaimed touch used to be claimed like a mouse press and no longer is, so act in `onEnd` when `moved` is `false`; return `claimsTouch: true` to keep the old behaviour.
  - **`PolylineSet` can step aside.** New `interactive` prop, on by default only when `onItemPress`, `onSelect`, `onHover`, `onHoverChange` or `marquee` is given. When off, the layer renders no press target, so a draw tool's `StageSurface` below receives the press, while `useStageHitTest` still finds the lines. On an interactive layer a touch is no longer claimed (the stage can pan and pinch) and a line is selected on a tap.
  - **`ShapeEditor` decides a press once.** The nearest handle wins over the interior, so a small shape's corner is no longer a move. The band along the outline (6 px for a mouse, 12 px for a touch) moves the shape, so a rotated box or an ellipse can be grabbed at its edge. A press beyond the band is declined and reaches the stage. A second finger landing during a touch edit cancels it: the shape reverts and nothing is committed.

## 0.10.0

### Minor Changes

- 2f31859: `AreaSet`, `GridLayer`, `HeatmapLayer`, a rotated `ShapeEditor`, draft previews and shape moving (L6-2b). All additive.
  
  - **`AreaSet`**: closed regions (marker quads, polygons, annotations) as batched outline-plus-12 %-fill paths per state and role, with hover, selected and dimmed states, labels where regions are 24 screen px apart, an optional `firstVertexTick` on corner 0, and `onHoverChange` / `onItemPress` at `STAGE_HIT_PRIORITY.area`. A press near an outline picks that region, else the smallest region that contains it. Exported with the pure `buildAreaIndex`, `nearestArea`, `areasInRect`, `pointInPolygon`, `areaPath` and `areaCentre`.
  - **`GridLayer`**: a detected lattice. Nodes `{ id, i, j, x, y }` are a `PointSet` (`plus` by default, picked at point priority); the edges between lattice neighbours are two batched paths, restyled per axis through `edges`; `indexLabels` shows `i,j`. Exported with the pure `latticeEdges`.
  - **`HeatmapLayer`**: a `ValuePlane` and a `colormap` (`(t) => [r, g, b]`, optional `range` and `channel`), or an `rgba` buffer with its size, as one image placed over the image (or at `rect`, in image coordinates), with `opacity`, `visible` and pixelated rendering from 4 CSS px per cell. Rasterised in an effect into an object URL that is revoked when replaced and on unmount; server-rendering safe. Exported with the pure `rasterizePlane` and `planeRange`.
  - **`ShapeEditor`**: a rotated rectangle or ellipse `{ cx, cy, width, height, rotation }` with eight handles that resize in the shape's own frame (the opposite side stays put), a rotation handle (Shift rounds to 15°), move by the interior, `minSize`, and keyboard nudges (arrows, Alt + arrows, `[` / `]`). **`rotation` is in radians, clockwise on screen.** Exported with the pure `resizeShape`, `rotateShape`, `moveShape`, `shapeHandlePoint`, `rotationHandlePoint`, `shapeHandleCursor`, `toShapeFrame`, `fromShapeFrame`, `shapeFromCorner`, `shapeCorner`, `sameShape` and `normalizeAngle`.
  - **`DraftShape`** and **`MarqueeRect`**: the dashed preview of a point, line, polyline, polygon, rectangle or ellipse being drawn, and the rubber band of a multi-select.
  - **`useShapeDrag`** and `translatePoints`: a press on an item becomes image-space displacements with click slop, for select → drag → commit of manual shapes.

## 0.9.0

### Minor Changes

- 97fbe12: `PointSet`, one hit-test across layers, and right-button and touch input on `ImageStage` (L6-2a).
  
  - **`PointSet`**: thousands of points as a few batched paths, with a marker per kind from the overlay grammar (`dot`, `plus`, `cross`, `square`, `hollow`, `directed`; add your own through `markers`, a path generator), hover, selected (with ring) and dimmed states, labels only where points are 24 screen px apart (at most 200), and `onHoverChange` / `onItemPress`. Exported with `MARKER_SHAPES`, `circlePath` and the pure `buildPointIndex`, `buildPointIndexFrom`, `nearestPoint`, `pointsInRect` and `thinPoints`.
  - **Hit-test**: `useStageHitTest()` returns `hitTest(point, radiusScreenPx = 6)` and `hitTestAll`, ranked by `STAGE_HIT_PRIORITY` (points above lines above areas above images), so a press handler decides select, draw or pan with one question. `PointSet` and `PolylineSet` answer it; `useStageHitLayer` registers any other layer.
  - **`PolylineSet`**: additive `onHoverChange`, `onItemPress`, `layerId` and `priority`. A `PointSet` marker over a line now takes the press.
  - **`ImageStage`**: `panButton` (`"left" | "middle" | "right"`, or a list; the right button also suppresses the context menu), `doubleClickFit` (default `true`), `touchPan` (`"one-finger"` by default). Two fingers pinch-zoom about their midpoint and pan; a tap is a press. The viewport sets `touch-action: none`. Defaults leave mouse behaviour unchanged.

## 0.8.1

### Patch Changes

- Updated dependencies [3a82c8f]
  - @vitavision/ui@0.11.0

## 0.8.0

### Minor Changes

- 62df12d: Add a stage handle, `initialView`, `ImageLayer`, `StageButton` hints, `StageLayersMenu`, and fix zoom stepping at the ends of the range.
  
  - **`ImageStage` takes a `ref`** (`StageHandle`: `frame`, `fit`, `zoomTo`) for code outside
    the stage, such as an inspector's "frame this contour". It also takes
    `initialView: "auto" | "fit"`. `"fit"` opens a `null` view at fit even when the image would
    fit at 1:1.
  - **`ImageLayer` draws the photograph at its natural size.**
    - With a `preview` tier it shows the preview until the stage would magnify it, then loads
      `src`. It keeps `src` when zooming back out, and the preview stays underneath while it
      loads.
    - It is pixelated past `pixelatedAbove` (default 4).
  - **`StageButton` takes `hint` and `shortcut`.** With either, the tooltip is the ui `Tooltip`
    showing the label, the hint and the key as a `Kbd`. The shortcut is also set as
    `aria-keyshortcuts`. Without them, the native `title` is unchanged.
  - **`StageLayersMenu`:** a layers button opening a menu of layer toggles. It shows as pressed
    while a layer is hidden.
  - **`steppedScale` steps onto the floor or the ceiling** when they lie between ladder steps.
    Before, "zoom out" stayed enabled below 0.125 (and "zoom in" above 32) and did nothing.
- 2ac307d: Add `RectRoiEditor`, an editable region of interest inside an `ImageStage`.
  
  - **Editing.** Eight handles resize the region (dragging through the opposite edge flips it),
    the interior moves it, and with `draw` a drag on the image draws a new one.
  - **Limits.** The region stays inside `bounds` (the image by default) and is never smaller
    than `minSize`.
  - **Events.** `onValueChange` follows the drag, and `onCommit` fires when the gesture ends.
  - **Keyboard.** Arrow keys move the region (Shift ×10), and Alt + arrows resize it.
  - **Rendering.** Handles and the haloed outline are a constant size on screen.
  - **Panning.** The hand tool and a held space bar still pan.
  
  The pure arithmetic is exported: `resizeRect`, `moveRect`, `clampRect`, `rectFromCorners`,
  `roiHandlePoint`, `sameRect`, `ROI_HANDLES`, `ROI_HANDLE_CURSOR`.
- 9981148: Add `PolylineSet` (selectable polylines) and the stage tool model (`StageSurface`, `useStageDrag`).
  
  - **`PolylineSet`:** many open or closed polylines, with ids, over the image.
    - Drawn as a few batched paths, one per state and colour. The states are default 1.5 px,
      hover 2 px, selected 2.5 px and dimmed at 35 %, each with a halo.
    - The pointer is resolved by a spatial index: hit p95 is 6 µs at 100k segments.
    - Click selects (`replace`), and ⌘/Ctrl-click toggles.
    - A rubber band starts with Shift-drag from a line, or any drag with `marquee`. It selects
      every line it touches; with ⌘/Ctrl it adds them, and an empty band clears.
    - Hover is controllable from a list beside the stage.
    - Above `vertexScale` the hovered and selected lines show their points.
  - **`buildPolylineIndex`, `nearestPolyline`, `polylinesInRect`, `polylinePath`,
    `polylineBounds`:** the pure index behind it.
  - **`StageSurface`:** one full-frame press target per stage. `onPress` returns a `StageDrag`
    to claim a press, or nothing to let the stage pan.
  - **`useStageDrag`:** a window-level drag started from any element. It survives the pointer
    leaving the canvas and does not depend on pointer capture.
- ccaa3d9: Add overlay role tokens and `useScreenPx`, and extend `MeasureOverlay` additively with a `polyline` primitive, `role`, and per-primitive `id` and `state`.
  
  - **Role tokens.** `styles.css` now defines the visual-language §5 overlay roles:
    `--stage-feature`, `--stage-model`, `--stage-structure`, `--stage-selection`,
    `--stage-label`, `--stage-halo`. They are also Tailwind colours (`stroke-stage-feature`).
    - `overlayRole(role)` gives the SVG paint.
    - `OverlayRole`, `OverlayState`, `OVERLAY_ROLES`, `OVERLAY_STATE_WIDTH` and
      `OVERLAY_STATE_OPACITY` are exported.
  - **`useScreenPx()`** turns screen pixels into image pixels, for strokes and handles that stay
    a constant size at every zoom.
  - **`MeasureOverlay` is additive only; existing primitives draw as before.**
    - A `polyline` primitive (flat points, `closed`, `dashed`, `label`) draws a model outline as
      one path instead of one `segment` per edge.
    - Every primitive takes optional `id`, `state` (`hover` thickens, `selected` adds a ring in
      the selection colour, `dimmed` fades) and `role` (a role colour instead of `tone`).
    - Each primitive is a `<g>` with `data-kind`, plus `data-id` and `data-state` when given.
  - **New-layer defaults.** `PolylineSet` and `RectRoiEditor` default to the role colours:
    feature and selection lines, a selection-coloured region, and a halo.

### Patch Changes

- b77cf7c: On a narrow canvas the toolbar collapses and the readout wraps. Below 30rem of canvas width, measured with a container query on the stage itself, `StageToolbar` hides zoom out, zoom in and 100%; the percentage menu and the `+` / `-` / `1` keys still reach them. The readout moves onto its own line above the toolbar instead of being clipped to nothing.

## 0.7.2

### Patch Changes

- Updated dependencies [c2d73ad]
  - @vitavision/ui@0.10.0

## 0.7.1

### Patch Changes

- Updated dependencies [5115556]
- Updated dependencies [a037a0f]
  - @vitavision/ui@0.9.0

## 0.7.0

### Minor Changes

- 98411e2: Add reusable contour and binary-mask editing layers for ImageStage. Contour vertices support pointer dragging and keyboard edits; masks support bounded paint/erase strokes in source-image coordinates.

### Patch Changes

- Updated dependencies [a019b87]
  - @vitavision/ui@0.8.0

## 0.6.1

### Patch Changes

- bab71f8: The canvas frame and the zoom and coordinate chips use `rounded-control` (6 px) instead of a bare `rounded`.
- Updated dependencies [bab71f8]
  - @vitavision/ui@0.7.0

## 0.6.0

### Minor Changes

- 7c6c4e4: Split `@vitavision/lab-ui` into four packages: `@vitavision/ui` (tokens, theme, primitives),
  `@vitavision/forms` (`SchemaForm`), `@vitavision/charts` and `@vitavision/stage2d` (`ImageStage`,
  `MeasureOverlay`, value planes). `@vitavision/lab-ui` is now a deprecated re-export of the four
  with the identical 0.5 surface; its `styles.css` imports the four stylesheets, each of which
  declares its own Tailwind `@source`, so consumers no longer need an `@source` line.
  
  Optional props that forward a value now accept `undefined` explicitly (for consumers on
  `exactOptionalPropertyTypes`).
- 9aeeb5d: `@vitavision/stage2d` meets the PLAN §4 Definition of Done (API only; the rendering engine is
  unchanged until L6).
  
  - **`ImageStage` keeps a controlled opening view.** A non-null `view` passed at mount is no longer
    replaced by fit on the first measurement; it is kept, clamped to what the viewport allows.
  - **`ImageStage` no longer re-anchors after mount.** The first measurement now reads the content
    box, the same box `ResizeObserver` reports, so the view no longer jumps by the border's width
    once the observer fires. Client ↔ image conversions (`useStage().toImage` / `toClient`,
    `onHover`, wheel and `zoomTo` anchors) now measure from the padding box, where the stage
    actually sits: a pointer over a pixel no longer reads a border's width off it.
  - **State as `data-*`.** `ImageStage`'s viewport carries `data-fit`, `data-panning` and
    `data-pan-mode`; `ZoomPanCanvas` carries `data-fit` and `data-panning`; `StageToolbar` carries
    `data-fit` and its percentage button `data-state="open" | "closed"`; a toggling `StageButton`
    carries `data-state="on" | "off"`.
  - **`className` everywhere.** `StageButton`, `StageReadout` and `StageToolbarDivider` accept
    `className`, merged with `cn`. `StageButton` also passes other button props, including `ref`,
    through to its `<button>`.
  - **New prop types:** `StageToolbarProps`, `StageButtonProps`, `StageReadoutProps`,
    `StageToolbarDividerProps`, `ZoomPanCanvasProps`.
  - `ZoomPanCanvas` (deprecated) uses the `canvas` token for its background instead of a hex
    literal, and is marked `@deprecated` in its TSDoc.
  - Every export has TSDoc; the API report has no `ae-undocumented` entries.

### Patch Changes

- Updated dependencies [038fcec]
- Updated dependencies [7c6c4e4]
- Updated dependencies [51bdec5]
- Updated dependencies [b60a923]
  - @vitavision/ui@0.6.0
