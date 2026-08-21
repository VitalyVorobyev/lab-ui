/**
 * The table's semantics, which are easy to break in a way only a screen reader notices.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Table } from "./Table";

const ROWS = [
  { id: 1, length: 300 },
  { id: 0, length: 30 },
];

const COLUMNS = [
  { key: "id", header: "#", cell: (row: (typeof ROWS)[number]) => row.id },
  { key: "len", header: "len", numeric: true, cell: (row: (typeof ROWS)[number]) => row.length },
];

function renderTable(extra: Partial<Parameters<typeof Table<(typeof ROWS)[number]>>[0]> = {}) {
  return render(
    <Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} {...extra} />,
  );
}

describe("Table", () => {
  it("keeps rows as rows even when they are activatable", () => {
    renderTable({ onRowClick: () => {} });
    // A `role="button"` here would take the `<td>`s' `cell` role with it, and a reader would
    // lose the column each quantity belongs to.
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); // header + two
    expect(within(rows[1]!).getAllByRole("cell")).toHaveLength(2);
  });

  it("activates by click and by keyboard, and reports the event", () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });

    const rows = screen.getAllByRole("row");
    fireEvent.click(rows[1]!, { shiftKey: true });
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]![0]).toEqual(ROWS[0]);
    expect(onRowClick.mock.calls[0]![1]).toBe(0);
    expect(onRowClick.mock.calls[0]![2].shiftKey).toBe(true);

    fireEvent.keyDown(rows[2]!, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick.mock.calls[1]![1]).toBe(1);
  });

  it("announces the current row rather than only tinting it", () => {
    renderTable({ onRowClick: () => {}, isRowActive: (row) => row.id === 0 });
    const rows = screen.getAllByRole("row");
    expect(rows[1]!.getAttribute("aria-current")).toBeNull();
    expect(rows[2]!.getAttribute("aria-current")).toBe("true");
  });

  it("reports hover in both directions, for a table kept in step with a canvas", () => {
    const onRowHover = vi.fn();
    renderTable({ onRowHover });
    const rows = screen.getAllByRole("row");
    fireEvent.pointerEnter(rows[1]!);
    expect(onRowHover).toHaveBeenLastCalledWith(ROWS[0], 0);
    fireEvent.pointerLeave(rows[1]!);
    expect(onRowHover).toHaveBeenLastCalledWith(null, null);
  });

  it("says so when there is nothing to show", () => {
    render(<Table columns={COLUMNS} rows={[]} rowKey={(row) => row.id} empty="No contours." />);
    expect(screen.getByText("No contours.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
