---
"@vitavision/stage2d": minor
---

`RectRoiEditor` decides each press once, can leave its inside to the layers below, ignores jitter, and can be drawn from the app's own press target.

- **`interior?: "move" | "none"`** (default `"move"`). With `"none"`, a press inside the region is not taken: it reaches the layers below, so a region the box encloses can be selected through it. The handles and a new band along the outline (`data-roi-band`, as wide as the pointer's tolerance on both sides of the outline) still grab the box, and the region stays a focusable button that the arrow keys move.
- **One press decision.** A press on a handle, the band or the interior is resolved the way `ShapeEditor` resolves it: the nearest handle first, then the outline band, then the interior. A press inside a small region near a corner now resizes from that corner instead of moving the region.
- **`drawSurface?: boolean`** (default `true`) and **`ref?: Ref<RectRoiEditorHandle>`**. With `drawSurface={false}` the editor puts no full-frame draw target in its layer; the app's `StageSurface` returns `ref.current.drawDrag(press)` from `onPress`, or calls `ref.current.startDraw(event)` from a `pointerdown` of its own, so other layers can sit between that surface and the region's handles.
- **`fill?: string`** (default: the outline colour) and **`fillOpacity?: number`** (default 0.06; `0` draws no tint).
- The data attributes are documented: `data-editable` and `data-drawing` on the SVG, `data-draw-surface`, `data-roi-interior`, `data-roi-band`, and `data-handle` (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`).

**Behaviour changes:**

- **Click slop.** `RectRoiEditor` and `ShapeEditor` start an edit only once the pointer has moved 3 screen pixels from the press, the same slop the stage uses before a press becomes a pan. A jittery click on a handle or the interior used to call `onValueChange` and `onCommit` (an edit and an undo step in the app); it now calls neither. There is no option to restore the old behaviour; a deliberate drag is unaffected beyond the first 3 pixels.
- **An interrupted drag reverts.** A `RectRoiEditor` drag ended by `pointercancel` now puts the region back (one `onValueChange` with the starting value) and commits nothing; it used to commit the last value.
