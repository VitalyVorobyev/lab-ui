/*
 * A table.
 *
 * `numeric` is the column property that matters here. Quantities are set in mono with
 * tabular figures and aligned right, so a column of scores or measurements can be compared
 * by eye down its decimal point rather than read one row at a time.
 *
 * Sorting is per column and follows the sortable-table pattern of the ARIA Authoring
 * Practices: the header's content is a button, and only the sorted header carries
 * `aria-sort`. The order itself lives in `tableSort.ts`.
 *
 * `windowed` renders only the rows in view, between two spacer rows that keep the scroll
 * height, so a table of thousands of rows scrolls as fast as one of thirty. It stays a real
 * `<table>`: the rows that are rendered carry `aria-rowindex` and the table `aria-rowcount`, so
 * a reader still hears "row 2,041 of 5,001". The arithmetic lives in `tableWindow.ts`.
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";

import { byDensity, useDensity } from "./Density";
import { cn, focusRing, focusRingInset } from "./cn";
import { isSortable, nextSort, type SortDirection, sortOrder, type TableSort } from "./tableSort";
import { navigate, rowWindow, scrollTopFor } from "./tableWindow";

/** One column of a `Table`: its header and how to render a row's cell. */
export type Column<Row> = {
  /** Unique among the columns; the React key of its header and cells. */
  key: string;
  /** The `<th>` content. */
  header: ReactNode;
  /** Right-aligned, mono, tabular. Use for anything that is a quantity. */
  numeric?: boolean;
  /** A CSS width for the column, e.g. `"6rem"`. */
  width?: string;
  /** The cell's content for a row. */
  cell: (row: Row) => ReactNode;
  /**
   * Whether the header sorts the table. Defaults to `true` when the column has a `sortValue`
   * or a `compare`. Set it `true` with neither for a column the app sorts itself (see the
   * table's `manualSort`), or `false` to keep a column with a `sortValue` unsortable.
   */
  sortable?: boolean | undefined;
  /**
   * The value the column sorts by. Numbers compare by value; strings by a fixed English
   * collation that reads digit runs as numbers ("frame 9" before "frame 10"), so a server
   * render and the browser agree; numbers come before strings. `null`, `undefined` and `NaN`
   * go last in both directions.
   */
  sortValue?: ((row: Row) => number | string | null | undefined) | undefined;
  /**
   * A full ascending comparison, for an order one value cannot express (two fields, a rank):
   * negative when `a` comes first. Takes precedence over `sortValue`. Reversed for
   * `"descending"`; rows that compare equal keep their order in `rows` either way.
   */
  compare?: ((a: Row, b: Row) => number) | undefined;
  /**
   * The direction of the first click on the header. Defaults to `"ascending"`; `"descending"`
   * suits a score, where the best comes first.
   */
  firstSort?: SortDirection | undefined;
};

/**
 * Windowed rendering for a long table: only the rows in view, plus `overscan` on each side,
 * are in the DOM. The rows scroll under a sticky header drawn on `surface`, the panel colour.
 */
export interface TableWindowing {
  /**
   * Every body row's height in px. Rows are drawn exactly this tall and cells keep to one line
   * (longer content is cut with an ellipsis), so it must be at least the density's own row
   * height: 36 px comfortable, 22 px compact.
   */
  rowHeight: number;
  /**
   * The scroll area's height in px, header included. Leave it out to fill the height of the
   * container, which must then have one (a flex child with `min-h-0`, a fixed-height panel).
   */
  height?: number | undefined;
  /** Rows rendered beyond each edge of the view, so a fast scroll shows no gap. Defaults to 8. */
  overscan?: number | undefined;
}

/** Rows per screen before a windowed table has measured itself (a server render, the first paint). */
const INITIAL_ROWS = 20;

/** The header icon for a sort state: the direction when sorted, both arrows when only sortable. */
const SORT_ICONS = { ascending: ArrowUp, descending: ArrowDown, none: ArrowUpDown } as const;

