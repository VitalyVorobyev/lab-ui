/**
 * The table's semantics, which are easy to break in a way only a screen reader notices.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { type Column, Table } from "./Table";

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
    expect(onRowClick).toHaveBeenNthCalledWith(1, ROWS[0], 0, expect.objectContaining({ shiftKey: true }));

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

describe("Table sorting", () => {
  type Part = { id: string; length: number | null; name: string };

  const PARTS: Part[] = [
    { id: "a", length: 30, name: "bolt 10" },
    { id: "b", length: null, name: "bolt 9" },
    { id: "c", length: 4, name: "bolt 100" },
  ];

  const PART_COLUMNS: Column<Part>[] = [
    { key: "id", header: "Id", cell: (row) => row.id },
    { key: "name", header: "Name", cell: (row) => row.name, sortValue: (row) => row.name },
    {
      key: "length",
      header: "Length",
      numeric: true,
      cell: (row) => row.length ?? "—",
      sortValue: (row) => row.length,
      firstSort: "descending",
    },
  ];

  function renderParts(extra: Partial<ComponentProps<typeof Table<Part>>> = {}) {
    return render(<Table columns={PART_COLUMNS} rows={PARTS} rowKey={(row) => row.id} {...extra} />);
  }

  /** The ids down the body, in display order. */
  function ids(): string[] {
    return screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0]!.textContent ?? "");
  }

  const header = (name: string) => screen.getByRole("columnheader", { name });
  const button = (name: string) => screen.getByRole("button", { name });

  it("makes only the columns that can sort into buttons", () => {
    renderParts();
    expect(within(header("Id")).queryByRole("button")).toBeNull();
    expect(header("Id").hasAttribute("data-sort")).toBe(false);
    expect(within(header("Name")).getByRole("button")).toBeTruthy();
    // Sortable but unsorted: styled through `data-sort`, and no `aria-sort` to announce.
    expect(header("Name").getAttribute("data-sort")).toBe("none");
    expect(header("Name").hasAttribute("aria-sort")).toBe(false);
  });

  it("cycles a header first direction, the other, then the rows' own order", () => {
    const onSortChange = vi.fn();
    renderParts({ onSortChange });
    expect(ids()).toEqual(["a", "b", "c"]);

    fireEvent.click(button("Name"));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: "name", direction: "ascending" });
    expect(header("Name").getAttribute("aria-sort")).toBe("ascending");
    expect(header("Name").getAttribute("data-sort")).toBe("ascending");
    expect(ids()).toEqual(["b", "a", "c"]); // bolt 9, bolt 10, bolt 100

    fireEvent.click(button("Name"));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: "name", direction: "descending" });
    expect(header("Name").getAttribute("aria-sort")).toBe("descending");
    expect(ids()).toEqual(["c", "a", "b"]);

    fireEvent.click(button("Name"));
    expect(onSortChange).toHaveBeenLastCalledWith(null);
    expect(header("Name").hasAttribute("aria-sort")).toBe(false);
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("starts a column at its `firstSort`, keeps missing values last, and marks one header", () => {
    renderParts();
    fireEvent.click(button("Name"));
    fireEvent.click(button("Length"));
    expect(header("Length").getAttribute("aria-sort")).toBe("descending");
    expect(header("Name").hasAttribute("aria-sort")).toBe(false);
    expect(ids()).toEqual(["a", "c", "b"]);

    fireEvent.click(button("Length"));
    expect(header("Length").getAttribute("aria-sort")).toBe("ascending");
    expect(ids()).toEqual(["c", "a", "b"]);
  });

  it("starts from `defaultSort` when it keeps the sort itself", () => {
    renderParts({ defaultSort: { key: "length", direction: "ascending" } });
    expect(header("Length").getAttribute("aria-sort")).toBe("ascending");
    expect(ids()).toEqual(["c", "a", "b"]);
    // The second direction of this column: the next click clears it.
    fireEvent.click(button("Length"));
    expect(header("Length").hasAttribute("aria-sort")).toBe(false);
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("follows `sort` when controlled, and only reports clicks", () => {
    const onSortChange = vi.fn();
    const { rerender } = renderParts({ sort: { key: "name", direction: "descending" }, onSortChange });
    expect(ids()).toEqual(["c", "a", "b"]);

    fireEvent.click(button("Length"));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: "length", direction: "descending" });
    // Not applied until the owner passes it back.
    expect(header("Name").getAttribute("aria-sort")).toBe("descending");
    expect(ids()).toEqual(["c", "a", "b"]);

    rerender(
      <Table
        columns={PART_COLUMNS}
        rows={PARTS}
        rowKey={(row) => row.id}
        sort={{ key: "length", direction: "descending" }}
        onSortChange={onSortChange}
      />,
    );
    expect(header("Length").getAttribute("aria-sort")).toBe("descending");
    expect(ids()).toEqual(["a", "c", "b"]);

    // `null` is a controlled value too: the rows' own order, whatever was clicked.
    rerender(
      <Table columns={PART_COLUMNS} rows={PARTS} rowKey={(row) => row.id} sort={null} onSortChange={onSortChange} />,
    );
    fireEvent.click(button("Name"));
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("passes each row's index in `rows` to the callbacks, whatever the order", () => {
    const onRowClick = vi.fn();
    const onRowHover = vi.fn();
    const rowKey = vi.fn((row: Part) => row.id);
    render(
      <Table
        columns={PART_COLUMNS}
        rows={PARTS}
        rowKey={rowKey}
        defaultSort={{ key: "length", direction: "descending" }}
        onRowClick={onRowClick}
        onRowHover={onRowHover}
        isRowActive={(_, index) => index === 2}
      />,
    );
    expect(ids()).toEqual(["a", "c", "b"]);
    const body = screen.getAllByRole("row").slice(1);

    fireEvent.click(body[1]!);
    expect(onRowClick).toHaveBeenLastCalledWith(PARTS[2], 2, expect.anything());
    fireEvent.keyDown(body[2]!, { key: " " });
    expect(onRowClick).toHaveBeenLastCalledWith(PARTS[1], 1, expect.anything());
    fireEvent.pointerEnter(body[0]!);
    expect(onRowHover).toHaveBeenLastCalledWith(PARTS[0], 0);
    expect(body[1]!.getAttribute("aria-current")).toBe("true");
    expect(rowKey).toHaveBeenCalledWith(PARTS[2], 2);
  });

  it("renders rows as given with `manualSort`, while the headers show the sort", () => {
    const onSortChange = vi.fn();
    renderParts({ manualSort: true, onSortChange });
    fireEvent.click(button("Length"));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: "length", direction: "descending" });
    expect(header("Length").getAttribute("aria-sort")).toBe("descending");
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("sorts by `sortable: true` alone with `manualSort`", () => {
    const columns: Column<Part>[] = [{ key: "id", header: "Id", cell: (row) => row.id, sortable: true }];
    render(<Table columns={columns} rows={PARTS} rowKey={(row) => row.id} manualSort />);
    fireEvent.click(button("Id"));
    expect(header("Id").getAttribute("aria-sort")).toBe("ascending");
  });

  it("ignores a sort that names no sortable column", () => {
    renderParts({ sort: { key: "id", direction: "descending" } });
    expect(screen.getAllByRole("columnheader").some((th) => th.hasAttribute("aria-sort"))).toBe(false);
    expect(ids()).toEqual(["a", "b", "c"]);
  });
});
