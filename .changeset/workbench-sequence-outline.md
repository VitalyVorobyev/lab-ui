---
"@vitavision/workbench": patch
---

`SequenceNavigator`: the current item's outline and the keyboard focus outline are no longer cut off at the ends of the thumbnail strip.

The strip scrolls and clips at its edge, and it had no room at its left and right ends, so the outline of the first and last thumbnails lost its outer side. The strip now has 4 px of padding all round, and an item scrolled into view keeps the same 4 px from the strip's edge. The thumbnails move 4 px right and the row grows 8 px wider; nothing else changes.
