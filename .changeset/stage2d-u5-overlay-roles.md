---
"@vitavision/stage2d": minor
---

Add overlay role tokens and `useScreenPx`, and extend `MeasureOverlay` additively with a `polyline` primitive, `role`, and per-primitive `id` and `state`.

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
