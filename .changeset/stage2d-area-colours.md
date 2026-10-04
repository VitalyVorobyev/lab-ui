---
"@vitavision/stage2d": minor
---

`AreaSet` and `PointSet` take CSS colours, and `AreaSet` gains fill and paint-order controls.

- `AreaSetItem.stroke` / `fill` and `AreaSetProps.stroke`: CSS colours (used as given) in place of the overlay role's. Batching stays by appearance: N distinct colours are N paths.
- `AreaSetProps.fillOpacity` (default 0.12), `fillRule` (`"evenodd"` gives each item its own fill path, so a self-intersecting ring keeps its open centre; outlines stay batched), `paintOrder` (`"items"`: batches are consecutive runs in item order, so a later region covers an earlier one) and `selectionFill` (`"item"`: a selected region keeps its own fill and only its outline is restyled). Defaults render as before.
- `PointSetItem.color`: a CSS colour in place of the role's; points of one colour share a batch. Selection still paints in `selectionStroke`.
