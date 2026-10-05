# @vitavision/stage2d

## 0.13.0

### Minor Changes

- f2bbd10: New `CompareLayer`: two registered images of the same size compared in place inside an `ImageStage`, as a checkerboard, a wipe or their difference.
  
  - `<CompareLayer a={referenceUrl} b={foundUrl} mode="checker" | "wipe" | "difference" alt="…" />`. Both images are laid out at the stage's pixel size, like `ImageLayer`, so they stay registered with each other and with every overlay.
  - **`checker`**: alternate squares of A and B, `cell` image pixels across (default 32), A at the top-left.
  - **`wipe`**: A before a divider and B after it. `orientation` is `"vertical"` (A on the left, the default) or `"horizontal"` (A above). The divider's place is `split` / `defaultSplit` / `onSplitChange`, the fraction of the image before it (default 0.5, clamped to 0..1). Drag the divider or its knob, which stays in the middle of the visible part of the divider; the drag is claimed, so the stage does not pan.
  - **`difference`**: B blended over A with `mix-blend-mode: difference` in an isolated group, brightened by `gain` (default 1). Identical pixels are black. It is the per-channel difference of the sRGB-encoded values the browser composites, not of linear light: use it to see where the images differ, not to measure by how much.
  - Everything is CSS on the second image (a mask, a clip, a blend), never a canvas. Past `pixelatedAbove` (default 4×) both images are drawn as blocks.
  - **Accessibility**: the two images are one picture, `role="img"` named by `alt`. In wipe mode the knob is a slider from 0 to 100, the share of A, read as e.g. "40 % A". Arrow keys move it 1 % (10 % with Shift), Page Up and Page Down 10 %, and Home and End go to either edge; these keys do not pan the stage. `labels` (default `["A", "B"]`) names the two images for the slider and for the tags beside the knob.
  - `CompareMode` and `CompareOrientation` are exported with it.
- c372abc: `ContourEditor` gains a brush and an eraser.
  
  - **`mode?: "vertex" | "brush" | "erase"`** (default `"vertex"`, as before) and **`brushRadius?: number`** (image pixels, default 20). In `"brush"` and `"erase"` mode an editable contour covers the image with its own press target (`data-tool-surface`), shows the brush's footprint under a hovering mouse or pen, and hides its vertex handles. A press whose brush does not reach the contour is declined, so the stage pans. Both gestures start only once the pointer has moved 3 screen pixels.
  - **Brush.** A drag pushes the contour with a soft round brush centred where the press landed (`deformContour`, always from the contour as it was at the press), held inside `bounds`. `onChange` follows the drag and `onCommit` fires once on release.
  - **Erase.** A drag along the contour previews the stretch it would remove, dashed in the defect colour (`data-erase-preview`). On release, the new **`onErase?: (pieces, range) => void`** receives the pieces that are left (open polylines, see `eraseArc`) and the erased stretch as arc lengths `{ start, end }`. The editor does not change `points` itself; the app replaces the contour with the pieces. On a closed contour the stretch runs the shorter way round, and what is left is one open piece: pass it back as `points` with `closed={false}` to keep editing it.
  - The SVG carries `data-mode` while editable.
- 10a673a: `ContourEditor`'s outline no longer intercepts presses, and layers can take double-clicks through the stage's hit-test.
  
  - **Double-clicks through the hit-test.** `useStageHitLayer` takes `onDoubleClick?: (id, point) => boolean | void`. `ImageStage` offers a double-click to the best item under it among layers that take one (return `false` to decline, and the next is asked) before its own double-click to fit; when a layer takes it, the view stays where it is. Not offered while the hand tool is on or space is held.
  - **`ContourEditor` answers the hit-test.** While `editable`, it registers its outline with the stage's hit-test: `pick` finds the nearest segment (the id is the segment's index), and a double-click near the outline inserts a vertex there, as before. New `layerId?: string` and `priority?: number` (default `STAGE_HIT_PRIORITY.line`) place it among other layers.
  - **Click slop on vertices.** A vertex drag starts only once the pointer has moved 3 screen pixels, so a jittery click on a vertex no longer changes the contour or calls `onCommit`.
  
  **Behaviour changes:**
  
  - The transparent band along an editable contour's outline is gone. A press on the outline now reaches the layers below it (a region's `onItemPress`, a `StageSurface`), or pans the stage when nothing takes it; it used to be swallowed by the editor. The vertices still take their own presses.
  - A double-click within the pointer's tolerance of an editable contour's outline inserts a vertex and does not toggle fit; a double-click elsewhere toggles fit as before. With `doubleClickFit={false}` the insertion works the same. The double-click event now bubbles on past the stage, as every other double-click on it does.
  - A press on a vertex that moves less than 3 screen pixels is a click: no `onChange`, no `onCommit`.
