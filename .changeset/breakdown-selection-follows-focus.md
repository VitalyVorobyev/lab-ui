---
"@vitavision/ui": minor
---

New `Breakdown`: how many things of a set are in each state, as one thin stacked bar, such as a file list showing how far each file's translation has got.

```tsx
<Breakdown
  segments={[
    { value: 412, tone: "normal", label: "done" },
    { value: 20, tone: "warn", label: "to check" },
    { value: 3, tone: "defect", label: "problems" },
  ]}
  total={566}
  remainderLabel="to do"
/>
```

- **Segments** are drawn left to right in the order given, each as wide as its share of `total`. `total` defaults to the sum of the segments; the rest of it is drawn as empty track. Segments of 0 are left out, and a non-zero count is never narrower than 2 px, so a single problem still shows.
- **Tones** are `normal`, `warn` and `defect`, the verdict colours, plus `neutral` for a category that is no verdict ("skipped"). Use it only for things the app has judged, never for a continuous quantity or for series side by side: that is a `Progress` or a chart.
- **Accessible:** a `role="img"` named with every non-zero count, "412 done, 20 to check, 3 problems, 131 to do of 566", so colour is never the only cue. `aria-label` or `aria-labelledby` replaces the name. Neighbouring segments are also set apart by a 1 px gap.
- `breakdownText(segments, { total, remainderLabel })` gives the same text, for a tooltip or a label printed beside the bar.
- The track matches `Progress`, thinner in the compact density. `data-state` is `empty`, `partial` or `complete`, and each segment carries its `data-tone`. Width changes ease, and hold still with reduced motion.

`Table` can make the selection follow the keyboard: with `selectionFollowsFocus`, every arrow key, Page Up / Page Down, Home or End that moves to another row also calls `onRowClick` for that row.

```tsx
<Table
  columns={columns}
  rows={strings}
  rowKey={(s) => s.id}
  isRowActive={(s) => s.id === selectedId}
  onRowClick={(s) => setSelectedId(s.id)}
  selectionFollowsFocus
/>
```

- Use it where the selected row shows its detail beside the table, so moving through the rows updates the detail as you go. Leave it off when activating a row is costly or leaves the page.
- The event passed to `onRowClick` is the key press, so modifiers can be read as for a click. The index is still the row's index in `rows`, whatever the sort, and windowed tables select rows outside the window as the keyboard reaches them.
- Clicks, Enter and Space behave as before. Off by default.
