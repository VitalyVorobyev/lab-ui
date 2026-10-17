---
"@vitavision/ui": minor
---

`Table` can render only the rows in view (`windowed`), so a table of thousands of rows scrolls smoothly, and rows can be navigated with the keyboard.

```tsx
<Table columns={columns} rows={strings} rowKey={(s) => s.id} windowed={{ rowHeight: 36, height: 480 }} />
```

- **`windowed={{ rowHeight, height?, overscan? }}`:** the table scrolls itself under a sticky header and keeps only the visible rows (plus `overscan`, 8 by default) in the DOM. Without `height` it fills its container, which needs a height of its own. Every row is drawn `rowHeight` tall (at least 36 px comfortable, 22 px compact). Cells keep to one line and longer content ends in an ellipsis. Columns use a fixed layout, so give a column a `width` where its content needs one.
- Sorting, `onRowClick`, `isRowActive` and `onRowHover` work over all the rows. The table carries `aria-rowcount` and each rendered row its `aria-rowindex`, so a screen reader still hears a row's place among all of them. A windowed table with nothing focusable in it is a tab stop itself, so it can be scrolled from the keyboard.
- **Keyboard:** from a focused activatable row, the arrow keys, Page Up / Page Down and Home / End move to another row, and a windowed table scrolls to it. Before, these keys scrolled the page. Enter and Space still activate the row.
- The props type of the option is exported as `TableWindowing`.
