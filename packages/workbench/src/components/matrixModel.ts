/*
 * The arithmetic of `SequenceMatrix`, apart from the DOM: where the cursor goes on a key, which
 * rows and columns a scroll position shows, how far to scroll to reveal a cell, and the rectangle
 * of a selection. Pure, so the edges (an empty grid, a page past the end) are tested without a browser.
 */

/** A cell by position: zero-based row and column indices. */
export interface GridPos {
  /** The row index. */
  row: number;
  /** The column index. */
  col: number;
}

/** The grid's size in cells. */
export interface GridSize {
  /** The number of rows. */
  rows: number;
  /** The number of columns. */
  cols: number;
}

/** A rectangle of cells, both ends inclusive. */
export interface GridRect {
  /** The first row. */
  row0: number;
  /** The last row. */
  row1: number;
  /** The first column. */
  col0: number;
  /** The last column. */
  col1: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Where a navigation key takes the cursor.
 *
 * - Arrows move one cell and stop at the edge.
 * - `Home` and `End` go to the first and last column of the row; with `ctrl`, to the first and
 *   last cell of the grid.
 * - `PageUp` and `PageDown` move `page` rows.
 *
 * @param from - The cursor.
 * @param key - A `KeyboardEvent.key`.
 * @param size - The grid.
 * @param page - Rows in a page, at least 1.
 * @param ctrl - Whether Ctrl (or Cmd) is held.
 * @returns The new position, or `null` when the key is not a navigation key or the grid is empty.
 *   The position is clamped, so it may equal `from`.
 */
export function moveFocus(from: GridPos, key: string, size: GridSize, page: number, ctrl = false): GridPos | null {
  if (size.rows <= 0 || size.cols <= 0) return null;
  const lastRow = size.rows - 1;
  const lastCol = size.cols - 1;
  const step = Math.max(1, Math.floor(page));
  const at = (row: number, col: number): GridPos => ({ row: clamp(row, 0, lastRow), col: clamp(col, 0, lastCol) });
  switch (key) {
    case "ArrowUp":
      return at(from.row - 1, from.col);
    case "ArrowDown":
      return at(from.row + 1, from.col);
    case "ArrowLeft":
      return at(from.row, from.col - 1);
    case "ArrowRight":
      return at(from.row, from.col + 1);
    case "Home":
      return ctrl ? at(0, 0) : at(from.row, 0);
    case "End":
      return ctrl ? at(lastRow, lastCol) : at(from.row, lastCol);
    case "PageUp":
      return at(from.row - step, from.col);
    case "PageDown":
      return at(from.row + step, from.col);
    default:
      return null;
  }
}

/**
 * The items of one axis to render for a scroll position, plus a margin.
 *
 * @param scroll - The scroll offset along the axis, in pixels, from the start of the body.
 * @param viewport - The room the body has on that axis (the scroller's size less the sticky header).
 * @param size - One item's size in pixels.
 * @param count - The number of items.
 * @param overscan - Extra items on each side.
 * @returns `[start, end)`: indices to render. `[0, 0)` for no items or a non-positive size.
 */
export function windowRange(scroll: number, viewport: number, size: number, count: number, overscan: number): [number, number] {
  if (count <= 0 || !(size > 0)) return [0, 0];
  const first = Math.floor(Math.max(0, scroll) / size);
  const last = Math.ceil((Math.max(0, scroll) + Math.max(0, viewport)) / size);
  // A scroll far past the end still shows the last item.
  if (first >= count) return [Math.max(0, count - 1 - overscan), count];
  const start = clamp(first - overscan, 0, count);
  return [start, clamp(last + overscan, start, count)];
}

/**
 * The scroll offset that brings an item fully into view, moving as little as possible.
 *
 * @param scroll - The current offset.
 * @param viewport - The room the body has on this axis.
 * @param index - The item.
 * @param size - One item's size.
 * @returns The offset: unchanged when the item is in view already, never negative.
 */
export function revealScroll(scroll: number, viewport: number, index: number, size: number): number {
  const start = index * size;
  const end = start + size;
  if (start < scroll) return Math.max(0, start);
  if (end > scroll + viewport) return Math.max(0, end - viewport);
  return scroll;
}

/** The rectangle between two cells, in whichever order they are given. */
export function rectBetween(a: GridPos, b: GridPos): GridRect {
  return { row0: Math.min(a.row, b.row), row1: Math.max(a.row, b.row), col0: Math.min(a.col, b.col), col1: Math.max(a.col, b.col) };
}

/** Whether a cell is in a rectangle. */
export function inRect(rect: GridRect | null, row: number, col: number): boolean {
  return rect !== null && row >= rect.row0 && row <= rect.row1 && col >= rect.col0 && col <= rect.col1;
}
