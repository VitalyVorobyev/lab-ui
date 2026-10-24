---
"@vitavision/stage2d": minor
---

`EllipseSet` items take a `color`, and `PointSet` and `AreaSet` take `pickable`.

```tsx
<EllipseSet items={sigmas.map((s, i) => ({ id: i, ...ellipse[i], color: ramp(s) }))} />
<PointSet items={backdrop} pickable={false} />
```

- **`EllipseSetItem.color`** is a CSS colour (`#hex`, `var(--x)`, `color-mix(…)`) used as given for the outline and its hover state, so one layer can encode a scalar per ellipse. It overrides the role, as `PointSetItem.color` does; selection still paints in `selectionStroke`. Ellipses of one colour share a path, so quantise a continuous scale to a few dozen steps.
- **`PointSetProps.pickable` and `AreaSetProps.pickable`** (default `true`), as `EllipseSet` already had. With `pickable={false}` the layer is left out of the stage's hit-test: it does not hover, claim presses or answer `useStageHitTest`, so a decorative layer no longer takes hover from the layer under it. `onHoverChange` is not called while it is off.