- 4de3793: New `DatumEditor`: a frame on the image, an origin and the direction of its i axis, moved and turned like an object.
  
  - **Value**: `Datum { origin: { x, y }; angle }`, the angle in radians, clockwise on screen from `+x` (the same convention as `RotatedShape.rotation`). It takes `value` / `defaultValue` / `onValueChange`, and `onCommit` once a drag is released or a key pressed. Without a value it starts at the image's centre, pointing along `+x`.
  - **Glyph**: a ring (7 screen px) at the origin, the i axis as an arm (`armLength`, 40 screen px by default) ending in a rotation handle, and the j axis at half the length, a quarter turn clockwise on screen. All of it is drawn over a halo, at a constant size on screen, in the overlay `model` colour unless `stroke` is given.
  - **Pointer**: drag the ring to move the origin, or the arm or its handle to turn the datum about the origin. A press grabs whichever is nearer, and nothing moves until the pointer has travelled 3 px, so a click does not nudge it. A turn keeps the point of the arm that was grabbed under the pointer, so it does not jump. Shift rounds the angle to `angleSnap` (π/12, i.e. 15°); `snapAlways` rounds every turn. `originSnap` rounds the origin to a grid of that many image pixels, and `bounds` keeps it inside a rectangle (the image by default). `rotatable={false}` fixes the angle, and `editable={false}` only draws the datum.
  - **Keyboard**: the origin is a focusable button (`aria-roledescription="datum"`, named with its numbers, e.g. "Datum: origin 200, 150, angle 0°"). Arrow keys move it one image pixel (ten with Shift, or grid steps with `originSnap`), and `[` / `]` turn it by 1° (15° with Shift). These keys do not pan the stage.
  - The arithmetic is exported for apps that draw their own: `datumAxes`, `moveDatum`, `rotateDatum`, `datumPress` and the glyph sizes `DATUM_RING_PX`, `DATUM_ARM_PX` and `DATUM_HANDLE_PX`.
  - New `snapAngle(angle, step)`: rounds an angle to a multiple of a step. `rotateShape` now uses it and behaves as before.
- c63afbc: `MeasureOverlay` draws a halo under role-coloured marks, and gains a `segments` primitive for many unconnected segments in one element.
  
  - **Halo.** A primitive with a `role` (`feature`, `model`, `structure`) is now drawn over a dark band in the overlay's halo colour: the same geometry, 2 screen px wider, at 60 % opacity. Its label gets a 3 px halo behind the glyphs (`paint-order: stroke`). A role-coloured mark and its label therefore hold on a bright part of the image, where they used to wash out. A selected mark's halo sits under its selection ring and is 2 px wider than the ring.
  - **`halo` prop**: `"role"` (the default) as above; `"all"` gives every primitive a halo, verdict tones included; `"none"` turns them off. Primitives with a `tone` and no `role` look exactly as before under the default, so pass `halo="none"` to keep role-coloured marks without a halo too.
  - **`segments` primitive** (`SegmentsPrimitive`): `{ kind: "segments", points: [x1, y1, x2, y2, …] }`, with the usual `tone` / `role`, `dashed`, `label`, `id` and `state`. Every segment is drawn in one path, so thousands of ticks cost one element; use it for marks stored in no particular order, which a `polyline` would join. A trailing partial segment is ignored, and a segment with a non-finite coordinate is skipped rather than breaking the path. The path builder is exported as `segmentsPath(points)`.
  - **The `MeasurePrimitive` union has a new member.** Code that switches over `primitive.kind` and checks the switch is exhaustive needs a `"segments"` case (or a default case) to compile.
  - The selection ring under a selected dashed mark now breaks where the mark does, and a dimension's value is no longer written a second time, invisibly, into its selection ring.
