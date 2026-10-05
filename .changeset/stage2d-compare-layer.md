---
"@vitavision/stage2d": minor
---

New `CompareLayer`: two registered images of the same size compared in place inside an `ImageStage`, as a checkerboard, a wipe or their difference.

- `<CompareLayer a={referenceUrl} b={foundUrl} mode="checker" | "wipe" | "difference" alt="…" />`. Both images are laid out at the stage's pixel size, like `ImageLayer`, so they stay registered with each other and with every overlay.
- **`checker`**: alternate squares of A and B, `cell` image pixels across (default 32), A at the top-left.
- **`wipe`**: A before a divider and B after it. `orientation` is `"vertical"` (A on the left, the default) or `"horizontal"` (A above). The divider's place is `split` / `defaultSplit` / `onSplitChange`, the fraction of the image before it (default 0.5, clamped to 0..1). Drag the divider or its knob, which stays in the middle of the visible part of the divider; the drag is claimed, so the stage does not pan.
- **`difference`**: B blended over A with `mix-blend-mode: difference` in an isolated group, brightened by `gain` (default 1). Identical pixels are black. It is the per-channel difference of the sRGB-encoded values the browser composites, not of linear light: use it to see where the images differ, not to measure by how much.
- Everything is CSS on the second image (a mask, a clip, a blend), never a canvas. Past `pixelatedAbove` (default 4×) both images are drawn as blocks.
- **Accessibility**: the two images are one picture, `role="img"` named by `alt`. In wipe mode the knob is a slider from 0 to 100, the share of A, read as e.g. "40 % A". Arrow keys move it 1 % (10 % with Shift), Page Up and Page Down 10 %, and Home and End go to either edge; these keys do not pan the stage. `labels` (default `["A", "B"]`) names the two images for the slider and for the tags beside the knob.
- `CompareMode` and `CompareOrientation` are exported with it.
