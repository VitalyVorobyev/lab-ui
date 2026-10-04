/*
 * The order of a sorted `Table`, as pure functions so it is tested without a DOM, and so an app
 * can reproduce the table's order (next/previous navigation, an export, a server that sorts the
 * same way) with `sortRows`.
 *
 * The order is deterministic across machines: strings go through one collator with a fixed
 * locale, so a server render and the browser that hydrates it put the rows in the same order.
 * A `Collator` is not DOM, so building it once at module scope keeps the package SSR-safe.
 */

import type { Column } from "./Table";

/** Which way a column is sorted. Named as `aria-sort` names them: `"ascending"` puts the smallest first. */
export type SortDirection = "ascending" | "descending";

/** The column a table is sorted by, and which way. Where a sort is expected, `null` means the rows' own order. */
export interface TableSort {
  /** The sorted column's `key`. */
  key: string;
  /** Which way. */
  direction: SortDirection;
}

/** The column fields that decide the order. */
type SortColumn<Row> = Pick<Column<Row>, "key" | "sortable" | "sortValue" | "compare">;

/** Strings by a fixed English collation that reads digit runs as numbers: "frame 9" before "frame 10". */
const collator = new Intl.Collator("en", { numeric: true });

/**
 * Whether a column's header sorts the table: `sortable` if given, otherwise whether the column
 * says how to order (`sortValue` or `compare`).
 */
export function isSortable<Row>(column: Pick<Column<Row>, "sortable" | "sortValue" | "compare">): boolean {
  return column.sortable ?? (column.sortValue !== undefined || column.compare !== undefined);
}

/** The sort after a click on `column`'s header: its first direction, then the other, then none. */
export function nextSort<Row>(
  current: TableSort | null,
  column: Pick<Column<Row>, "key" | "firstSort">,
): TableSort | null {
  const first = column.firstSort ?? "ascending";
  if (current?.key !== column.key) return { key: column.key, direction: first };
  if (current.direction !== first) return null;
  return { key: column.key, direction: first === "ascending" ? "descending" : "ascending" };
}

/** A value with no place in the order: `null`, `undefined` or `NaN`. */
function missing(value: number | string | null | undefined): boolean {
  return value === null || value === undefined || Number.isNaN(value);
}

/**
 * Two present values in ascending order: numbers by value (compared, not subtracted, so two
 * infinities tie), strings by the collator, and every number before every string.
 */
function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
  return typeof a === "number" ? -1 : 1;
}

/**
 * The display order of `rows` under `sort`, as indices into `rows`. `Table` renders through it
 * so each row keeps its original index for the row callbacks.
 */
export function sortOrder<Row>(
  rows: readonly Row[],
  columns: readonly SortColumn<Row>[],
  sort: TableSort | null | undefined,
): number[] {
  const order = rows.map((_, index) => index);
  if (!sort) return order;
  const column = columns.find((candidate) => candidate.key === sort.key);
  if (!column || !isSortable(column)) return order;
  const sign = sort.direction === "descending" ? -1 : 1;

  // Every comparison falls back to the original index, so equal rows keep their order in both
  // directions: descending is not ascending reversed, it is ascending with each run of ties kept.
  const { compare, sortValue } = column;
  if (compare) return order.sort((a, b) => sign * compare(rows[a]!, rows[b]!) || a - b);
  if (!sortValue) return order;

  // One call per row, not two per comparison: a `sortValue` may parse or look something up.
  const values = rows.map((row) => sortValue(row));
  return order.sort((a, b) => {
    const left = values[a];
    const right = values[b];
    const leftMissing = missing(left);
    const rightMissing = missing(right);
    // Missing values go last whichever way the column is sorted: a reader sorting by score in
    // either direction wants the rows that have one.
    if (leftMissing || rightMissing) return leftMissing === rightMissing ? a - b : leftMissing ? 1 : -1;
    return sign * compareValues(left!, right!) || a - b;
  });
}

/**
 * The rows in the order a `Table` with these columns shows them under `sort`.
 *
 * The sort is stable in both directions: rows that compare equal keep their order in `rows`.
 * With the column's `compare`, that function decides (reversed for `"descending"`). With its
 * `sortValue`, numbers compare by value and strings by a fixed English collation that reads
 * digit runs as numbers ("frame 9" before "frame 10"), the same on a server as in any
 * browser; numbers come before strings; and `null`, `undefined` and `NaN` go last in both
 * directions. A `null` sort, a `key` that names no column, and a column that is not sortable or
 * has neither function leave the order as given.
 *
 * @param rows - The rows, in their own order. Not modified.
 * @param columns - The table's columns; only `key`, `sortable`, `sortValue` and `compare` are read.
 * @param sort - The column and direction, or `null` for the rows' own order.
 * @returns A new array of the same rows, sorted.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  columns: readonly Pick<Column<Row>, "key" | "sortable" | "sortValue" | "compare">[],
  sort: TableSort | null | undefined,
): Row[] {
  return sortOrder(rows, columns, sort).map((index) => rows[index]!);
}
