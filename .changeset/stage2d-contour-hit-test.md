---
"@vitavision/stage2d": minor
---

`ContourEditor`'s outline no longer intercepts presses, and layers can take double-clicks through the stage's hit-test.

- **Double-clicks through the hit-test.** `useStageHitLayer` takes `onDoubleClick?: (id, point) => boolean | void`. `ImageStage` offers a double-click to the best item under it among layers that take one (return `false` to decline, and the next is asked) before its own double-click to fit; when a layer takes it, the view stays where it is. Not offered while the hand tool is on or space is held.
- **`ContourEditor` answers the hit-test.** While `editable`, it registers its outline with the stage's hit-test: `pick` finds the nearest segment (the id is the segment's index), and a double-click near the outline inserts a vertex there, as before. New `layerId?: string` and `priority?: number` (default `STAGE_HIT_PRIORITY.line`) place it among other layers.
- **Click slop on vertices.** A vertex drag starts only once the pointer has moved 3 screen pixels, so a jittery click on a vertex no longer changes the contour or calls `onCommit`.

**Behaviour changes:**

- The transparent band along an editable contour's outline is gone. A press on the outline now reaches the layers below it (a region's `onItemPress`, a `StageSurface`), or pans the stage when nothing takes it; it used to be swallowed by the editor. The vertices still take their own presses.
- A double-click within the pointer's tolerance of an editable contour's outline inserts a vertex and does not toggle fit; a double-click elsewhere toggles fit as before. With `doubleClickFit={false}` the insertion works the same. The double-click event now bubbles on past the stage, as every other double-click on it does.
- A press on a vertex that moves less than 3 screen pixels is a click: no `onChange`, no `onCommit`.
