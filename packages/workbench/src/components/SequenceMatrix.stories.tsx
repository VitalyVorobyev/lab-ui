import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { StatusDot, type Tone } from "@vitavision/ui";

import {
  SequenceMatrix,
  type SequenceMatrixColumn,
  type SequenceMatrixProps,
  type SequenceMatrixRow,
  type SequenceMatrixSelection,
} from "./SequenceMatrix";

const CAMERAS = 10;
const VIEWS = 300;

const ROWS = Array.from({ length: VIEWS }, (_, i) => ({ id: `v${i}`, label: `view ${String(i + 1).padStart(3, "0")}` }));
const COLUMNS = Array.from({ length: CAMERAS }, (_, i) => ({ id: `c${i}`, label: `cam ${i}`, name: `cam ${i}` }));

/** Detected corners of a cell: a deterministic pattern with some partial boards and some misses. */
function corners(row: number, col: number): number {
  const h = (row * 7919 + col * 104729) % 97;
  if (h < 4) return 0;
  if (h < 12) return 12 + (h % 20);
  return 48;
}
const toneOf = (n: number): Tone | null => (n === 0 ? "defect" : n < 48 ? "warning" : null);

/** The cell a dataset overview draws: the count in mono and a dot when it is not the full board. */
function renderCount(row: SequenceMatrixRow, col: SequenceMatrixColumn) {
  const n = corners(Number(row.id.slice(1)), Number(col.id.slice(1)));
  const tone = toneOf(n);
  return (
    <div className="flex h-full items-center justify-center gap-1 font-mono text-xs tabular-nums">
      {n}
      {tone && <StatusDot tone={tone} />}
    </div>
  );
}

const cellLabel = (row: SequenceMatrixRow, col: SequenceMatrixColumn) =>
  `${row.id}, ${col.id}: ${corners(Number(row.id.slice(1)), Number(col.id.slice(1)))} corners`;

const change = fn();
const action = fn();

function Stateful(args: SequenceMatrixProps) {
  const [value, setValue] = useState<SequenceMatrixSelection | null>(args.value ?? null);
  return (
    <div className="flex flex-col gap-2">
      <SequenceMatrix
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          change(next);
        }}
        onCellAction={(r, c) => {
          action(r, c);
        }}
        style={{ width: 640, height: 360 }}
      />
      <p data-testid="selection" className="font-mono text-xs text-fg-muted">
        {value ? `${value.row}/${value.col}${value.rowTo ? ` to ${value.rowTo}/${value.colTo}` : ""}` : "none"}
      </p>
    </div>
  );
}

const meta = {
  title: "workbench/SequenceMatrix",
  component: SequenceMatrix,
  parameters: {
    docs: {
      description: {
        component: `A rows-by-columns grid of captures: views down, cameras across, one cell each, for the overview of a dataset or a
detection run. The caller draws each cell (a thumbnail, a count, a state) with \`renderCell\`; the matrix owns the geometry, the
sticky row and column headers, the keyboard, the selection and the grid roles.

- **Windowed in both axes:** only the cells in view, plus \`overscan\`, plus the focused cell, are in the DOM, so ten cameras by
  three hundred views is a few dozen cells. Row height (\`rowHeight\`) and column width (\`colWidth\`) are uniform. Give the matrix a
  height and a width through \`className\`: it scrolls inside its box. \`windowed={false}\` renders every cell, for a small matrix.
- **Selection:** a cell, or a rectangle, controlled with \`value\` / \`onValueChange\` (\`{ row, col }\`, plus \`rowTo\`, \`colTo\` for a
  range, by id) or not (\`defaultValue\`). A click on a row or column header selects that whole row or column. \`multiple={false}\` keeps it to one cell.
- **Actions:** Enter and a double click call \`onCellAction(rowId, columnId)\`: open the cell's frame.
- **Headers:** \`renderRowHeader\` and \`renderColumnHeader\` draw them (a menu button, a counter). A button in a header handles its own click.
- **Hover:** there is no per-cell listener, so hover is CSS only; the cell's \`data-selected\` and \`data-focused\` attributes and the
  \`state\` argument carry the rest.

**Use** it where a cell has its own focus and meaning: which camera saw which view, what was found in each. **Don't** use it for a
list with columns of fields (that is \`Table\`) or a single strip of frames (that is \`SequenceNavigator\`).

**Keyboard:** the grid is one Tab stop; the focused cell is the one in the tab order.

| Key | Does |
|---|---|
| Arrows | move one cell; stop at the edges |
| Home, End | first and last column of the row |
| Ctrl + Home, Ctrl + End | first and last cell |
| PageUp, PageDown | one screenful of rows |
| Space, Enter | select the cell (Enter also calls \`onCellAction\`) |
| Shift + a move, Shift + click | extend the selection to a rectangle from its anchor |
| Shift + Space, Ctrl + Space | select the focused row, column |
| Ctrl + A | select everything |

**Accessibility**: \`role="grid"\` named by \`aria-label\`, with \`aria-rowcount\` and \`aria-colcount\` counting the headers, \`aria-rowindex\`
and \`aria-colindex\` on every rendered row and cell (so a screen reader knows where a windowed cell is), \`columnheader\` and
\`rowheader\` cells, and \`aria-selected\` on selected cells and on a header whose whole row or column is selected. A cell takes its name from
its content; for a thumbnail or a symbol give \`cellLabel\`. Keys typed into an input inside a cell are left alone.`,
      },
    },
  },
  args: {
    "aria-label": "Detections by view and camera",
    rows: ROWS,
    columns: COLUMNS,
    renderCell: renderCount,
    cellLabel,
    corner: "view",
  },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof SequenceMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

const grid = (root: HTMLElement) => root.querySelector<HTMLElement>("[role=grid]")!;
const cellAt = (root: HTMLElement, r: number, c: number) => root.querySelector<HTMLElement>(`[data-cell][data-r="${r}"][data-c="${c}"]`);

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("grid", { name: "Detections by view and camera" })).toBeInTheDocument();
    await expect(grid(canvasElement).getAttribute("aria-rowcount")).toBe(String(VIEWS + 1));
    await expect(grid(canvasElement).getAttribute("aria-colcount")).toBe(String(CAMERAS + 1));
    await expect(canvas.getByRole("columnheader", { name: "cam 0" })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "view 001" })).toBeVisible();
  },
};

