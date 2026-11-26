/*
 * A two-dimensional grid of captures: views down, cameras across, one cell each.
 *
 * Built for the overview of a calibration dataset, where ten cameras by several hundred views
 * must stay light and a person must be able to walk it cell by cell. A `Table` windows rows and
 * moves focus by row; this windows both axes and moves focus by cell. The caller draws each cell
 * (a thumbnail, a count, a state); the matrix owns the geometry, the sticky headers, the
 * keyboard, the selection and the grid roles.
 *
 * Only the cells in view, plus a margin and the focused cell, are in the DOM. Every handler is
 * on the scroller and finds its cell from the event's target, so there is no listener per cell.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";

import { cn, focusRingInset } from "@vitavision/ui";

import { inRect, moveFocus, rectBetween, revealScroll, windowRange, type GridPos } from "./matrixModel";

/** One row of a `SequenceMatrix`: a view, a frame. */
export interface SequenceMatrixRow {
  /** Its identity, unique among the rows. */
  id: string;
  /** What the row header shows. */
  label: ReactNode;
  /** The row's name for assistive technology, when `label` is not text. Defaults to `label` as text, else `id`. */
  name?: string | undefined;
}

/** One column of a `SequenceMatrix`: a camera, a channel. */
export interface SequenceMatrixColumn {
  /** Its identity, unique among the columns. */
  id: string;
  /** What the column header shows. */
  label: ReactNode;
  /** The column's name for assistive technology, when `label` is not text. Defaults to `label` as text, else `id`. */
  name?: string | undefined;
}

/**
 * A selection: the cell `row` / `col`, or the rectangle from it to `rowTo` / `colTo`.
 *
 * `row` and `col` are the anchor (where the selection started); a range extends from there, in
 * either direction. A whole row is `{ row, col: firstColumn, colTo: lastColumn }`.
 */
export interface SequenceMatrixSelection {
  /** The anchor's row id. */
  row: string;
  /** The anchor's column id. */
  col: string;
  /** The row id the range extends to. Omitted: the anchor's row. */
  rowTo?: string | undefined;
  /** The column id the range extends to. Omitted: the anchor's column. */
  colTo?: string | undefined;
}

/** What `renderCell` is told about the cell it draws. */
export interface SequenceMatrixCellState {
  /** The cell has the keyboard focus. */
  focused: boolean;
  /** The cell is in the selection. */
  selected: boolean;
}

/** Props of `SequenceMatrix`. */
export interface SequenceMatrixProps {
  /** The rows, top to bottom. */
  rows: readonly SequenceMatrixRow[];
  /** The columns, left to right. */
  columns: readonly SequenceMatrixColumn[];
  /**
   * Draws a cell's content. It fills the cell's box (`colWidth` by `rowHeight`) and is called for
   * the cells in view only, so it may be as rich as a thumbnail. The cell is a `gridcell`; give
   * it an accessible name with `cellLabel` when its content is not text.
   */
  renderCell: (row: SequenceMatrixRow, column: SequenceMatrixColumn, state: SequenceMatrixCellState) => ReactNode;
  /** The cell's accessible name (`aria-label`), e.g. `"view 12, camera 3, 48 corners"`. Omitted: the cell's content names it. */
  cellLabel?: ((row: SequenceMatrixRow, column: SequenceMatrixColumn) => string | undefined) | undefined;
  /** Draws a row header's content. Defaults to `row.label`. Interactive content here is the caller's to make focusable. */
  renderRowHeader?: ((row: SequenceMatrixRow) => ReactNode) | undefined;
  /** Draws a column header's content. Defaults to `column.label`. */
  renderColumnHeader?: ((column: SequenceMatrixColumn) => ReactNode) | undefined;
  /** The corner's text. Defaults to nothing visible; the corner is named "Rows". */
  corner?: ReactNode;
  /** A row's height in CSS pixels. Defaults to 36. */
  rowHeight?: number | undefined;
  /** Every column's width in CSS pixels. Defaults to 72. */
  colWidth?: number | undefined;
  /** The column headers' height. Defaults to 32. */
  headerHeight?: number | undefined;
  /** The row headers' width. Defaults to 96. */
  rowHeaderWidth?: number | undefined;
  /** Rows and columns rendered beyond the viewport on each side. Defaults to 3. */
  overscan?: number | undefined;
  /** Render only the cells in view. Defaults to true; off, every cell is rendered (a small matrix). */
  windowed?: boolean | undefined;
  /** The selection, controlled: `null` for none. Pair with `onValueChange`. */
  value?: SequenceMatrixSelection | null | undefined;
  /** The initial selection, when uncontrolled. */
  defaultValue?: SequenceMatrixSelection | null | undefined;
  /** Called with the new selection on a click, Space, Enter, or Shift + a move, and on a header click. */
  onValueChange?: ((value: SequenceMatrixSelection) => void) | undefined;
  /** Select the cell the arrow keys land on, as well as focus it. Defaults to false: arrows move, Space or Enter selects. */
  selectionFollowsFocus?: boolean | undefined;
  /** Allow a range (Shift + click or move, header click, Ctrl + A). Defaults to true; off, selection is one cell. */
  multiple?: boolean | undefined;
  /** Called with the cell's row and column ids on Enter and on a double click. */
  onCellAction?: ((row: string, column: string) => void) | undefined;
  /** Names the grid. */
  "aria-label": string;
  /** Merged onto the scroller with `cn`. Give the matrix a height (and a width): it scrolls inside its box. */
  className?: string | undefined;
  /** Inline style of the scroller, after the matrix's own: its size when a class is not at hand. */
  style?: CSSProperties | undefined;
}

