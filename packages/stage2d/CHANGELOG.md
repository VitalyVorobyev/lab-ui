# @vitavision/stage2d

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
