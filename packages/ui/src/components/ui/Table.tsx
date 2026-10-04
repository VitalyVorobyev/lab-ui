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
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type ReactNode, useMemo, useState } from "react";

import { byDensity, useDensity } from "./Density";
import { cn, focusRing } from "./cn";
import { isSortable, nextSort, type SortDirection, sortOrder, type TableSort } from "./tableSort";

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
  onRowClick?: (
    row: Row,
    index: number,
    event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>,
  ) => void;
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

  if (rows.length === 0) {
    return (
      <p
        className={cn(
          "text-center text-fg-muted",
          byDensity(density, "py-6 text-sm", "py-3 text-xs"),
          className,
        )}
      >
        {empty}
      </p>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className={cn("w-full text-left", byDensity(density, "text-sm", "text-[11px]"))}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => {
              const sortable = isSortable(column);
              const direction = sortable && sort?.key === column.key ? sort.direction : undefined;
              const SortIcon = SORT_ICONS[direction ?? "none"];
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
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
                        className={cn(
                          "shrink-0",
                          byDensity(density, "size-3", "size-2.5"),
                          !direction && "text-fg-subtle",
                        )}
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
        <tbody>
          {order.map((index) => {
            const row = rows[index]!;
            const active = isRowActive?.(row, index) ?? false;
            return (
              <tr
                key={rowKey(row, index)}
                data-state={active ? "active" : undefined}
                className={cn(
                  "border-b border-line/60 last:border-0",
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
                        }
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
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
