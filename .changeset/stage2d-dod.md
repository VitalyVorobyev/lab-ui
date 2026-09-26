---
"@vitavision/stage2d": minor
---

`@vitavision/stage2d` meets the PLAN §4 Definition of Done (API only; the rendering engine is
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
