---
"@vitavision/stage2d": minor
---

`ClampOptions.panBounds: "center"` (opt-in, via `ImageStage`'s `clamp` prop): any image point may be brought to the viewport's centre and no further, on both axes and at every scale. With the default `"cover"` bounds an axis the image does not fill is re-centred, so a zoom about the pointer drifts while the zoomed image is still narrower than the viewport, and an edge or corner cannot be brought to the middle of the screen; `"center"` keeps the pointer's pixel under it and lets an editor work on an edge in the centre.
