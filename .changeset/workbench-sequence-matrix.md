---
"@vitavision/workbench": patch
---

Add `SequenceMatrix`, a rows-by-columns grid of captures (views by cameras).

It is windowed in both axes (only the cells in view, plus `overscan` and the focused cell, are in the DOM, so ten cameras by several hundred views is a few dozen cells) with sticky row and column headers. You draw each cell with `renderCell(row, column, { focused, selected })`; `rowHeight`, `colWidth`, `headerHeight` and `rowHeaderWidth` set the geometry, and you give the matrix a size with `className` or `style` (it scrolls inside its box). `windowed={false}` renders every cell for a small matrix.

The grid is one Tab stop with the focused cell carrying the roving `tabindex`: arrows move by cell, Home and End by row, Ctrl + Home and Ctrl + End to the corners, PageUp and PageDown by a screenful. Space or Enter select; Enter and a double click call `onCellAction(rowId, columnId)`. Selection is a cell or a rectangle, `{ row, col, rowTo?, colTo? }` by id, controlled (`value`, `onValueChange`) or not (`defaultValue`): Shift + a move or a click extends it, a header click selects the whole row or column, Shift + Space and Ctrl + Space do the same from the keyboard, Ctrl + A selects all. `selectionFollowsFocus` selects on every move and `multiple={false}` limits it to one cell.

It is a `grid` with `aria-rowcount` and `aria-colcount` counting the headers, `aria-rowindex` and `aria-colindex` on every rendered row and cell, `rowheader` and `columnheader` cells, and `aria-selected`; give a cell that is not text an accessible name with `cellLabel`. Clicks, keys and focus are handled once on the scroller, never per cell, so hover is CSS only.
