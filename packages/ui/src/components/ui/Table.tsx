/**
 * A table.
 *
 * `numeric` is the column property that matters here. Quantities are set in mono with
 * tabular figures and aligned right, so a column of scores or measurements can be compared
 * by eye down its decimal point rather than read one row at a time.
 */

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { byDensity, useDensity } from "./Density";
import { cn } from "./cn";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  /** Right-aligned, mono, tabular. Use for anything that is a quantity. */
  numeric?: boolean;
  width?: string;
  cell: (row: Row) => ReactNode;
};

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
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string | number;
  empty?: ReactNode;
  caption?: string;
  className?: string;
  /** Makes rows activatable. Keyboard-reachable, so a table used as a list of
   * destinations is not a mouse-only control. The event is passed so a caller can read
   * modifiers — a list kept in step with a canvas needs shift-range and meta-toggle to mean
   * the same thing in both places. */
  onRowClick?: (
    row: Row,
    index: number,
    event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>,
  ) => void;
  /** Marks the row that is current — the selected match, the open frame. Rendered as
   * `aria-current`, so it is announced rather than only tinted. */
  isRowActive?: (row: Row, index: number) => boolean;
  /** Pointer enter/leave, for tables kept in step with a canvas overlay.
   * `null` on leave. */
  onRowHover?: (row: Row | null, index: number | null) => void;
}) {
  const density = useDensity();

  if (rows.length === 0) {
    return (
      <p
        className={cn(
          "text-center text-fg-muted",
          byDensity(density, "py-6 text-sm", "py-3 text-xs"),
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
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "font-medium text-fg-muted",
                  byDensity(density, "pb-2 pr-3 text-xs", "pb-1 pr-2 text-[10px]"),
                  column.numeric && "text-right",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className={cn(
                "border-b border-line/60 last:border-0",
                onRowClick && "cursor-pointer hover:bg-raised",
                isRowActive?.(row, index) && "bg-signal/10",
              )}
              tabIndex={onRowClick ? 0 : undefined}
              // Deliberately *not* `role="button"`. Overriding a `<tr>`'s implicit `row`
              // makes its `<td>`s' implicit `cell` invalid too — the cells have no row to
              // belong to — so a screen reader stops announcing the table as a table and a
              // reader loses the column each value came from, which on a table of
              // quantities is the whole content. `tabIndex` plus the Enter/Space handler
              // below is what makes the row reachable; the role stays what the element is.
              aria-current={isRowActive?.(row, index) ? true : undefined}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
