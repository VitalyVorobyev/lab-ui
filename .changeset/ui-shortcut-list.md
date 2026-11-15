---
"@vitavision/ui": patch
---

New `ShortcutList`: the keyboard shortcuts of a screen as titled groups, for a `?` help dialog or a panel.

```tsx
<Dialog open={open} onOpenChange={setOpen} title="Keyboard shortcuts">
  <ShortcutList
    groups={[
      { title: "Navigation", shortcuts: [{ keys: ["J", "↓"], description: "Next image" }] },
      { title: "Review", shortcuts: [{ keys: ["W"], description: "Flag a wrong id" }] },
    ]}
  />
</Dialog>
```

- Each row shows the keys as `Kbd` caps beside what they do. Several `keys` are alternatives, read "J or ↓"; write a chord as one entry (`⌘K`).
- Groups flow into two columns where there is room; empty groups are left out.
- It only lists: binding the keys stays the app's.
- Each group is a `<section>` labelled by its heading, and its rows a description list.