const DEFAULTS = { rowHeight: 36, colWidth: 72, headerHeight: 32, rowHeaderWidth: 96, overscan: 3 } as const;
/** The room assumed before the scroller is measured, and on the server. */
const INITIAL_VIEWPORT = { width: 640, height: 400 } as const;

interface Win {
  rows: [number, number];
  cols: [number, number];
}

const sameWin = (a: Win, b: Win) =>
  a.rows[0] === b.rows[0] && a.rows[1] === b.rows[1] && a.cols[0] === b.cols[0] && a.cols[1] === b.cols[1];

const nameOf = (item: { id: string; label: ReactNode; name?: string | undefined }) =>
  item.name ?? (typeof item.label === "string" || typeof item.label === "number" ? String(item.label) : item.id);

/** The grid cell, row header or column header an event came from, with its position. */
function locate(target: EventTarget | null): { kind: "cell" | "row" | "col"; row: number; col: number; element: HTMLElement } | null {
  const element = (target as Element | null)?.closest?.<HTMLElement>("[data-cell],[data-row-header],[data-col-header]");
  if (!element) return null;
  const row = Number(element.dataset["r"] ?? -1);
  const col = Number(element.dataset["c"] ?? -1);
  if (element.hasAttribute("data-cell")) return { kind: "cell", row, col, element };
  return element.hasAttribute("data-row-header") ? { kind: "row", row, col, element } : { kind: "col", row, col, element };
}

/**
 * A windowed rows-by-columns grid with sticky headers and cell-level keyboard focus.
 *
 * - **Windowed in both axes**: only the cells in view (plus `overscan`, plus the focused cell) are
 *   in the DOM, so ten columns by several hundred rows are a few dozen elements. Row height and
 *   column width are uniform.
 * - **Keyboard**: the grid is one Tab stop (roving `tabindex` on the focused cell). Arrows move by
 *   cell, Home/End to the ends of the row, Ctrl + Home/End to the corners, PageUp/PageDown by a
 *   screenful of rows. Space or Enter selects the focused cell and Enter also calls `onCellAction`;
 *   Shift + a move or Shift + click extends the selection to a rectangle; Shift + Space selects
 *   the focused row, Ctrl + Space its column, Ctrl + A everything.
 * - **Selection**: one cell or a rectangle, controlled (`value`) or not. A click on a row or
 *   column header selects that whole row or column.
 * - **Roles**: `grid` with `aria-rowcount` and `aria-colcount` (counting the headers), `row`s with
 *   `aria-rowindex`, `columnheader`, `rowheader` and `gridcell`s with `aria-colindex` and
 *   `aria-selected`; the whole rectangle is `aria-multiselectable`. Cells carry `data-selected`
 *   and `data-focused`.
 * - **No listeners per cell**: clicks, keys and focus are handled once, on the scroller.
 *
 * Server rendering draws the first screenful of an assumed 640 by 400 px, without measuring.
 */
