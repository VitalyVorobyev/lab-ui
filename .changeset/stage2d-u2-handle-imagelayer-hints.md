---
"@vitavision/stage2d": minor
---

Add a stage handle, `initialView`, `ImageLayer`, `StageButton` hints, `StageLayersMenu`, and fix zoom stepping at the ends of the range.

- **`ImageStage` takes a `ref`** (`StageHandle`: `frame`, `fit`, `zoomTo`) for code outside
  the stage, such as an inspector's "frame this contour". It also takes
  `initialView: "auto" | "fit"`. `"fit"` opens a `null` view at fit even when the image would
  fit at 1:1.
- **`ImageLayer` draws the photograph at its natural size.**
  - With a `preview` tier it shows the preview until the stage would magnify it, then loads
    `src`. It keeps `src` when zooming back out, and the preview stays underneath while it
    loads.
  - It is pixelated past `pixelatedAbove` (default 4).
- **`StageButton` takes `hint` and `shortcut`.** With either, the tooltip is the ui `Tooltip`
  showing the label, the hint and the key as a `Kbd`. The shortcut is also set as
  `aria-keyshortcuts`. Without them, the native `title` is unchanged.
- **`StageLayersMenu`:** a layers button opening a menu of layer toggles. It shows as pressed
  while a layer is hidden.
- **`steppedScale` steps onto the floor or the ceiling** when they lie between ladder steps.
  Before, "zoom out" stayed enabled below 0.125 (and "zoom in" above 32) and did nothing.
