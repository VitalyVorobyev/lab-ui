# @vitavision/stage2d

The vitavision 2D image stage: one view transform over a stack of layers, the measurement overlay drawn into it, and the value planes behind a rendered image.

```bash
bun add @vitavision/stage2d @vitavision/ui
```

```css
@import "@vitavision/ui/styles.css";
@import "@vitavision/stage2d/styles.css";
```

**Image viewing** — `ImageStage`, a pannable/zoomable frame that transforms every stacked
child layer together (image, mask, measurement overlay, interactive handles) so they never
drift apart, with `StageToolbar` / `StageReadout` as the in-canvas controls and `useStage()`
as the way a layer reads the transform. The arithmetic behind it is pure and exported —
`fitScale`, `fitView` (both take `FitOptions`), `toImage`, `toScreen`, `zoomAbout`, `clampView`, `frameRect`,
`preserveCenter`, `steppedScale`. See "The image stage" below. `ZoomPanCanvas` is its
deprecated predecessor, still exported unchanged.

`ImageLayer` draws the photograph at its natural size. It can show a `preview` tier until
the stage would magnify it, then load the full image and keep it, and it turns pixelated past
`pixelatedAbove`. `StageButton` takes a `hint` and a `shortcut` for a richer tooltip, and
`StageLayersMenu` is a layers button for `StageToolbar`. Code outside the stage, such as an
inspector's "frame this", drives it through `ImageStage`'s `ref` (`StageHandle`: `frame`,
`fit`, `zoomTo`). `initialView="fit"` opens a `null` view at fit even when the image would fit
at 1:1. `fit={{ padding, upscale }}` gives every fit path (the initial fit, `fit()`, the `0` key, the
double-click toggle, the toolbar button, `data-fit`) a margin in CSS pixels and, with `upscale: false`, a cap
at 1:1. The transformed box carries `will-change: transform` (and `data-moving`) only while the view
moves and for 150 ms after: always on, Chromium keeps the layer at the raster scale it had when the hint
was applied and a zoomed-in image and its strokes stay blurry.
`api/mapValues.ts` decodes the `VAM1` float32-plane wire format into indexable values
(`decodePlane`, `valueAt`, `valuesAt`, `fractionOf`, `fetchPlane`) — it never draws;
colour range and colormap stay the caller's decision.

**Region of interest**: `RectRoiEditor` is an editable axis-aligned region.
- Eight handles resize it and the interior moves it; with `draw`, a drag on the image draws a
  new one.
- It stays inside `bounds` (the image by default) and is never smaller than `minSize`.
- `onValueChange` follows the drag, and `onCommit` fires once the gesture ends.
- Arrow keys move it, and Alt + arrows resize it.

Its arithmetic (`resizeRect`, `moveRect`, `clampRect`, `rectFromCorners`, `sameRect`) is
exported and tested without a DOM.

**Selectable lines**: `PolylineSet` draws many polylines (contours, segments, matches) as a few
batched paths and picks through a spatial index, not the DOM.
- **States:** hover, selection and dimming follow the visual-language states.
- **Selecting:** click selects, ⌘/Ctrl-click toggles, and Shift-drag or `marquee` draws a
  rubber band.
- **Pure functions:** `buildPolylineIndex`, `nearestPolyline`, `polylinesInRect` and
  `polylinePath` are pure; hit-testing is microseconds at 100k segments
  (`docs/measurements/u4-polyline-set.md`).

**Points**: `PointSet` draws many points (corners, ring centres, keypoints, labelled landmarks) as
a few batched paths, with a marker per kind (`dot`, `plus`, `cross`, `square`, `hollow`,
`directed`, or your own path generator) and the same states as `PolylineSet`, plus a ring on the
selected. Labels appear where points are 24 screen px apart.
- **Pointer:** `onHoverChange` and `onItemPress` come from the stage's pointer handling and the
  layer's index, not from per-point elements.
