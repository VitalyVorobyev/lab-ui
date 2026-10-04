---
"@vitavision/ui": minor
---

`Table` sorts by column.

- **Sortable columns.** Give a `Column` a `sortValue(row)` (a number, a string, or `null`/`undefined`) or a `compare(a, b)` (an ascending comparison, for an order one value cannot express, such as reading order by y then x) and its header becomes a button. Each click moves the column from its `firstSort` direction (default `"ascending"`; `"descending"` suits a score) to the other one, then back to the rows' own order. `sortable` overrides the default: `false` keeps a column with a `sortValue` unsortable, `true` with neither function makes a header sortable for an app that orders the rows itself.
- **The order.** Numbers compare by value; strings by a fixed English collation that reads digit runs as numbers ("frame 9" before "frame 10"), so a server render and the browser agree; numbers come before strings; `null`, `undefined` and `NaN` go last in both directions. The sort is stable in both directions: rows that compare equal keep their order in `rows`. `compare` takes precedence over `sortValue`.
- **State.** The table keeps the sort itself, starting from `defaultSort` (default `null`, unsorted), or follows a controlled `sort` (`{ key, direction }` or `null`) with `onSortChange`. With `manualSort` the headers show and report the sort while the rows render exactly as given, for an app that sorts on a server.
- **Accessibility and styling.** The sorted header carries `aria-sort` and `data-sort` (`"ascending"` or `"descending"`); other sortable headers carry `data-sort="none"` and no `aria-sort`. The header button is reachable with Tab and pressed with Enter or Space; its arrow icon is hidden from assistive technology.
- **Row indices.** `onRowClick`, `isRowActive`, `onRowHover` and `rowKey` receive each row's index in `rows`, whatever the order on screen.
- **`sortRows(rows, columns, sort)`** returns the rows in the order the table shows them, for next/previous navigation, an export, or a server that should sort the same way. New types: `TableSort` and `SortDirection`.

Columns without `sortValue`, `compare` or `sortable` render exactly as before, so an existing table is unchanged until a column opts in.
