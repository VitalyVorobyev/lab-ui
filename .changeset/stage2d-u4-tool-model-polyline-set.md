---
"@vitavision/stage2d": minor
---

Add `PolylineSet` (selectable polylines) and the stage tool model (`StageSurface`, `useStageDrag`).

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