export function SequenceMatrix({
  rows,
  columns,
  renderCell,
  cellLabel,
  renderRowHeader,
  renderColumnHeader,
  corner,
  rowHeight = DEFAULTS.rowHeight,
  colWidth = DEFAULTS.colWidth,
  headerHeight = DEFAULTS.headerHeight,
  rowHeaderWidth = DEFAULTS.rowHeaderWidth,
  overscan = DEFAULTS.overscan,
  windowed = true,
  value: controlled,
  defaultValue = null,
  onValueChange,
  selectionFollowsFocus = false,
  multiple = true,
  onCellAction,
  "aria-label": ariaLabel,
  className,
  style,
}: SequenceMatrixProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState<SequenceMatrixSelection | null>(defaultValue);
  const value = controlled === undefined ? inner : controlled;
  const [focus, setFocus] = useState<GridPos | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  const focusPending = useRef(false);

  const rowIndex = useMemo(() => new Map(rows.map((row, i) => [row.id, i])), [rows]);
  const colIndex = useMemo(() => new Map(columns.map((column, i) => [column.id, i])), [columns]);
  const nRows = rows.length;
  const nCols = columns.length;

  const initialWin = (): Win =>
    windowed
      ? {
          rows: windowRange(0, INITIAL_VIEWPORT.height - headerHeight, rowHeight, nRows, overscan),
          cols: windowRange(0, INITIAL_VIEWPORT.width - rowHeaderWidth, colWidth, nCols, overscan),
        }
      : { rows: [0, nRows], cols: [0, nCols] };
  const [win, setWin] = useState<Win>(initialWin);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const next: Win = windowed
      ? {
          rows: windowRange(el.scrollTop, el.clientHeight - headerHeight, rowHeight, nRows, overscan),
          cols: windowRange(el.scrollLeft, el.clientWidth - rowHeaderWidth, colWidth, nCols, overscan),
        }
      : { rows: [0, nRows], cols: [0, nCols] };
    setWin((prev) => (sameWin(prev, next) ? prev : next));
  }, [windowed, headerHeight, rowHeight, nRows, overscan, rowHeaderWidth, colWidth, nCols]);

  // The window follows the geometry and the data; the scroller's size is observed.
  useLayoutEffect(() => {
    measure();
  }, [measure]);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const range = useMemo(() => {
    if (!value) return null;
    const a = { row: rowIndex.get(value.row), col: colIndex.get(value.col) };
    const b = { row: rowIndex.get(value.rowTo ?? value.row), col: colIndex.get(value.colTo ?? value.col) };
    if (a.row === undefined || a.col === undefined || b.row === undefined || b.col === undefined) return null;
    return rectBetween({ row: a.row, col: a.col }, { row: b.row, col: b.col });
  }, [value, rowIndex, colIndex]);

  const anchor: GridPos | null = useMemo(() => {
    if (!value) return null;
    const row = rowIndex.get(value.row);
    const col = colIndex.get(value.col);
    return row === undefined || col === undefined ? null : { row, col };
  }, [value, rowIndex, colIndex]);

  // The one cell in the tab order: the focused one, else the selection's anchor, else the first.
  const clampPos = (pos: GridPos): GridPos => ({
    row: Math.min(Math.max(0, pos.row), Math.max(0, nRows - 1)),
    col: Math.min(Math.max(0, pos.col), Math.max(0, nCols - 1)),
  });
  const tabStop = clampPos(focus ?? anchor ?? { row: 0, col: 0 });

  const commit = (next: SequenceMatrixSelection) => {
    if (controlled === undefined) setInner(next);
    onValueChange?.(next);
  };
  const selectRange = (from: GridPos, to: GridPos) => {
    const a = rows[from.row];
    const b = rows[to.row];
    const c = columns[from.col];
    const d = columns[to.col];
    if (!a || !b || !c || !d) return;
    const one = from.row === to.row && from.col === to.col;
    commit(one || !multiple ? { row: b.id, col: d.id } : { row: a.id, col: c.id, rowTo: b.id, colTo: d.id });
  };

  const bodyViewport = () => {
    const el = scrollerRef.current;
    return {
      height: (el?.clientHeight ?? INITIAL_VIEWPORT.height) - headerHeight,
      width: (el?.clientWidth ?? INITIAL_VIEWPORT.width) - rowHeaderWidth,
    };
  };

  /** Moves the cursor to `pos`: scrolls it into view and gives it the DOM focus once rendered. */
  const moveTo = (pos: GridPos) => {
    const el = scrollerRef.current;
    if (el) {
      const viewport = bodyViewport();
      el.scrollTop = revealScroll(el.scrollTop, viewport.height, pos.row, rowHeight);
      el.scrollLeft = revealScroll(el.scrollLeft, viewport.width, pos.col, colWidth);
    }
    focusPending.current = true;
    setFocus(pos);
  };

  useEffect(() => {
    if (!focusPending.current) return;
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-cell][data-r="${tabStop.row}"][data-c="${tabStop.col}"]`);
    if (!el) return;
    focusPending.current = false;
    el.focus({ preventScroll: true });
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const hit = locate(event.target);
    // Keys typed into something inside a cell (an input, a menu) are not the grid's.
    if (!hit || hit.kind !== "cell" || hit.element !== event.target || nRows === 0 || nCols === 0) return;
    const here = { row: hit.row, col: hit.col };
    const ctrl = event.ctrlKey || event.metaKey;
    if (event.altKey) return;

    if (event.key === " ") {
      event.preventDefault();
      if (event.shiftKey && multiple) selectRange({ row: here.row, col: 0 }, { row: here.row, col: nCols - 1 });
      else if (ctrl && multiple) selectRange({ row: 0, col: here.col }, { row: nRows - 1, col: here.col });
      else selectRange(here, here);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectRange(here, here);
      onCellAction?.(rows[here.row]!.id, columns[here.col]!.id);
      return;
    }
    if (ctrl && event.key.toLowerCase() === "a") {
      if (!multiple) return;
      event.preventDefault();
      selectRange({ row: 0, col: 0 }, { row: nRows - 1, col: nCols - 1 });
      return;
    }
    const page = Math.max(1, Math.floor(bodyViewport().height / rowHeight) - 1);
    const next = moveFocus(here, event.key, { rows: nRows, cols: nCols }, page, ctrl);
    if (next === null) return;
    event.preventDefault();
    moveTo(next);
    if (event.shiftKey && multiple) selectRange(anchor ?? here, next);
    else if (selectionFollowsFocus) selectRange(next, next);
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const hit = locate(event.target);
    if (!hit) return;
    // A button or menu the caller put in a header is its own: it does not also select the row.
    if (hit.kind !== "cell" && (event.target as Element).closest("button,a,input,select,textarea,[role=menu]")) return;
    if (hit.kind === "cell") {
      setFocus({ row: hit.row, col: hit.col });
      const here = { row: hit.row, col: hit.col };
      if (event.shiftKey && multiple && anchor) selectRange(anchor, here);
      else selectRange(here, here);
    } else if (multiple && hit.kind === "row") selectRange({ row: hit.row, col: 0 }, { row: hit.row, col: nCols - 1 });
    else if (multiple && hit.kind === "col") selectRange({ row: 0, col: hit.col }, { row: nRows - 1, col: hit.col });
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const hit = locate(event.target);
    if (hit?.kind === "cell") onCellAction?.(rows[hit.row]!.id, columns[hit.col]!.id);
  };

  // Rows and columns to render: the window, and the focused ones wherever they are, so the tab stop never unmounts.
  const withFocus = (window: [number, number], at: number, count: number): number[] => {
    const out: number[] = [];
    let placed = at < 0 || at >= count || (at >= window[0] && at < window[1]);
    for (let i = window[0]; i < window[1]; i++) {
      if (!placed && at < i) {
        out.push(at);
        placed = true;
      }
      out.push(i);
    }
    if (!placed) out.push(at);
    return out;
  };
  const rowsShown = withFocus(win.rows, tabStop.row, nRows);
  const colsShown = withFocus(win.cols, tabStop.col, nCols);

  const totalWidth = rowHeaderWidth + nCols * colWidth;
  const totalHeight = headerHeight + nRows * rowHeight;
  const fullRow = (i: number) => range !== null && range.row0 <= i && i <= range.row1 && range.col0 === 0 && range.col1 === nCols - 1;
  const fullCol = (j: number) => range !== null && range.col0 <= j && j <= range.col1 && range.row0 === 0 && range.row1 === nRows - 1;

  return (
    <div
      ref={scrollerRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={nRows + 1}
      aria-colcount={nCols + 1}
      aria-multiselectable={multiple ? true : undefined}
      // With no cell to focus, the scroller itself is the keyboard stop.
      tabIndex={nRows === 0 || nCols === 0 ? 0 : undefined}
      onScroll={measure}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onFocus={(event) => {
        setHasFocus(true);
        const hit = locate(event.target);
        if (hit?.kind === "cell") setFocus({ row: hit.row, col: hit.col });
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
      // Native focus scrolling keeps a cell clear of the sticky headers.
      style={{ position: "relative", overflow: "auto", scrollPaddingTop: headerHeight, scrollPaddingLeft: rowHeaderWidth, ...style }}
      className={cn("rounded-control border border-line bg-surface text-fg select-none", className)}
    >
      <div style={{ position: "relative", width: totalWidth, height: totalHeight }}>
        <div role="row" aria-rowindex={1} style={{ position: "sticky", top: 0, zIndex: 20, height: headerHeight, width: totalWidth }}>
          <div
            role="columnheader"
            aria-colindex={1}
            className="flex items-center border-r border-b border-line bg-raised px-2 text-xs text-fg-muted"
            style={{ position: "sticky", left: 0, zIndex: 30, width: rowHeaderWidth, height: headerHeight }}
          >
            {corner ?? <span className="sr-only">Rows</span>}
          </div>
          {colsShown.map((j) => {
            const column = columns[j]!;
            return (
              <div
                key={column.id}
                role="columnheader"
                aria-colindex={j + 2}
                aria-label={nameOf(column)}
                aria-selected={fullCol(j) ? true : undefined}
                data-col-header=""
                data-c={j}
                data-selected={fullCol(j) ? "" : undefined}
                className={cn(
                  "flex items-center justify-center overflow-hidden border-r border-b border-line px-1 text-xs",
                  fullCol(j) ? "bg-signal/12 text-fg" : "bg-raised text-fg-muted",
                )}
                style={{ position: "absolute", top: 0, left: rowHeaderWidth + j * colWidth, width: colWidth, height: headerHeight }}
              >
                {renderColumnHeader ? renderColumnHeader(column) : column.label}
              </div>
            );
          })}
        </div>
        {rowsShown.map((i) => {
          const row = rows[i]!;
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={i + 2}
              style={{ position: "absolute", top: headerHeight + i * rowHeight, left: 0, height: rowHeight, width: totalWidth }}
            >
              <div
                role="rowheader"
                aria-colindex={1}
                aria-label={nameOf(row)}
                aria-selected={fullRow(i) ? true : undefined}
                data-row-header=""
                data-r={i}
                data-selected={fullRow(i) ? "" : undefined}
                className={cn(
                  "flex items-center overflow-hidden border-r border-b border-line px-2 text-xs",
                  fullRow(i) ? "bg-signal/12 text-fg" : "bg-raised text-fg-muted",
                )}
                style={{ position: "sticky", left: 0, zIndex: 10, width: rowHeaderWidth, height: rowHeight }}
              >
                {renderRowHeader ? renderRowHeader(row) : row.label}
              </div>
              {colsShown.map((j) => {
                const column = columns[j]!;
                const selected = inRect(range, i, j);
                const isStop = i === tabStop.row && j === tabStop.col;
                const focused = hasFocus && isStop;
                return (
                  <div
                    key={column.id}
                    role="gridcell"
                    aria-colindex={j + 2}
                    aria-selected={selected}
                    aria-label={cellLabel?.(row, column)}
                    tabIndex={isStop ? 0 : -1}
                    data-cell=""
                    data-r={i}
                    data-c={j}
                    data-selected={selected ? "" : undefined}
                    data-focused={focused ? "" : undefined}
                    className={cn(
                      "overflow-hidden border-r border-b border-line",
                      selected ? "bg-signal/12" : "hover:bg-raised",
                      focusRingInset,
                    )}
                    style={{ position: "absolute", top: 0, left: rowHeaderWidth + j * colWidth, width: colWidth, height: rowHeight }}
                  >
                    {renderCell(row, column, { focused, selected })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
