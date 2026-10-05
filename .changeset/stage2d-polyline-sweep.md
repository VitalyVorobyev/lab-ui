---
"@vitavision/stage2d": minor
---

`PolylineSet` points that show on a selected line, and rubber bands that can start outside the set.

- **Point dots.** Above `vertexScale`, the points of hovered and selected lines are now drawn as dots on a dark halo in a colour of their own, so they show on a selected line (they were drawn in the selection colour on a line of the same colour, and disappeared). New `vertexColor?: string` (default: the overlay `label` role, a near-white) and `vertexSize?: number` (the dot's diameter in screen pixels, default 4; the halo adds 1 px on each side). **Behaviour change:** the dots are near-white and slightly larger than before; pass `vertexColor` and `vertexSize={3}` to come close to the old look.
- **`marqueeSurface?: boolean`** (default `true`). With `marquee` on, the layer used to cover the whole frame with its own sweep target, which hid the layers below it. With `marqueeSurface={false}` it does not: a press on a line still starts a band, and a press on bare image reaches the layers below.
- **`ref?: Ref<PolylineSetHandle>`**, so a band can start from a press another target received: `startSweep(event, mode?)` from any `pointerdown` handler, or `sweepDrag(press, mode?)` returned from `StageSurface`'s `onPress` (for instance on a Shift-press inside a region editor whose `interior` is `"none"`). `mode` is `"replace"` or `"add"`, and defaults to `"add"` while ⌘/Ctrl is held. Both work whether or not the layer is interactive; `startSweep` ignores any event but a `pointerdown`, and a press while the stage is in pan mode.
