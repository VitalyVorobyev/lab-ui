import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SequenceMatrix, type SequenceMatrixSelection } from "./SequenceMatrix";

const ROWS = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, label: `view ${i}` }));
const COLS = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, label: `cam ${i}` }));

function matrix(props: Partial<React.ComponentProps<typeof SequenceMatrix>> = {}) {
  return render(
    <SequenceMatrix
      aria-label="Detections"
      rows={ROWS}
      columns={COLS}
      windowed={false}
      renderCell={(row, col, state) => (
        <span data-testid={`${row.id}-${col.id}`} data-state={`${state.focused ? "f" : ""}${state.selected ? "s" : ""}`}>
          {row.id}/{col.id}
        </span>
      )}
      {...props}
    />,
  );
}

const cell = (r: number, c: number, root: HTMLElement) => root.querySelector<HTMLElement>(`[data-cell][data-r="${r}"][data-c="${c}"]`)!;
const selected = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-cell][data-selected]")].map(
    (el) => `${(el as HTMLElement).dataset["r"]},${(el as HTMLElement).dataset["c"]}`,
  );

describe("SequenceMatrix roles", () => {
  it("is a grid with the headers counted, row and column indices, and named headers", () => {
    const { container } = matrix();
    const grid = screen.getByRole("grid", { name: "Detections" });
    expect(grid.getAttribute("aria-rowcount")).toBe("7");
    expect(grid.getAttribute("aria-colcount")).toBe("5");
    expect(grid.getAttribute("aria-multiselectable")).toBe("true");
    expect(screen.getAllByRole("row")).toHaveLength(7);
    expect(screen.getByRole("columnheader", { name: "cam 2" }).getAttribute("aria-colindex")).toBe("4");
    expect(screen.getByRole("rowheader", { name: "view 3" }).closest("[role=row]")?.getAttribute("aria-rowindex")).toBe("5");
    expect(container.querySelectorAll("[role=gridcell]")).toHaveLength(24);
  });

  it("makes exactly one cell tabbable: the first, then the selection's anchor", () => {
    const first = matrix();
    expect(first.container.querySelectorAll("[data-cell][tabindex='0']")).toHaveLength(1);
    expect(cell(0, 0, first.container).tabIndex).toBe(0);
    first.unmount();
    const second = matrix({ defaultValue: { row: "v2", col: "c3" } });
    expect(cell(2, 3, second.container).tabIndex).toBe(0);
    expect(cell(0, 0, second.container).tabIndex).toBe(-1);
  });

  it("names a cell from cellLabel and names a non-text header from `name`", () => {
    matrix({
      cellLabel: (row, col) => `${row.id} ${col.id} found`,
      rows: [{ id: "a", label: <b>A</b>, name: "view A" }],
      columns: [{ id: "x", label: <i>X</i> }],
    });
    expect(screen.getByRole("gridcell", { name: "a x found" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "view A" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "x" })).toBeTruthy();
  });
});

describe("SequenceMatrix windowing", () => {
  it("renders a window of a large matrix, not every cell, and keeps the focused cell mounted", () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ id: `r${i}`, label: String(i) }));
    const columns = Array.from({ length: 40 }, (_, i) => ({ id: `k${i}`, label: String(i) }));
    const { container } = render(<SequenceMatrix aria-label="Big" rows={rows} columns={columns} renderCell={() => "x"} />);
    const count = container.querySelectorAll("[role=gridcell]").length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(500 * 40 * 0.05);
    expect(container.querySelector("[aria-rowindex='501']")).toBeNull();
    // End of the grid: the cursor goes there and its cell is rendered although it is far outside the window.
    fireEvent.keyDown(cell(0, 0, container), { key: "End", ctrlKey: true });
    expect(cell(499, 39, container)).toBeTruthy();
    expect(cell(499, 39, container).tabIndex).toBe(0);
  });

  it("renders everything when not windowed", () => {
    const { container } = matrix();
    expect(container.querySelectorAll("[role=gridcell]")).toHaveLength(24);
  });

  it("copes with no rows or no columns", () => {
    const { container } = matrix({ rows: [] });
    expect(container.querySelectorAll("[role=gridcell]")).toHaveLength(0);
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
  });
});

