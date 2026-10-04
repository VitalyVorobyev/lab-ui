---
"@vitavision/workbench": minor
---

`SequenceNavigator` shows a status per item, and its strip no longer stretches.

- **`SequenceItem.status?: SequenceItemStatus`** (`{ tone, label }`, where `tone` is `@vitavision/ui`'s `Tone`): a status dot in the thumbnail's top-right corner, drawn over the default thumbnail, the label fallback and a `renderThumbnail` rendering alike. The item carries `data-status` (the tone), and its accessible name and tooltip become `"label, status"`, e.g. `"frame_0003.bmp, not found"`. Items without a `status` render as before. A `renderThumbnail` that drew its own status badge can drop it and pass `status` instead.
- **Fix, behaviour change: the thumbnail strip is as wide as its thumbnails.** It used to take all of the row's free width, so with a short sequence Next, the position and the key hints sat at the far end of the row, away from the thumbnails. They now follow the last thumbnail. A sequence too long for the row still scrolls as before. To keep the old placement (the strip filling the row, Next at its end), pass `className="[&>ol]:flex-1"`.
