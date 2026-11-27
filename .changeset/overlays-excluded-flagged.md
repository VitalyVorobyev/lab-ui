---
"@vitavision/overlays": minor
---

`TargetOverlay` draws two new per-feature states: `excluded` and `flagged`.

```tsx
<TargetOverlay
  detection={{
    kind: "charuco",
    corners: [
      { id: 1, x: 40, y: 52, excluded: true }, // switched off: dimmed, with a small cross
      { id: 2, x: 90, y: 51, flagged: true }, // disagrees with the master pattern: a thin ring
    ],
  }}
/>
```

- **`excluded`** on `TargetCorner`, `TargetCircle` and `TargetRing`: the feature is drawn dimmed with a small cross through it. It means "left out of use", so it is not drawn like a rejected point, and it uses the overlay `label` role on a halo, which reads on light and dark images in both themes. The feature still takes hover and presses.
- **`flagged`** on the same types: a thin ring (12 px, clear of the selection ring) around the feature, for one that disagrees with what it should be, such as a decoded id that differs from the master pattern.
- Both compose with hover, selection, `dimmed` and each other. Each is drawn by its own non-pickable layer (`Excluded features`, `Flagged features`; `layerIdPrefix` gives `<prefix>-excluded` and `<prefix>-flagged`).
- New exports: `excludedPoints` and `flaggedPoints` (the layer items), and the `excluded` and `flagged` glyphs in `TARGET_MARKERS`.