describe("SequenceMatrix keyboard", () => {
  it("moves the cursor with the arrows, Home, End and Ctrl + corners, and stops at the edges", () => {
    const { container } = matrix();
    const start = cell(0, 0, container);
    start.focus();
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(cell(0, 1, container).tabIndex).toBe(0);
    expect(document.activeElement).toBe(cell(0, 1, container));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(cell(1, 1, container));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(cell(1, 3, container));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell(1, 3, container));
    fireEvent.keyDown(document.activeElement!, { key: "Home", ctrlKey: true });
    expect(document.activeElement).toBe(cell(0, 0, container));
    fireEvent.keyDown(document.activeElement!, { key: "End", ctrlKey: true });
    expect(document.activeElement).toBe(cell(5, 3, container));
    // A page is a screenful less one row, and at least one row (the jsdom scroller has no height).
    fireEvent.keyDown(document.activeElement!, { key: "PageUp" });
    expect(document.activeElement).toBe(cell(4, 3, container));
  });

  it("selects on Space and Enter, and Enter reports the action", () => {
    const change = vi.fn();
    const action = vi.fn();
    const { container } = matrix({ onValueChange: change, onCellAction: action });
    const target = cell(2, 1, container);
    target.focus();
    fireEvent.keyDown(target, { key: " " });
    expect(change).toHaveBeenLastCalledWith({ row: "v2", col: "c1" });
    expect(selected(container)).toEqual(["2,1"]);
    fireEvent.keyDown(target, { key: "Enter" });
    expect(action).toHaveBeenCalledWith("v2", "c1");
    fireEvent.doubleClick(cell(3, 3, container));
    expect(action).toHaveBeenLastCalledWith("v3", "c3");
  });

  it("does not select on a move unless selection follows focus", () => {
    const change = vi.fn();
    const quiet = matrix({ onValueChange: change });
    fireEvent.keyDown(cell(0, 0, quiet.container), { key: "ArrowDown" });
    expect(change).not.toHaveBeenCalled();
    quiet.unmount();
    const follow = matrix({ onValueChange: change, selectionFollowsFocus: true });
    fireEvent.keyDown(cell(0, 0, follow.container), { key: "ArrowDown" });
    expect(change).toHaveBeenLastCalledWith({ row: "v1", col: "c0" });
  });

  it("extends a rectangle from the anchor with Shift, and selects a row, a column and all", () => {
    const change = vi.fn();
    const { container } = matrix({ onValueChange: change, defaultValue: { row: "v1", col: "c1" } });
    cell(1, 1, container).focus();
    fireEvent.keyDown(cell(1, 1, container), { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight", shiftKey: true });
    expect(change).toHaveBeenLastCalledWith({ row: "v1", col: "c1", rowTo: "v2", colTo: "c2" });
    expect(selected(container)).toEqual(["1,1", "1,2", "2,1", "2,2"]);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft", shiftKey: true });
    // The anchor stays (1, 1); the head went to (0, 0).
    expect(selected(container)).toEqual(["0,0", "0,1", "1,0", "1,1"]);

    fireEvent.keyDown(document.activeElement!, { key: " ", shiftKey: true });
    expect(change).toHaveBeenLastCalledWith({ row: "v0", col: "c0", rowTo: "v0", colTo: "c3" });
    fireEvent.keyDown(document.activeElement!, { key: " ", ctrlKey: true });
    expect(change).toHaveBeenLastCalledWith({ row: "v0", col: "c0", rowTo: "v5", colTo: "c0" });
    fireEvent.keyDown(document.activeElement!, { key: "a", ctrlKey: true });
    expect(change).toHaveBeenLastCalledWith({ row: "v0", col: "c0", rowTo: "v5", colTo: "c3" });
    expect(selected(container)).toHaveLength(24);
  });

  it("keeps selection to one cell when multiple is off", () => {
    const change = vi.fn();
    const { container } = matrix({ onValueChange: change, multiple: false });
    cell(0, 0, container).focus();
    fireEvent.keyDown(cell(0, 0, container), { key: "ArrowDown", shiftKey: true });
    // Shift only moves; there is no range to extend.
    expect(document.activeElement).toBe(cell(1, 0, container));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(cell(2, 2, container), { shiftKey: true });
    expect(change).toHaveBeenLastCalledWith({ row: "v2", col: "c2" });
    fireEvent.click(screen.getByRole("rowheader", { name: "view 2" }));
    fireEvent.keyDown(cell(2, 2, container), { key: "a", ctrlKey: true });
    expect(change).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[aria-multiselectable]")).toBeNull();
  });

  it("leaves a key typed into something inside a cell alone", () => {
    const change = vi.fn();
    const { container } = matrix({
      onValueChange: change,
      renderCell: () => <input aria-label="note" />,
    });
    const input = container.querySelector("input")!;
    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(input, { key: " " });
    expect(change).not.toHaveBeenCalled();
  });
});

describe("SequenceMatrix pointer and selection", () => {
  it("selects a clicked cell and extends with Shift + click", () => {
    const change = vi.fn();
    const { container } = matrix({ onValueChange: change });
    fireEvent.click(cell(1, 1, container));
    expect(change).toHaveBeenLastCalledWith({ row: "v1", col: "c1" });
    fireEvent.click(cell(3, 2, container), { shiftKey: true });
    expect(change).toHaveBeenLastCalledWith({ row: "v1", col: "c1", rowTo: "v3", colTo: "c2" });
    expect(selected(container)).toHaveLength(6);
  });

  it("selects the whole row or column of a clicked header, and marks the header selected", () => {
    const change = vi.fn();
    const { container } = matrix({ onValueChange: change });
    fireEvent.click(screen.getByRole("rowheader", { name: "view 2" }));
    expect(change).toHaveBeenLastCalledWith({ row: "v2", col: "c0", rowTo: "v2", colTo: "c3" });
    expect(screen.getByRole("rowheader", { name: "view 2" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("columnheader", { name: "cam 1" }));
    expect(change).toHaveBeenLastCalledWith({ row: "v0", col: "c1", rowTo: "v5", colTo: "c1" });
    expect(selected(container)).toHaveLength(6);
  });

  it("does not select the row when a button in its header is clicked", () => {
    const change = vi.fn();
    const menu = vi.fn();
    matrix({
      onValueChange: change,
      renderRowHeader: (row) => (
        <button type="button" onClick={menu}>
          {row.id} menu
        </button>
      ),
    });
    fireEvent.click(screen.getByRole("button", { name: "v1 menu" }));
    expect(menu).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
  });

  it("is controlled when given a value, and tells the renderer what is focused and selected", () => {
    function Harness() {
      const [value, setValue] = useState<SequenceMatrixSelection | null>({ row: "v0", col: "c0" });
      return (
        <>
          <button type="button" onClick={() => setValue(null)}>
            clear
          </button>
          <SequenceMatrix
            aria-label="M"
            rows={ROWS}
            columns={COLS}
            windowed={false}
            value={value}
            onValueChange={setValue}
            renderCell={(row, col, state) => (
              <span data-testid={`${row.id}-${col.id}`}>{state.selected ? "S" : state.focused ? "F" : "."}</span>
            )}
          />
        </>
      );
    }
    const { container } = render(<Harness />);
    expect(screen.getByTestId("v0-c0").textContent).toBe("S");
    fireEvent.click(cell(2, 1, container));
    expect(screen.getByTestId("v2-c1").textContent).toBe("S");
    expect(screen.getByTestId("v0-c0").textContent).toBe(".");
    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    expect(container.querySelector("[data-cell][data-selected]")).toBeNull();
  });

  it("drops a selection that names a row or column that is gone, without throwing", () => {
    const { container } = matrix({ value: { row: "missing", col: "c0" } });
    expect(selected(container)).toEqual([]);
    expect(cell(0, 0, container).tabIndex).toBe(0);
  });

  it("reports focus to the renderer while the grid has it", () => {
    const { container } = matrix();
    expect(container.querySelector("[data-focused]")).toBeNull();
    act(() => cell(1, 2, container).focus());
    expect(container.querySelector("[data-focused]")).toBe(cell(1, 2, container));
    expect(screen.getByTestId("v1-c2").dataset["state"]).toBe("f");
    act(() => cell(1, 2, container).blur());
    expect(container.querySelector("[data-focused]")).toBeNull();
  });
});
