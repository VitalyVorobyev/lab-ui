---
"@vitavision/ui": patch
---

`Table` gains column groups and a pinned first column, and `DeltaCell` shows a value with its difference.

- **Column groups:** give columns a `group` label and a header row appears above the column headers. Adjacent columns with the same label sit under one cell that spans them, with a rule under its label; a column with no group gets an empty cell. Sorting, keyboard behaviour and windowing are unchanged, and a windowed table keeps both header rows in view and counts the group row in `aria-rowcount` and `aria-rowindex`.
- **Pinned column:** `pinFirstColumn` keeps the first column in view while the others scroll sideways. The table is then as wide as its content, the pinned cells are drawn on `surface` (so use it on a panel), and a row's hover and current tint show on them.
- **`DeltaCell`:** a numeric-cell helper. `value` and a signed `delta` (written `+0.012` / `−0.4`, announced as "change +0.012", or with `deltaLabel`), and a `magnitude` you normalise to `[0, 1]` that steps into a `none`, `low`, `medium` or `high` tint (`deltaStrength` gives the step). The tint is the accent or a neutral (`tone`), never a verdict colour. `format`, `deltaFormat` and `unit` shape the text.
