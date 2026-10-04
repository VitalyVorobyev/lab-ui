---
"@vitavision/workbench": minor
---

New `StatusBar`: the status line for `AppShell`'s `bottom` slot.

```tsx
<AppShell
  main={…}
  bottom={
    <StatusBar
      start={[{ label: "frame", value: frame.name }, { label: "model", value: model?.name }]}
      end={[{ label: "last run", value: lastRun && `${lastRun} ms` }]}
    >
      {running && <ProgressBar fraction={done} aria-label="Detecting" className="w-40" />}
    </StatusBar>
  }
/>
```

- One 24 px row: a `ReadoutStrip` of the `start` items at the left end, one of the `end` items at the right end, and `children` between them. Items are `@vitavision/ui`'s `ReadoutItem`s (`{ label?, value, href?, link? }`); an item whose `value` is `null` or `undefined` is skipped, as in `ReadoutStrip`. The row does not wrap.
- It is a `role="group"` named by `aria-label` (default "Status"). With `live`, it is a `role="status"` instead, a polite live region (and carries `data-live`), so screen readers announce what changes in it; keep `live` for changes worth hearing, such as an operation finishing.