/** Three thousand cells, a few dozen in the DOM; the rest appear as the grid scrolls. */
export const Windowed: Story = {
  play: async ({ canvasElement }) => {
    const el = grid(canvasElement);
    const total = VIEWS * CAMERAS;
    const mounted = () => canvasElement.querySelectorAll("[role=gridcell]").length;
    await expect(mounted()).toBeLessThan(total / 10);
    await expect(canvasElement.querySelector("[aria-rowindex='302']")).toBeNull();
    el.scrollTop = 36 * 200;
    await waitFor(() => expect(canvasElement.querySelector("[role=rowheader][aria-label='view 201']")).not.toBeNull());
    await expect(mounted()).toBeLessThan(total / 10);
    // The rows left behind are gone (the first row stays: it holds the grid's tab stop), and the headers stayed put.
    await expect(canvasElement.querySelector("[role=rowheader][aria-label='view 050']")).toBeNull();
    await expect(canvasElement.querySelector("[data-cell][data-r='0'][tabindex='0']")).not.toBeNull();
    const top = el.getBoundingClientRect().top;
    const header = canvasElement.querySelector("[role=columnheader][aria-label='cam 0']")!.getBoundingClientRect();
    await expect(Math.abs(header.top - top)).toBeLessThan(3);
  },
};

/** The corners of the grid in a few keys: Ctrl + End brings the last cell into view, mounted and focused. */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const first = cellAt(canvasElement, 0, 0)!;
    first.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    await expect(document.activeElement).toBe(cellAt(canvasElement, 2, 1));
    await userEvent.keyboard("{End}");
    await expect(document.activeElement).toBe(cellAt(canvasElement, 2, CAMERAS - 1));
    await userEvent.keyboard("{PageDown}");
    const el = grid(canvasElement);
    const page = Math.floor((el.clientHeight - 32) / 36) - 1;
    await expect((document.activeElement as HTMLElement).dataset["r"]).toBe(String(2 + page));
    await userEvent.keyboard("{Control>}{End}{/Control}");
    await waitFor(() => expect(document.activeElement).toBe(cellAt(canvasElement, VIEWS - 1, CAMERAS - 1)));
    await expect(el.scrollTop).toBeGreaterThan(36 * (VIEWS - 20));
    // The focused cell is fully inside the body area, below the sticky header.
    const cell = (document.activeElement as HTMLElement).getBoundingClientRect();
    await expect(cell.top).toBeGreaterThanOrEqual(el.getBoundingClientRect().top + 32 - 1);
    await userEvent.keyboard("{Control>}{Home}{/Control}");
    await waitFor(() => expect(document.activeElement).toBe(cellAt(canvasElement, 0, 0)));
    await expect(el.scrollTop).toBe(0);
    await expect(el.scrollLeft).toBe(0);
  },
};

