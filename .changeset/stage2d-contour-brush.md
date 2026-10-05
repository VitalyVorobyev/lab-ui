---
"@vitavision/stage2d": minor
---

`ContourEditor` gains a brush and an eraser.

- **`mode?: "vertex" | "brush" | "erase"`** (default `"vertex"`, as before) and **`brushRadius?: number`** (image pixels, default 20). In `"brush"` and `"erase"` mode an editable contour covers the image with its own press target (`data-tool-surface`), shows the brush's footprint under a hovering mouse or pen, and hides its vertex handles. A press whose brush does not reach the contour is declined, so the stage pans. Both gestures start only once the pointer has moved 3 screen pixels.
- **Brush.** A drag pushes the contour with a soft round brush centred where the press landed (`deformContour`, always from the contour as it was at the press), held inside `bounds`. `onChange` follows the drag and `onCommit` fires once on release.
- **Erase.** A drag along the contour previews the stretch it would remove, dashed in the defect colour (`data-erase-preview`). On release, the new **`onErase?: (pieces, range) => void`** receives the pieces that are left (open polylines, see `eraseArc`) and the erased stretch as arc lengths `{ start, end }`. The editor does not change `points` itself; the app replaces the contour with the pieces. On a closed contour the stretch runs the shorter way round, and what is left is one open piece: pass it back as `points` with `closed={false}` to keep editing it.
- The SVG carries `data-mode` while editable.
