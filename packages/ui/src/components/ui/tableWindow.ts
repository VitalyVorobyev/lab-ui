/*
 * The arithmetic of a windowed table: which rows to render for a scroll position, and where
 * to scroll to bring a row into view. Pure, so it is tested on its own (`tableWindow.test.ts`,
 * `tableWindow.property.test.ts`) rather than through layout.
 *
 * Every row is `rowHeight` tall. The body starts below a sticky header `headerHeight` tall, and
 * the scroll container shows `viewportHeight` of the whole (header included).
 */

/** The rows to render, as a half-open range of positions, and the space around them. */
export interface RowWindow {
  /** The first rendered position. */
  start: number;
  /** One past the last rendered position. */
  end: number;
  /** The height, in px, of the rows before `start`. */
  before: number;
  /** The height, in px, of the rows from `end` on. */
  after: number;
}

/** What the window depends on. Lengths in px. */
export interface WindowInput {
  rowCount: number;
  rowHeight: number;
  /** The scroll container's `scrollTop`. */
  scrollTop: number;
  /** The scroll container's visible height, header included. */
  viewportHeight: number;
  /** The sticky header's height. */
  headerHeight: number;
  /** Rows rendered beyond each edge of the visible ones. */
  overscan: number;
}

/**
 * The rows that intersect the visible part of the body, plus `overscan` on each side.
 * Degenerate input (no rows, a row height ≤ 0, NaN) gives an empty window.
 */
export function rowWindow({ rowCount, rowHeight, scrollTop, viewportHeight, headerHeight, overscan }: WindowInput): RowWindow {
  const count = Number.isFinite(rowCount) ? Math.max(0, Math.floor(rowCount)) : 0;
  if (count === 0 || !(rowHeight > 0)) return { start: 0, end: 0, before: 0, after: 0 };
  const extra = Math.max(0, Math.floor(overscan) || 0);
  // In the body's own coordinates the visible part is [scrollTop, scrollTop + viewport − header]:
  // the sticky header covers the top of the container.
  const top = Math.max(0, scrollTop || 0);
  const bottom = Math.max(top, top + Math.max(0, viewportHeight || 0) - Math.max(0, headerHeight || 0));
  const first = Math.min(count, Math.floor(top / rowHeight));
  const last = Math.min(count, Math.max(first + 1, Math.ceil(bottom / rowHeight)));
  const start = Math.max(0, first - extra);
  const end = Math.min(count, last + extra);
  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight };
}

/**
 * The `scrollTop` that shows the row at `position` in full below the sticky header, moving
 * as little as possible: unchanged when it is already in view, else aligned to the nearer
 * edge. A viewport shorter than one row aligns the row's top.
 */
export function scrollTopFor(
  position: number,
  { rowHeight, scrollTop, viewportHeight, headerHeight }: Pick<WindowInput, "rowHeight" | "scrollTop" | "viewportHeight" | "headerHeight">,
): number {
  const rowTop = position * rowHeight;
  const visible = viewportHeight - headerHeight;
  if (rowTop < scrollTop || visible < rowHeight) return rowTop;
  if (rowTop + rowHeight > scrollTop + visible) return rowTop + rowHeight - visible;
  return scrollTop;
}

/**
 * The position a navigation key moves to from `position`, among `rowCount` rows, `page` rows
 * to a screen; `null` for a key that does not navigate.
 */
export function navigate(key: string, position: number, rowCount: number, page: number): number | null {
  const last = rowCount - 1;
  if (last < 0) return null;
  const step = Math.max(1, Math.floor(page));
  const clamp = (p: number) => Math.min(last, Math.max(0, p));
  switch (key) {
    case "ArrowDown":
      return clamp(position + 1);
    case "ArrowUp":
      return clamp(position - 1);
    case "PageDown":
      return clamp(position + step);
    case "PageUp":
      return clamp(position - step);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