/** Tab enters the grid once, at the first cell, and leaves it in one more Tab. */
export const OneTabStop: Story = {
  render: (args) => (
    <div>
      <button type="button">before</button>
      <Stateful {...args} />
      <button type="button">after</button>
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    canvas.getByRole("button", { name: "before" }).focus();
    await userEvent.tab();
    await expect(document.activeElement).toBe(cellAt(canvasElement, 0, 0));
    await userEvent.tab();
    await expect(document.activeElement).toBe(canvas.getByRole("button", { name: "after" }));
    await userEvent.tab({ shift: true });
    await expect(document.activeElement).toBe(cellAt(canvasElement, 0, 0));
  },
};

/** Space or Enter selects; Enter also opens. A move alone does not select. */
export const SelectAndOpen: Story = {
  play: async ({ canvas, canvasElement }) => {
    change.mockClear();
    action.mockClear();
    cellAt(canvasElement, 0, 0)!.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowRight}");
    await expect(change).not.toHaveBeenCalled();
    await userEvent.keyboard(" ");
    await expect(change).toHaveBeenLastCalledWith({ row: "v1", col: "c1" });
    await expect(canvas.getByTestId("selection").textContent).toBe("v1/c1");
    await userEvent.keyboard("{Enter}");
    await expect(action).toHaveBeenLastCalledWith("v1", "c1");
    await userEvent.dblClick(cellAt(canvasElement, 3, 2)!);
    await expect(action).toHaveBeenLastCalledWith("v3", "c2");
  },
};

/** Shift + a move or a click extends a rectangle; a header click takes the whole row or column. */
export const RangeSelection: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(cellAt(canvasElement, 1, 1)!);
    await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{ArrowRight}{/Shift}");
    await expect(canvas.getByTestId("selection").textContent).toBe("v1/c1 to v3/c2");
    await expect(canvasElement.querySelectorAll("[data-cell][data-selected]")).toHaveLength(6);
    await userEvent.click(cellAt(canvasElement, 5, 4)!, { shiftKey: true } as never);
    await userEvent.click(canvas.getByRole("rowheader", { name: "view 004" }));
    await expect(canvas.getByTestId("selection").textContent).toBe(`v3/c0 to v3/c${CAMERAS - 1}`);
    await expect(canvasElement.querySelectorAll("[data-cell][data-selected]")).toHaveLength(CAMERAS);
    await expect(canvas.getByRole("rowheader", { name: "view 004" }).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(canvas.getByRole("columnheader", { name: "cam 2" }));
    await expect(canvas.getByTestId("selection").textContent).toBe(`v0/c2 to v${VIEWS - 1}/c2`);
  },
};

/** A small matrix, not windowed, with a menu button in each column header. */
export const SmallWithHeaderActions: Story = {
  args: {
    rows: ROWS.slice(0, 8),
    columns: COLUMNS.slice(0, 4),
    windowed: false,
    colWidth: 88,
    renderColumnHeader: (column) => (
      <button
        type="button"
        className="rounded-control px-1 hover:bg-line"
        onClick={() => {
          action("menu", column.id);
        }}
      >
        {column.name ?? column.id} ▾
      </button>
    ),
  },
  play: async ({ canvas, canvasElement }) => {
    action.mockClear();
    change.mockClear();
    await expect(canvasElement.querySelectorAll("[role=gridcell]")).toHaveLength(32);
    await userEvent.click(canvas.getByRole("button", { name: "cam 1 ▾" }));
    await expect(action).toHaveBeenCalledWith("menu", "c1");
    await expect(change).not.toHaveBeenCalled();
  },
};

/** A selection already made, a cell that is focused and one that is not: both read without colour alone. */
export const InitialSelection: Story = {
  args: { value: { row: "v2", col: "c1", rowTo: "v3", colTo: "c2" } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-cell][data-selected]")).toHaveLength(4);
    await expect(canvasElement.querySelectorAll("[role=gridcell][aria-selected='true']")).toHaveLength(4);
    await expect(cellAt(canvasElement, 2, 1)!.tabIndex).toBe(0);
  },
};

export const SingleCellSelectionOnly: Story = {
  args: { multiple: false, rows: ROWS.slice(0, 12), columns: COLUMNS.slice(0, 5) },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(cellAt(canvasElement, 1, 1)!);
    await userEvent.click(canvas.getByRole("rowheader", { name: "view 004" }));
    await expect(canvas.getByTestId("selection").textContent).toBe("v1/c1");
    await expect(grid(canvasElement).getAttribute("aria-multiselectable")).toBeNull();
  },
};

export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("grid")).toBeInTheDocument();
    await expect(canvas.getAllByRole("columnheader").length).toBeGreaterThan(1);
  },
};