/**
 * A table of rows, with numeric columns set in mono and right-aligned.
 *
 * With `onRowClick` the rows are keyboard-reachable (Tab, then Enter or Space) while keeping
 * their table semantics. The active row carries `aria-current` and `data-state="active"`;
 * padding follows the density in force. With no rows it renders the `empty` message instead.
 *
 * A column with a `sortValue` or a `compare` gets a header button: each click moves its sort
 * from the column's `firstSort` direction to the other one, then back to the rows' own order.
 * The sorted header carries `aria-sort` and `data-sort` (`"ascending"` or `"descending"`);
 * other sortable headers carry `data-sort="none"`. The sort is kept by the table (from
 * `defaultSort`) or controlled (`sort` with `onSortChange`); with `manualSort` the headers
 * show it and the rows render as given. Row callbacks always receive a row's index in `rows`,
 * whatever the order on screen.
 *
 * Activatable rows also move focus with the arrow keys, Page Up / Page Down and Home / End;
 * with `selectionFollowsFocus` each of those moves also activates the row it lands on.
 * With `windowed` the table scrolls itself (vertically, under a sticky header), renders only the
 * rows in view, and uses a fixed layout: give columns a `width` where the content needs it.
 */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  empty = "Nothing here.",
  caption,
  className,
  onRowClick,
  isRowActive,
  onRowHover,
  sort: controlledSort,
  defaultSort = null,
  onSortChange,
  manualSort = false,
  windowed,
  selectionFollowsFocus = false,
}: {
  /** The columns, in order. */
  columns: Column<Row>[];
  /** The rows, in their own order: the order shown while the table is not sorted. */
  rows: Row[];
  /** A stable key per row. `index` is the row's position in `rows`, whatever the sort. */
  rowKey: (row: Row, index: number) => string | number;
  /** Shown instead of the table when there are no rows. Defaults to "Nothing here.". */
  empty?: ReactNode;
  /** Names the table for assistive technology (a visually hidden `<caption>`). */
  caption?: string | undefined;
  /** Merged with the scroll wrapper's (or the empty message's) own classes through `cn`. */
  className?: string | undefined;
  /** Makes rows activatable. Keyboard-reachable, so a table used as a list of
   * destinations is not a mouse-only control. The event is passed so a caller can read
   * modifiers — a list kept in step with a canvas needs shift-range and meta-toggle to mean
   * the same thing in both places. `index` is the row's position in `rows`, whatever the
   * sort. */
  onRowClick?: (row: Row, index: number, event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>) => void;
  /** Marks the row that is current — the selected match, the open frame. Rendered as
   * `aria-current`, so it is announced rather than only tinted. `index` is the row's
   * position in `rows`, whatever the sort. */
  isRowActive?: (row: Row, index: number) => boolean;
  /** Pointer enter/leave, for tables kept in step with a canvas overlay.
   * `null` on leave. `index` is the row's position in `rows`, whatever the sort. */
  onRowHover?: (row: Row | null, index: number | null) => void;
  /**
   * The sort, controlled: a column `key` and a direction, or `null` for the rows' own order.
   * Leave it undefined and the table keeps the sort itself, starting from `defaultSort`.
   */
  sort?: TableSort | null | undefined;
  /** The sort the table starts with when `sort` is not given. Defaults to `null`, the rows' own order. */
  defaultSort?: TableSort | null | undefined;
  /**
   * Called on a header click with the new sort: the column's `firstSort` direction, then the
   * other, then `null`. A click on another column starts that column at its `firstSort`.
   */
  onSortChange?: ((sort: TableSort | null) => void) | undefined;
  /**
   * The app orders the rows (on a server, say): the headers show the sort and report clicks,
   * and the rows render exactly as given. Mark the columns it can sort `sortable: true`.
   */
  manualSort?: boolean | undefined;
  /**
   * Render only the rows in view, for a long table: every row `rowHeight` tall, in a scroll
   * area of `height` (or the container's height) under a sticky header. Sorting, row
   * callbacks and keyboard navigation work as without it.
   */
  windowed?: TableWindowing | undefined;
  /**
   * Activate a row as soon as the keyboard moves to it: each arrow key, Page Up / Page Down,
   * Home or End that lands on another row also calls `onRowClick` for that row, with the key
   * press as the event — selection follows focus, as in a list where the selected item shows
   * its detail beside the list. Clicks, Enter and Space work as without it. Leave it off when
   * activating a row is costly or navigates away: then a reader can move through the rows and
   * choose one. Needs `onRowClick`.
   */
  selectionFollowsFocus?: boolean | undefined;
}) {
  const density = useDensity();
  const [ownSort, setOwnSort] = useState<TableSort | null>(defaultSort);
  const controlled = controlledSort !== undefined;
  const sort = controlled ? controlledSort : ownSort;
  // Indices into `rows`, so a row keeps its own index (and key) for the callbacks below.
  const order = useMemo(
    () => (manualSort ? rows.map((_, index) => index) : sortOrder(rows, columns, sort)),
    [rows, columns, sort, manualSort],
  );

  const changeSort = (column: Column<Row>) => {
    const next = nextSort(sort, column);
    if (!controlled) setOwnSort(next);
    onSortChange?.(next);
  };

  const rowHeight = windowed?.rowHeight ?? 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLTableSectionElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  // The row to focus once it is rendered: a key press may scroll to a row that is not in the DOM yet.
  const pendingFocus = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measured, setMeasured] = useState<{ viewport: number; header: number } | null>(null);
  const viewportHeight = measured?.viewport ?? windowed?.height ?? INITIAL_ROWS * rowHeight;
  const headerHeight = measured?.header ?? 0;
  const range = windowed
    ? rowWindow({ rowCount: order.length, rowHeight, scrollTop, viewportHeight, headerHeight, overscan: windowed.overscan ?? 8 })
    : { start: 0, end: order.length, before: 0, after: 0 };

  const isWindowed = windowed !== undefined;
  // With no rows the scroll area is replaced by the `empty` message: measure the new one when
  // the rows come back, rather than keep observing the one that went away.
  const hasRows = rows.length > 0;
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!isWindowed || !hasRows || !scroller || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      // A detached element measures 0, which would shrink the window to a row or two.
      if (!scroller.isConnected) return;
      const next = { viewport: scroller.clientHeight, header: headRef.current?.offsetHeight ?? 0 };
      setMeasured((last) => (last?.viewport === next.viewport && last.header === next.header ? last : next));
    };
    measure();
    // A new scroll area starts at the top, whatever the last one was scrolled to.
    setScrollTop(scroller.scrollTop);
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [isWindowed, hasRows]);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    const row = bodyRef.current?.querySelector<HTMLElement>(`tr[data-position="${target}"]`);
    if (!row) return;
    pendingFocus.current = null;
    row.focus({ preventScroll: isWindowed });
  });

  /**
   * Moves focus from the row at `position` for a navigation key, activating the new row when
   * selection follows focus; `true` when the key was one.
   */
  const moveFocus = (event: KeyboardEvent<HTMLTableRowElement>, position: number): boolean => {
    const page = windowed ? Math.floor((viewportHeight - headerHeight) / rowHeight) : 10;
    const target = navigate(event.key, position, order.length, page);
    if (target === null) return false;
    if (selectionFollowsFocus && onRowClick && target !== position) {
      const index = order[target]!;
      onRowClick(rows[index]!, index, event);
    }
    pendingFocus.current = target;
    const scroller = scrollRef.current;
    if (windowed && scroller) {
      const top = scrollTopFor(target, { rowHeight, scrollTop: scroller.scrollTop, viewportHeight, headerHeight });
      scroller.scrollTop = top;
      // Render the target's window now rather than on the scroll event, so it can take focus.
      setScrollTop(scroller.scrollTop);
    }
    // A row already in the DOM takes focus now: when nothing scrolled, nothing re-renders, and
    // the pending focus would wait for a render that never comes.
    const row = bodyRef.current?.querySelector<HTMLElement>(`tr[data-position="${target}"]`);
    if (row) {
      pendingFocus.current = null;
      row.focus({ preventScroll: windowed !== undefined });
    }
    return true;
  };

  if (rows.length === 0) {
    return <p className={cn("text-center text-fg-muted", byDensity(density, "py-6 text-sm", "py-3 text-xs"), className)}>{empty}</p>;
  }

  const spacer = (height: number) => (
    // Stands in for the rows outside the window. Hidden: it is no row of the table.
    <tr aria-hidden="true" style={{ height }}>
      <td colSpan={columns.length} className="p-0" />
    </tr>
  );

  // A scroll area must be reachable from the keyboard: through its rows or header buttons when
  // it has them, else as a tab stop of its own.
  const scrollStop = windowed !== undefined && !onRowClick && !columns.some(isSortable);

  return (
    <div
      ref={scrollRef}
      className={cn("w-full", windowed ? scrollStop && focusRingInset : "overflow-x-auto", className)}
      // What the window arithmetic relies on is inline rather than a class, so it holds under
      // any stylesheet: the scroll area, the fixed layout, the sticky header, the row height.
      style={windowed ? { overflow: "auto", height: windowed.height ?? "100%" } : undefined}
      onScroll={windowed ? (event) => setScrollTop(event.currentTarget.scrollTop) : undefined}
      {...(scrollStop ? { tabIndex: 0, role: "region", "aria-label": caption ?? "Table" } : {})}
    >
      <table
        className={cn("w-full text-left", byDensity(density, "text-sm", "text-[11px]"))}
        style={windowed ? { tableLayout: "fixed" } : undefined}
        aria-rowcount={windowed ? order.length + 1 : undefined}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead ref={headRef}>
          <tr className="border-b border-line" aria-rowindex={windowed ? 1 : undefined}>
            {columns.map((column) => {
              const sortable = isSortable(column);
              const direction = sortable && sort?.key === column.key ? sort.direction : undefined;
              const SortIcon = SORT_ICONS[direction ?? "none"];
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={
                    windowed
                      ? { position: "sticky", top: 0, zIndex: 1, ...(column.width ? { width: column.width } : {}) }
                      : column.width
                        ? { width: column.width }
                        : undefined
                  }
                  // Only the sorted header: `aria-sort="none"` on every other one would be
                  // announced on each, and tells a reader nothing.
                  aria-sort={direction}
                  data-sort={sortable ? (direction ?? "none") : undefined}
                  className={cn(
                    // `last:pr-0`, as on the body cells: the last column's header ends where
                    // its values do, so a numeric header sits flush with its numbers.
                    "font-medium text-fg-muted last:pr-0",
                    byDensity(density, "pb-2 pr-3 text-xs", "pb-1 pr-2 text-[10px]"),
                    column.numeric && "text-right",
                    // A sticky cell leaves its row's border behind: it draws its own rule.
                    windowed && "bg-surface shadow-[inset_0_-1px_0_var(--line)]",
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => changeSort(column)}
                      className={cn(
                        // Block-level `flex`, not `inline-flex`: an inline box would sit on the
                        // cell's line box and make a sortable header row 2px taller than a plain
                        // one. The padding, cancelled by the margin, gives the focus ring room
                        // without moving the label off the column's edge.
                        "-mx-1 flex w-fit max-w-full cursor-pointer items-center gap-1 rounded-control px-1",
                        "font-medium transition-colors hover:text-fg",
                        focusRing,
                        // The arrow sits on the inner side of a right-aligned header, so the
                        // label stays flush with the numbers under it.
                        column.numeric ? "ml-auto flex-row-reverse text-right" : "text-left",
                        direction && "text-fg",
                      )}
                    >
                      {column.header}
                      <SortIcon
                        aria-hidden
                        className={cn("shrink-0", byDensity(density, "size-3", "size-2.5"), !direction && "text-fg-subtle")}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {range.before > 0 && spacer(range.before)}
          {order.slice(range.start, range.end).map((index, offset) => {
            const row = rows[index]!;
            const active = isRowActive?.(row, index) ?? false;
            const position = range.start + offset;
            return (
              <tr
                key={rowKey(row, index)}
                data-position={position}
                aria-rowindex={windowed ? position + 2 : undefined}
                style={windowed ? { height: rowHeight } : undefined}
                data-state={active ? "active" : undefined}
                className={cn(
                  // A windowed row's rule is a shadow on its cells: a collapsed border would add
                  // half a pixel to every row, and the arithmetic counts whole rows.
                  !windowed && "border-b border-line/60 last:border-0",
                  onRowClick && "cursor-pointer hover:bg-raised",
                  active && "bg-signal/10",
                )}
                tabIndex={onRowClick ? 0 : undefined}
                // Deliberately *not* `role="button"`. Overriding a `<tr>`'s implicit `row`
                // makes its `<td>`s' implicit `cell` invalid too — the cells have no row to
                // belong to — so a screen reader stops announcing the table as a table and a
                // reader loses the column each value came from, which on a table of
                // quantities is the whole content. `tabIndex` plus the Enter/Space handler
                // below is what makes the row reachable; the role stays what the element is.
                aria-current={active ? true : undefined}
                onClick={onRowClick ? (event) => onRowClick(row, index, event) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row, index, event);
                          // Navigation keys belong to a control inside the row while it has focus.
                        } else if (event.target === event.currentTarget && moveFocus(event, position)) event.preventDefault();
                      }
                    : undefined
                }
                onPointerEnter={onRowHover ? () => onRowHover(row, index) : undefined}
                onPointerLeave={onRowHover ? () => onRowHover(null, null) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "align-middle text-fg last:pr-0",
                      byDensity(density, "py-2 pr-3", "py-0.5 pr-2"),
                      column.numeric && "text-right font-mono tabular-nums",
                      windowed && "shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--line)_60%,transparent)]",
                    )}
                    // One line per row keeps every row `rowHeight` tall.
                    style={windowed ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : undefined}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {range.after > 0 && spacer(range.after)}
        </tbody>
      </table>
    </div>
  );
}
