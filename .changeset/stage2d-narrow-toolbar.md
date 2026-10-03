---
"@vitavision/stage2d": patch
---

On a narrow canvas the toolbar collapses and the readout wraps. Below 30rem of canvas width, measured with a container query on the stage itself, `StageToolbar` hides zoom out, zoom in and 100%; the percentage menu and the `+` / `-` / `1` keys still reach them. The readout moves onto its own line above the toolbar instead of being clipped to nothing.