- f2ff333: `MeasureOverlay` can be hovered and picked by primitive `id`, so an app no longer hit-tests caliper boxes or contours itself.
  
  - **`onHoverChange(id | null)`** and **`onItemPress(id, event)`** make the overlay pickable. It then answers the stage's hit-test: the pointer picks the nearest primitive that has an `id`, within the stage's pointer tolerance (6 screen px for a mouse, 12 for a touch). A dot, a filled circle and a caliper box are picked anywhere inside; every other kind by its strokes (a circle's or an arc's rim, a dimension's lines, a caliper's arrow). On a tie the later primitive, drawn on top, wins. Primitives without an `id` are drawn but never picked.
  - A press on a primitive is claimed, so the stage does not pan from it. Return `false` from `onItemPress` to decline it: the press then goes to the next layer under the pointer, or to the stage.
  - The hovered primitive is drawn in the hover state (a selected one stays selected). Pass **`hoveredId`** when the app controls hover, for example from a table beside the stage; otherwise the overlay tracks the pointer's hover itself. The SVG carries `data-hovered`, and the hovered primitive's `<g>` carries `data-state="hover"`.
  - **`layerId`** and **`priority`** (default `STAGE_HIT_PRIORITY.line`) place the overlay among the stage's other layers, and `useStageHitTest` finds its primitives too.
  - The SVG still takes no pointer events and is still hidden from assistive technology. Without a handler nothing changes, and the overlay still renders outside an `ImageStage`. With one it must sit inside an `ImageStage`.
  - The geometry is exported: `measurePrimitiveDistance(primitive, point, strokeScale)` (image pixels, 0 inside a dot, a filled circle or a caliper box) and `nearestMeasurePrimitive(primitives, point, radius, strokeScale)`. The latter grids the primitives by bounding box once per `primitives` array and keeps the grid while the array lives, so pass a new array when the primitives change rather than editing one in place. A pick among 10,000 primitives takes microseconds.
- c372abc: Open contours, and arc-length helpers for measuring and editing a contour along its length.
  
  - **`ContourEditor` `closed?: boolean`** (default `true`, as before). With `closed={false}` the contour is drawn as an open polyline (no segment from the last vertex back to the first), Delete keeps at least two vertices (three for a closed contour), Insert on the last vertex adds one midway to the vertex before it, and a double-click near the gap between the ends adds nothing.
  - **`nearestContourSegment(points, point, closed = true)`** takes an optional third argument; `false` leaves out the closing segment.
  - **Arc-length helpers**, pure functions over `Point[]` that work open (the default) or closed:
    - `arcLengths(points, closed)`: the cumulative length at each vertex (a closed path has one more entry, its perimeter).
    - `pointAtArc(points, s, closed)`: the point at distance `s` along the path, clamped on an open path and wrapped on a closed one.
    - `projectToArc(points, p, closed)`: the nearest place on the path to `p`, as `{ s, point, distance }`.
    - `subPath(points, s0, s1, closed)`: the stretch between two distances; on a closed path with `s0 > s1` it runs on past the first vertex.
    - `normalAtArc(points, s, closed)`: the unit normal, the tangent turned a quarter turn clockwise on screen (image `y` points down), so it points inward on a contour whose vertices run clockwise.
    - `deformContour(points, centre, delta, radius, closed)`: a soft round brush push with a cosine falloff, dividing the segments under the brush first so the path bends smoothly.
    - `eraseArc(points, s0, s1, closed)`: the pieces left after erasing a stretch; an open path leaves up to two, a closed one a single open piece.
