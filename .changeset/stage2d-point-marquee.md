---
"@vitavision/stage2d": minor
---

New `PointMarquee`: a modifier-drag rectangle that reports the points inside it.

```tsx
<ImageStage …>
  <PointSet items={points} selectedIds={selected} />
  <PointMarquee items={points} onSelect={(ids, mode) => setSelected((s) => new Set(mode === "add" ? [...s, ...ids] : ids))} />
</ImageStage>
```

- Hold **Shift** (`modifier="shift"`, or `"alt"`, or `"meta"` for ⌘/Ctrl) and drag: the rectangle is drawn, and on release `onSelect(ids, mode)` receives the ids of the points inside, in item order. `mode` is `"add"` when ⌘/Ctrl is held as well, else `"replace"`; an empty rectangle reports an empty list.
- **Opt-in and inert without the modifier.** The layer's full-frame target exists only while the modifier is held, so panning, wheel zoom and the layers beneath behave as before. A touch has no modifier and pans.
- **Escape** abandons a marquee in flight (`onCancel`); a release without movement reports nothing. `onBandChange` follows the rectangle.
- With `surface={false}` an app that already has a `StageSurface` returns `ref.current.sweepDrag(press)` from its `onPress`.
- New exports: `PointMarquee`, `PointMarqueeProps`, `PointMarqueeHandle`, `PointMarqueeMode`, `PointMarqueeModifier`.
