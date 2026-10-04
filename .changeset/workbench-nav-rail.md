---
"@vitavision/workbench": minor
---

New `NavRail` and `NavRailItem`: the workspaces of an app as a column of icons for `AppShell`'s `rail` slot, one of them current.

```tsx
<AppShell
  rail={
    <NavRail value={workspace} onValueChange={setWorkspace} labels="tooltip">
      <NavRailItem value="library" label="Library" icon={<Library />} />
      <NavRailItem value="review" label="Review" icon={<ScanSearch />} badge={pending.length} />
      <NavRailItem value="settings" label="Settings" icon={<Settings />} asChild>
        <Link to="/settings" />
      </NavRailItem>
    </NavRail>
  }
  main={…}
/>
```

- **Current item:** controlled with `value` / `onValueChange`, or kept by the rail from `defaultValue`. The current item has `aria-current="page"` and `data-state="active"` (the others `"inactive"`). Choosing the current item again does not call `onValueChange`.
- **Labels:** `labels="visible"` (the default) sets each label under its icon; `labels="tooltip"` draws icon-only buttons, names each by its label and shows the label in a tooltip (a `TooltipProvider` must be above it, as for every tooltip).
- **Items:** `value`, `label`, `icon` (decorative), `badge` (a number is drawn as a count, over 99 as "99+"; anything else as given; it describes the item rather than renaming it), `disabled` and `className`.
- **Links:** with `asChild`, the item renders onto its one child, such as a router's `<Link to="…" />` given without content. The icon and label become the link's content, the link's `className` is kept beside the item's, and its own `onClick` runs first; calling `event.preventDefault()` there keeps the item from being chosen. A disabled link gets `aria-disabled="true"` and its clicks are cancelled.
- **Accessibility:** the rail is a list with no landmark of its own, because `AppShell`'s `rail` slot is already a named `<nav>`. Outside `AppShell`, wrap it in a `<nav aria-label="…">`. Every item is its own Tab stop.