- **Pure functions:** `buildPointIndex`, `nearestPoint`, `pointsInRect` and `thinPoints`
  (`docs/measurements/l6-2a-points-hit-test.md`).

**Areas**: `AreaSet` draws many closed regions (marker quads, drawn polygons, region annotations) as a
few batched paths, each an outline with its 12 % fill, in a role (`feature`, `model`, `structure`).
- **Pointer:** a press near an outline picks that region, else the smallest region containing it;
  `onHoverChange` and `onItemPress` as `PointSet`.
- **Quads:** `firstVertexTick` ticks corner 0; labels sit at the centre, where regions are 24 screen px apart.
- **Pure functions:** `buildAreaIndex`, `nearestArea`, `areasInRect`, `pointInPolygon`, `areaPath`
  (`docs/measurements/l6-2b-areas-grid-heatmap.md`).

**Grids**: `GridLayer` draws a detected lattice: nodes `{ id, i, j, x, y }` as a `PointSet` (`plus` by default)
and the edges between lattice neighbours as two batched paths, each axis restyled through `edges`.
`indexLabels` labels nodes with `i,j`. `latticeEdges(nodes)` is the pure neighbour search.

**Heatmaps**: `HeatmapLayer` draws a `ValuePlane` through a `colormap` (`(t) => [r, g, b]`; the
`@vitavision/charts` maps fit) or an `rgba` buffer as one image, rasterised in an effect, placed over the
image (or `rect`), pixelated from 4 CSS px per cell. `rasterizePlane` and `planeRange` are pure.