- 0cd879b: `PolylineSet` points that show on a selected line, and rubber bands that can start outside the set.
  
  - **Point dots.** Above `vertexScale`, the points of hovered and selected lines are now drawn as dots on a dark halo in a colour of their own, so they show on a selected line (they were drawn in the selection colour on a line of the same colour, and disappeared). New `vertexColor?: string` (default: the overlay `label` role, a near-white) and `vertexSize?: number` (the dot's diameter in screen pixels, default 4; the halo adds 1 px on each side). **Behaviour change:** the dots are near-white and slightly larger than before; pass `vertexColor` and `vertexSize={3}` to come close to the old look.
  - **`marqueeSurface?: boolean`** (default `true`). With `marquee` on, the layer used to cover the whole frame with its own sweep target, which hid the layers below it. With `marqueeSurface={false}` it does not: a press on a line still starts a band, and a press on bare image reaches the layers below.
  - **`ref?: Ref<PolylineSetHandle>`**, so a band can start from a press another target received: `startSweep(event, mode?)` from any `pointerdown` handler, or `sweepDrag(press, mode?)` returned from `StageSurface`'s `onPress` (for instance on a Shift-press inside a region editor whose `interior` is `"none"`). `mode` is `"replace"` or `"add"`, and defaults to `"add"` while ⌘/Ctrl is held. Both work whether or not the layer is interactive; `startSweep` ignores any event but a `pointerdown`, and a press while the stage is in pan mode.
- c57c6ef: `RectRoiEditor` decides each press once, can leave its inside to the layers below, ignores jitter, and can be drawn from the app's own press target.
  
  - **`interior?: "move" | "none"`** (default `"move"`). With `"none"`, a press inside the region is not taken: it reaches the layers below, so a region the box encloses can be selected through it. The handles and a new band along the outline (`data-roi-band`, as wide as the pointer's tolerance on both sides of the outline) still grab the box, and the region stays a focusable button that the arrow keys move.
  - **One press decision.** A press on a handle, the band or the interior is resolved the way `ShapeEditor` resolves it: the nearest handle first, then the outline band, then the interior. A press inside a small region near a corner now resizes from that corner instead of moving the region.
  - **`drawSurface?: boolean`** (default `true`) and **`ref?: Ref<RectRoiEditorHandle>`**. With `drawSurface={false}` the editor puts no full-frame draw target in its layer; the app's `StageSurface` returns `ref.current.drawDrag(press)` from `onPress`, or calls `ref.current.startDraw(event)` from a `pointerdown` of its own, so other layers can sit between that surface and the region's handles.
  - **`fill?: string`** (default: the outline colour) and **`fillOpacity?: number`** (default 0.06; `0` draws no tint).
  - The data attributes are documented: `data-editable` and `data-drawing` on the SVG, `data-draw-surface`, `data-roi-interior`, `data-roi-band`, and `data-handle` (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`).
  
  **Behaviour changes:**
  
  - **Click slop.** `RectRoiEditor` and `ShapeEditor` start an edit only once the pointer has moved 3 screen pixels from the press, the same slop the stage uses before a press becomes a pan. A jittery click on a handle or the interior used to call `onValueChange` and `onCommit` (an edit and an undo step in the app); it now calls neither. There is no option to restore the old behaviour; a deliberate drag is unaffected beyond the first 3 pixels.
  - **An interrupted drag reverts.** A `RectRoiEditor` drag ended by `pointercancel` now puts the region back (one `onValueChange` with the starting value) and commits nothing; it used to commit the last value.
- df4dfce: Stage chrome: a stage that is not a tab stop, richer layer menus, and a full image fetched only when needed.
  
  - **`ImageStage` `focusable`.** New `focusable?: boolean`, defaulting to the value of `shortcuts`. When it is off, the viewport has no `tabIndex` and is a `role="group"` (named by `label`) instead of a `role="application"`, so an app that handles the keyboard on its own wrapper no longer gets two nested tab stops. With `shortcuts` on and `focusable` off, the keys still work while focus is on an element inside the stage. **Behaviour change:** a stage rendered with `shortcuts={false}` is no longer a tab stop and is announced as a group; pass `focusable` to keep the old tab stop and role.
  - **`frame`'s margin is documented as it behaves.** The `pad` argument of `StageHandle.frame` and of the stage context's `frame` is a fraction of the rect's own width and height added on each side, default 0.15, as `frameRect` has always applied it. The docs said CSS pixels, default 24; nothing changes at runtime.
  - **`StageLayersMenu` labels, swatches and heading.** `StageLayer.label` takes any `ReactNode` (a name and a count, say), and the new `StageLayer.swatch` is a CSS colour drawn as a small dot before the label (`aria-hidden`, so the label must still name the layer). The new `StageLayersMenuProps.heading` titles the menu and defaults to `label`; `label` stays the trigger's accessible name and tooltip.
  - **`ImageLayer` fetches the full image on demand.** With a `preview`, `src` is now optional: the new `onFullNeeded` callback fires once per `preview.src` when the stage would magnify the preview (the rule that already decides when the full image is shown), and the full image is drawn as soon as `src` arrives. While the full image is wanted but not yet loaded, the preview carries `data-wants-full`. `ImageLayerProps` is now a union (the full image's `src`, a `preview`, or both) over the new `ImageLayerBaseProps`; apps that pass `src` see no change.

### Patch Changes

- 1914f7f: READMEs, Storybook descriptions and editor documentation no longer refer to the project's internal tickets, decision records or private apps; the text now stands on its own.
- Updated dependencies [c91bc50]
- Updated dependencies [d224648]
- Updated dependencies [1914f7f]
  - @vitavision/ui@0.12.0

## 0.12.0

### Minor Changes

- 1c1b1d8: `AreaSet` and `PointSet` take CSS colours, and `AreaSet` gains fill and paint-order controls.
  
  - `AreaSetItem.stroke` / `fill` and `AreaSetProps.stroke`: CSS colours (used as given) in place of the overlay role's. Batching stays by appearance: N distinct colours are N paths.
  - `AreaSetProps.fillOpacity` (default 0.12), `fillRule` (`"evenodd"` gives each item its own fill path, so a self-intersecting ring keeps its open centre; outlines stay batched), `paintOrder` (`"items"`: batches are consecutive runs in item order, so a later region covers an earlier one) and `selectionFill` (`"item"`: a selected region keeps its own fill and only its outline is restyled). Defaults render as before.
  - `PointSetItem.color`: a CSS colour in place of the role's; points of one colour share a batch. Selection still paints in `selectionStroke`.
- d9a4b3c: `ClampOptions.panBounds: "center"` (opt-in, via `ImageStage`'s `clamp` prop): any image point may be brought to the viewport's centre and no further, on both axes and at every scale. With the default `"cover"` bounds an axis the image does not fill is re-centred, so a zoom about the pointer drifts while the zoomed image is still narrower than the viewport, and an edge or corner cannot be brought to the middle of the screen; `"center"` keeps the pointer's pixel under it and lets an editor work on an edge in the centre.
- ca3dd68: `ContourEditor` takes `bounds` (image-coordinate clamp area; default unchanged). `DraftShape` takes `stroke` (CSS colour override), a `closing` cue on polygons, and new `stroke` (brush trail) and `brush` (footprint cursor) kinds. `MaskEditor` draws its brush ring with the `brush` footprint and shows it under a hovering pointer.
- 610d4d8: Stage plumbing for drawing tools and linked panes.
  
  - **`StageSurface` can cover the viewport.** New `extent?: "image" | "viewport"` (default `"image"`, today's behaviour). With `"viewport"` a press in the margin around the image reaches `onPress` instead of panning, so a drawing tool can place a vertex on the image border; the target follows pan, zoom and resize. Every point the surface reports (`press.point`, a drag's `onMove`/`onEnd`, `onHover`, `onDoubleClick`) is clamped to the image's extent, `[-0.5, w - 0.5] x [-0.5, h - 0.5]`; `press.client` stays raw. The clamp is exported as `clampToImage(point, image)`, next to `insideImage`.
  - **`onView` says why.** `onView(view, change)` gets a `StageViewChange` as its second argument: `cause` is `"gesture"` (wheel, drag pan, pinch, double-click), `"key"` (keyboard shortcuts and pan keys), `"command"` (handle and context calls: `fit`, `zoomTo`, `frame`, `setView`, the toolbar's buttons) or `"measure"` (the opening view and resize re-anchoring), and `box` is the measured viewport at that moment. Existing one-argument callbacks keep working. Two panes sharing one view can ignore the other's `"measure"`.
  - **Fix: a `null` view after measurement is re-opened.** When a consumer set `view` back to `null` after the stage had measured, it rendered the opening view but never reported it, and the wheel handler returned early, so the pane was stuck until something else set a view. It now reports the opening view (cause `"measure"`) and the wheel, keys and `zoomTo` work from the opening view throughout.
  - **Fix, behaviour change: `RectRoiEditor`'s default `bounds` is the image's extent.** It was `{ x: 0, y: 0, width, height }` while the editor draws in the centre-convention coordinates of `imageViewBox`, so a full-image region sat half a pixel right and down of the image, and a region could not reach the top and left edges. The default is now `{ x: -0.5, y: -0.5, width, height }`. A region clamped to the default bounds now starts at `-0.5`, not `0`; pass `bounds` to keep the old numbers.
  - **`onBackgroundClick(event, point)`** gets the click's image point (centre convention, unclamped) as a second argument, so a consumer needs no `useStage` bridge to convert it.

## 0.11.0

### Minor Changes

- cc3132a: stage2d gains a pickable ellipse layer, a second marker angle, fit options and a compositor hint; overlays follows.
  
  - `EllipseSet` (and `ellipsePath`) move from `@vitavision/overlays` into stage2d, next to `AreaSet`. It now registers with the stage's hit-test: `hoveredId`, `onHoverChange`, `onItemPress`, `layerId`, `priority`, and `pickable={false}` to stay out of it. The pure index is exported too: `buildEllipseIndex`, `nearestEllipse` (outline within the pointer's radius, else the smallest containing ellipse; true Euclidean distance), `ellipsesInRect`, `pointInEllipse`, `ellipseBounds`. `@vitavision/overlays` re-exports `EllipseSet`, `EllipseSetItem`, `EllipseSetProps` and `ellipsePath`, and `TargetOverlay` draws its rings and edge bits with `pickable={false}`, so its picking is unchanged. Its peer range on stage2d is now `>=0.11.0`.
  - `MarkerShape.path(x, y, unit, angle, angle2)` receives `PointSetItem.angle2` (`undefined` when the item has none); existing shapes ignore it. overlays' `directed` marker reads `angle` and `angle2` directly, so `packAxes` and `unpackAxes` are removed (breaking for overlays: put the two directions in `angle` and `angle2`).
  - `fitScale`, `fitView`, `isFit`, `initialView` and `preserveCenter` take `FitOptions` (`padding` in CSS pixels per side, `upscale: false` to cap fit at 1:1); the defaults give today's numbers. `ImageStage` has a `fit` prop applied to every fit path: `initialView`, the handle's and the context's `fit()`, the `0` key, the double-click toggle, the toolbar's Fit button and `data-fit`.
  - `ImageStage` sets `will-change: transform` (and `data-moving`) on its transformed box while the view changes and for 150 ms after, so a pan stays on the compositor; left on permanently, Chromium keeps the layer at the raster scale it had when the hint was applied and a zoomed-in image goes blurry.
- a7fae89: Touch input, so an app can use `StageSurface`, `PolylineSet` and `ShapeEditor` without writing its own surface.
  
  - **`StageSurface` tells a touch from a mouse.** `StagePress` gains `touch`, `client` (client coordinates, for anchoring a tooltip) and `radius` (the hit-test tolerance in screen pixels: 12 for a touch, 6 otherwise). `StageDrag` gains `claimsTouch`. A touch whose drag does not set it is now *watched*, not claimed: the stage still pans (one-finger mode) and pinches, `onMove` fires once the finger leaves the tap slop, `onEnd(point, event, moved)` fires on release (`moved` is `false` for a tap), and `onCancel` fires on `pointercancel` or when a second finger lands. `onHover` is no longer called for a touch. New `onDoubleClick` prop: when given, the surface handles the double click and the stage's double-click-to-fit does not run. **Behaviour change:** an unclaimed touch used to be claimed like a mouse press and no longer is, so act in `onEnd` when `moved` is `false`; return `claimsTouch: true` to keep the old behaviour.
  - **`PolylineSet` can step aside.** New `interactive` prop, on by default only when `onItemPress`, `onSelect`, `onHover`, `onHoverChange` or `marquee` is given. When off, the layer renders no press target, so a draw tool's `StageSurface` below receives the press, while `useStageHitTest` still finds the lines. On an interactive layer a touch is no longer claimed (the stage can pan and pinch) and a line is selected on a tap.
  - **`ShapeEditor` decides a press once.** The nearest handle wins over the interior, so a small shape's corner is no longer a move. The band along the outline (6 px for a mouse, 12 px for a touch) moves the shape, so a rotated box or an ellipse can be grabbed at its edge. A press beyond the band is declined and reaches the stage. A second finger landing during a touch edit cancels it: the shape reverts and nothing is committed.

## 0.10.0

### Minor Changes

- 2f31859: `AreaSet`, `GridLayer`, `HeatmapLayer`, a rotated `ShapeEditor`, draft previews and shape moving. All additive.
  
  - **`AreaSet`**: closed regions (marker quads, polygons, annotations) as batched outline-plus-12 %-fill paths per state and role, with hover, selected and dimmed states, labels where regions are 24 screen px apart, an optional `firstVertexTick` on corner 0, and `onHoverChange` / `onItemPress` at `STAGE_HIT_PRIORITY.area`. A press near an outline picks that region, else the smallest region that contains it. Exported with the pure `buildAreaIndex`, `nearestArea`, `areasInRect`, `pointInPolygon`, `areaPath` and `areaCentre`.
  - **`GridLayer`**: a detected lattice. Nodes `{ id, i, j, x, y }` are a `PointSet` (`plus` by default, picked at point priority); the edges between lattice neighbours are two batched paths, restyled per axis through `edges`; `indexLabels` shows `i,j`. Exported with the pure `latticeEdges`.
  - **`HeatmapLayer`**: a `ValuePlane` and a `colormap` (`(t) => [r, g, b]`, optional `range` and `channel`), or an `rgba` buffer with its size, as one image placed over the image (or at `rect`, in image coordinates), with `opacity`, `visible` and pixelated rendering from 4 CSS px per cell. Rasterised in an effect into an object URL that is revoked when replaced and on unmount; server-rendering safe. Exported with the pure `rasterizePlane` and `planeRange`.
  - **`ShapeEditor`**: a rotated rectangle or ellipse `{ cx, cy, width, height, rotation }` with eight handles that resize in the shape's own frame (the opposite side stays put), a rotation handle (Shift rounds to 15°), move by the interior, `minSize`, and keyboard nudges (arrows, Alt + arrows, `[` / `]`). **`rotation` is in radians, clockwise on screen.** Exported with the pure `resizeShape`, `rotateShape`, `moveShape`, `shapeHandlePoint`, `rotationHandlePoint`, `shapeHandleCursor`, `toShapeFrame`, `fromShapeFrame`, `shapeFromCorner`, `shapeCorner`, `sameShape` and `normalizeAngle`.
  - **`DraftShape`** and **`MarqueeRect`**: the dashed preview of a point, line, polyline, polygon, rectangle or ellipse being drawn, and the rubber band of a multi-select.
  - **`useShapeDrag`** and `translatePoints`: a press on an item becomes image-space displacements with click slop, for select → drag → commit of manual shapes.

## 0.9.0

### Minor Changes

- 97fbe12: `PointSet`, one hit-test across layers, and right-button and touch input on `ImageStage`.
  
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
  
  - **Role tokens.** `styles.css` now defines the overlay roles:
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
- 9aeeb5d: `@vitavision/stage2d` gets its quality pass: documented, tested, accessible (API only; the
  rendering engine is unchanged).
  
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
  - Every export has TSDoc.

### Patch Changes

- Updated dependencies [038fcec]
- Updated dependencies [7c6c4e4]
- Updated dependencies [51bdec5]
- Updated dependencies [b60a923]
  - @vitavision/ui@0.6.0
