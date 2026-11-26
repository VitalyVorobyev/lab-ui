/*
 * Column groups: a header row above the column headers whose cells each span the adjacent
 * columns that share a `group` label. Pure, so the spans are tested without a DOM.
 */

/** One cell of the group header row. */
export interface ColumnGroupSpan {
  /** The label the spanned columns share, or `null` for columns with no group (an empty cell). */
  label: string | null;
  /** How many columns it spans. */
  span: number;
  /** The position of its first column. */
  start: number;
}

/**
 * The cells of the group header row.
 *
 * Adjacent columns with the same `group` label are one cell; a column with no group, and
 * adjacent such columns, are one empty cell. The same label twice with another between
 * them is two groups.
 *
 * @param columns - The columns, in order.
 * @returns The cells, left to right, spanning every column; `null` when no column has a group, so no row is drawn.
 */
export function columnGroups(columns: readonly { group?: string | undefined }[]): ColumnGroupSpan[] | null {
  if (!columns.some((column) => column.group)) return null;
  const cells: ColumnGroupSpan[] = [];
  columns.forEach((column, start) => {
    const label = column.group || null;
    const last = cells.at(-1);
    if (last && last.label === label) last.span += 1;
    else cells.push({ label, span: 1, start });
  });
  return cells;
}