**Rotated shapes**: `ShapeEditor` edits `{ cx, cy, width, height, rotation }` as a rectangle or an ellipse:
eight handles resize in the shape's own frame (the opposite side stays put), a rotation handle turns it, the
interior moves it, arrow keys nudge it. **Rotation is radians, clockwise on screen** (Konva's degrees are
`deg * Math.PI / 180`; `shapeFromCorner` converts Konva's rotate-about-the-corner `Rect`). The arithmetic
(`resizeShape`, `rotateShape`, `moveShape`, `shapeHandlePoint`, …) is pure.

**Drawing and moving**: `DraftShape` is the dashed preview of a point, line, polyline, polygon, rectangle or
ellipse being drawn, and `MarqueeRect` the rubber band; `useShapeDrag` turns a press on an item into
image-space displacements with click slop, for select → drag → commit of manual shapes (`translatePoints`
shifts flat coordinates).

**Ellipses**: `EllipseSet` draws many ellipses whose size is data (fitted rings, edge-bit dots, drawn ellipses) as
exact arcs in a few batched paths, with the states of `AreaSet`. It is picked like `AreaSet`: a press near an
outline picks that ellipse, else the smallest containing it; `pickable={false}` leaves a decorative layer out.
- **Pure functions:** `buildEllipseIndex`, `nearestEllipse`, `ellipsesInRect`, `pointInEllipse`, `ellipseBounds`, `ellipsePath`.

**Hit-test**: `useStageHitTest()` answers "what is under the pointer" across layers, ranked by
`STAGE_HIT_PRIORITY` (points above lines above areas above images). `PointSet`, `PolylineSet`,
`AreaSet`, `EllipseSet` and `GridLayer` answer it; `useStageHitLayer` registers any other layer. `ImageStage` also takes `panButton`,
`doubleClickFit` and `touchPan`, and handles two-finger pinch.

**Tool model**: `StageSurface` is the one full-frame press target per stage.
- **Claiming:** its `onPress` returns a drag to claim a press, or nothing to let the stage pan.
- **Drags:** `useStageDrag` starts a window-level drag from any element, e.g. a handle.
- **Why window-level:** two full-frame layers would be one that always wins, and pointer
  capture routes moves to the pressed element.

**Annotation layers** — `ContourEditor` edits ordered source-image pixel-center
vertices; `MaskEditor` paints or erases a row-major binary mask with a bounded
source-pixel brush. Both are controlled layers for `ImageStage`: the caller owns
the geometry, undo history, persistence, and approval policy. `onCommit` marks
the end of a gesture. The contour supports arrow-key nudging, Insert for a
midpoint, and Delete; the mask supports arrow-key brush movement and Enter.
Raster masks use `Uint8Array` values 0/1 with exactly `width × height` entries.

**Measurement overlay** — `MeasureOverlay` is a pure-props SVG layer meant to sit inside
`ImageStage`'s transformed stack, drawing `point`, `segment`, `circle`, `arc`, `caliper`
and `dimension` primitives given in **source-image pixel coordinates**, each with an
optional `tone`. No app state and no DOM measurement: a `strokeScale` prop (the current
image-px→screen-px scale) is all it needs to keep strokes and labels a constant size on
screen at any zoom. Its geometry lives in `measureGeometry.ts` and is tested without React.

Overlay and `LineProfile` edge marks share one tone vocabulary, `MeasureTone`/`toneColor`
(`signal` / `normal` / `defect` / `warn` / `muted`). `Badge`'s `Tone` is a separate,
verdict-badge vocabulary and keeps its own name.

### The image stage

```tsx
const [view, setView] = useState<StageView | null>(null); // null = "open at a sensible view"

<ImageStage
  image={{ width: 1280, height: 1024 }}
  view={view}
  onView={setView}
  toolbar={<StageToolbar />}
  readout={<StageReadout cursor={cursor} />}
  onHover={setCursor}
>
  <ImageLayer src={fullUrl} preview={{ src: previewUrl, width: 1024 }} alt={filename} />
  <MeasureOverlay nativeWidth={1280} nativeHeight={1024} primitives={overlay} strokeScale={view?.scale ?? 1} />
  <MyInteractiveLayer />
</ImageStage>
```

Three things about it are load-bearing, and each replaces a way `ZoomPanCanvas` could be
held wrong:

**The stage is laid out at the image's own pixel size** and carries the whole transform.
A child `<svg viewBox="0 0 W H" class="absolute inset-0">` is therefore registered with the
photograph at every viewport size, with no aspect ratio for a caller to remember to set and
no letterbox to correct for. Layers are absolutely positioned and sized by the stage; they
do no scaling of their own.

**Image coordinates name pixel centres.** `i` means the centre of pixel `i`, which is what
every image-processing result means by it; CSS and SVG mean the pixel's *leading edge*. The
half pixel between the two conventions lives in `PIXEL_CENTRE`, and it is carried by
`toImage` / `toScreen` and by `imageViewBox(image)` — which is what an SVG layer drawn in
image coordinates must use for its `viewBox` instead of `0 0 W H`. `MeasureOverlay` already
does. It is invisible at fit and four screen pixels of error at 8×, which is exactly the zoom
at which someone is checking whether an overlay lands on the edge it claims to mark.

**`scale` is CSS pixels per image pixel.** `1` is 100%; fit is `fitScale(box, image)`, a
value rather than a magic constant, so zooming *out* past fit is expressible (down to
`MIN_SCALE_VS_FIT` × fit). A `ResizeObserver` keeps a fit view fit and re-centres any other
view on the image point that was centred before, so a window resize moves the frame around
the picture rather than the picture around the frame.

**Panning is the default reading of a press, and a layer opts out by stopping propagation.**
That is what lets an interactive layer — a draggable ROI handle, a clickable contour — live
*inside* the transform. A layer that must yield to the hand tool or a held space bar checks
`useStage().panMode` before claiming the press; `onBackgroundClick` fires for a press that
reached the stage and never became a drag, which is how a layer hears "deselect".

Gestures: wheel zooms about the cursor, double-click toggles fit against **the view you were
just at**, space or the middle button pans from anywhere, and `+` / `-` / `0` (fit) / `1`
(100%) / arrows work when the stage has focus.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
