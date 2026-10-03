---
"@vitavision/stage2d": minor
---

Add `RectRoiEditor`, an editable region of interest inside an `ImageStage`.

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
