---
"@vitavision/workbench": patch
---

`SequenceMatrix` no longer throws when its rows or columns shrink between renders. The visible window was measured after the render that changed the data, so that render still named rows and columns that were gone; it is now held to the rows and columns in hand. An app no longer needs to re-key the matrix when a filter or a new dataset leaves it with fewer rows.
