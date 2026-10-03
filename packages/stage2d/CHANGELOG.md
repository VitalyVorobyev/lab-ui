# @vitavision/stage2d

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
