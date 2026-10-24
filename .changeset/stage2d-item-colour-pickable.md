---
"@vitavision/stage2d": minor
---

`EllipseSet` items take a `color`, and `PointSet` and `AreaSet` take `pickable`.

```tsx
<EllipseSet items={sigmas.map((s, i) => ({ id: i, ...ellipse[i], color: ramp(s) }))} />
<PointSet items={backdrop} pickable={false} />
```

- **`EllipseSetItem.color`** is a CSS colour (`#hex`, `var(--x)`, `color-mix(…)`) used as given for the outline and its hover state, so one layer can encode a scalar per ellipse. It overrides the role, as `PointSetItem.color` does; selection still paints in `selectionStroke`. Ellipses of one colour share a path, so quantise a continuous scale to a few dozen steps.
- **`PointSetProps.pickable` and `AreaSetProps.pickable`** (default `true`), as `EllipseSet` already had. With `pickable={false}` the layer is left out of the stage's hit-test: it does not hover, claim presses or answer `useStageHitTest`, so a decorative layer no longer takes hover from the layer under it. `onHoverChange` is not called while it is off, and turning it off ends a hover with `null`, so a list that follows the hover clears too.
- **`useStageHitLayer` takes `enabled`** (default `true`), so a custom layer can leave the hit-test and come back under the same layer id.
- **A layer that leaves the hit-test while it holds the hover is told the hover ended**: its `onHover(null)` fires when it is disabled or unmounts, where it used to keep drawing the last hovered item.
