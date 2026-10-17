import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { DensityProvider } from "./Density";
import { type Column, Table } from "./Table";
import { sortRows, type TableSort } from "./tableSort";

type Match = { id: number; frame: string; label: string; score: number | null; x: number; y: number };

const ROWS: Match[] = [
  { id: 1, frame: "frame 10", label: "scratch", score: 0.9731, x: 412.5, y: 88.25 },
  { id: 2, frame: "frame 9", label: "dent", score: 0.8412, x: 97.0, y: 301.75 },
  { id: 3, frame: "frame 2", label: "stain", score: 0.6105, x: 1203.25, y: 640.0 },
];

const score = (row: Match) => row.score?.toFixed(4) ?? "—";

const COLUMNS: Column<Match>[] = [
  { key: "id", header: "#", numeric: true, width: "3rem", cell: (row) => row.id },
  { key: "label", header: "Defect", cell: (row) => row.label },
  { key: "score", header: "Score", numeric: true, cell: score },
  { key: "x", header: "x (px)", numeric: true, cell: (row) => row.x.toFixed(2) },
  { key: "y", header: "y (px)", numeric: true, cell: (row) => row.y.toFixed(2) },
];

/** Matches for the sorting stories: frames that only sort right by number, and one unscored. */
const SORT_ROWS: Match[] = [
  { id: 1, frame: "frame 10", label: "scratch", score: 0.9731, x: 412.5, y: 88.25 },
  { id: 2, frame: "frame 9", label: "dent", score: 0.8412, x: 97.0, y: 301.75 },
  { id: 3, frame: "frame 2", label: "stain", score: null, x: 1203.25, y: 88.25 },
  { id: 4, frame: "frame 11", label: "chip", score: 0.6105, x: 640.0, y: 12.5 },
];

/** `#` stays put; the rest sort, the score best-first. */
const SORT_COLUMNS: Column<Match>[] = [
  { key: "id", header: "#", numeric: true, width: "3rem", cell: (row) => row.id },
  { key: "frame", header: "Frame", cell: (row) => row.frame, sortValue: (row) => row.frame },
  { key: "label", header: "Defect", cell: (row) => row.label, sortValue: (row) => row.label },
  {
    key: "score",
    header: "Score",
    numeric: true,
    cell: score,
    sortValue: (row) => row.score,
    firstSort: "descending",
  },
];

/** The `#` column down the body, in display order. */
function ids(root: HTMLElement): number[] {
  return Array.from(root.querySelectorAll("tbody tr"), (row) => Number(row.firstElementChild?.textContent));
}

/** Keeps the active row, as a table kept in step with a canvas selection would. */
function Selectable(props: ComponentProps<typeof Table<Match>>) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <Table
      {...props}
      isRowActive={(row) => row.id === active}
      onRowClick={(row, index, event) => {
        setActive(row.id);
        props.onRowClick?.(row, index, event);
      }}
    />
  );
}

/** Every match the stand-in server holds; it returns them a page at a time. */
const ALL_MATCHES: Match[] = [
  ...SORT_ROWS,
  { id: 5, frame: "frame 14", label: "burr", score: 0.9915, x: 75.5, y: 410.0 },
  { id: 6, frame: "frame 1", label: "pit", score: 0.7208, x: 980.75, y: 233.5 },
];

/** The app sorts: a stand-in for a server that orders every match and returns the first three. */
function ServerSorted(props: ComponentProps<typeof Table<Match>>) {
  const [sort, setSort] = useState<TableSort | null>(null);
  const page = sortRows(ALL_MATCHES, SORT_COLUMNS, sort).slice(0, 3);
  return (
    <Table
      {...props}
      rows={page}
      sort={sort}
      manualSort
      onSortChange={(next) => {
        setSort(next);
        props.onSortChange?.(next);
      }}
    />
  );
}

const LABELS = ["scratch", "dent", "stain", "chip", "burr", "pit"];

/** 5,000 matches, spread deterministically (no random numbers: the screenshots must not move). */
const MANY: Match[] = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1,
  frame: `frame ${(i * 37) % 997}`,
  label: LABELS[i % LABELS.length]!,
  score: i % 50 === 7 ? null : ((i * 7919) % 10000) / 10000,
  x: ((i * 131) % 1920) + 0.25,
  y: ((i * 71) % 1080) + 0.5,
}));

/** The rendered body rows: what is in the DOM, not what the table holds. */
function renderedRows(root: HTMLElement): HTMLTableRowElement[] {
  return Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody tr:not([aria-hidden])"));
}

const meta = {
  title: "ui/Table",
  component: Table<Match>,
  parameters: {
    docs: {
      description: {
        component: `A table of rows, where \`numeric\` columns are mono, tabular and right-aligned so a column
of scores compares by eye down its decimal point.

**Use** it for records with shared columns — matches, runs, measurements. \`onRowClick\` makes rows
activatable (mouse, Enter or Space; the event is passed for modifiers), \`isRowActive\` marks the
current row, \`onRowHover\` keeps it in step with a canvas. With no rows it renders \`empty\` instead.

**Sorting**: give a column a \`sortValue\` (numbers by value, strings in a numeric-aware order, so
"frame 9" comes before "frame 10"; missing values last both ways) or a \`compare\`, and its header
becomes a button that cycles the column's \`firstSort\` direction, the other, then the rows' own
order. The table keeps the sort (from \`defaultSort\`) or follows \`sort\` and \`onSortChange\`;
with \`manualSort\` the app orders the rows and the headers only show the sort. Row callbacks get
each row's index in \`rows\`, whatever the order on screen. \`sortRows\` gives the same order
outside the table.

**Don't** use it for layout, or for a two-column key/value list of a single record. Don't make
a column sortable when its order tells a reader nothing, such as a row number.

**Long tables**: \`windowed={{ rowHeight, height }}\` renders only the rows in view (plus
\`overscan\`, 8 by default) in a scroll area of \`height\` px — or the container's height when
\`height\` is left out — under a sticky header. Every row is \`rowHeight\` tall (at least 36 px
comfortable, 22 px compact) and cells keep to one line, cut with an ellipsis; the layout is
fixed, so give columns a \`width\` where content needs it. Sorting, callbacks and the keyboard
work over all the rows.

**Accessibility**: a real \`<table>\` with \`<th scope="col">\`; \`caption\` is visually hidden but
names the table. Activatable rows are focusable (\`tabIndex=0\`) and keep their \`row\` role, so the
cells stay announced as cells; the active row carries \`aria-current\`. From a focused row the
arrow keys, Page Up / Page Down and Home / End move to another row, scrolling a windowed table
to it. A windowed table carries \`aria-rowcount\` and each rendered row its \`aria-rowindex\`, so a
reader hears a row's place among all of them; a windowed table with nothing focusable in it is
a tab stop itself, so it can be scrolled from the keyboard. A sortable header's
content is a button, reachable with Tab and pressed with Enter or Space; the sorted header
carries \`aria-sort\`, and the arrows are hidden from assistive technology.`,
      },
    },
  },
  args: {
    columns: COLUMNS,
    rows: ROWS,
    rowKey: (row) => row.id,
    caption: "Matches",
  },
} satisfies Meta<typeof Table<Match>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const table = canvas.getByRole("table", { name: "Matches" });
    await expect(table).toBeVisible();
    await expect(canvas.getAllByRole("columnheader")).toHaveLength(5);
    // Header row plus one per record.
    await expect(canvas.getAllByRole("row")).toHaveLength(4);
  },
};

export const ClickableRows: Story = {
  args: { onRowClick: fn(), onRowHover: fn() },
  render: (args) => <Selectable {...args} />,
  play: async ({ canvas, args }) => {
    const rows = canvas.getAllByRole("row");
    const second = rows[2];
    const third = rows[3];
    if (!second || !third) throw new Error("expected three body rows");

    await userEvent.click(second);
    await expect(args.onRowClick).toHaveBeenLastCalledWith(ROWS[1], 1, expect.anything());
    await expect(second).toHaveAttribute("aria-current", "true");
    await expect(args.onRowHover).toHaveBeenCalledWith(ROWS[1], 1);

    // Keyboard: the row is a tab stop, and Enter activates it.
    third.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onRowClick).toHaveBeenLastCalledWith(ROWS[2], 2, expect.anything());
    await expect(third).toHaveAttribute("aria-current", "true");
    await expect(second).not.toHaveAttribute("aria-current");

    await userEvent.keyboard(" ");
    await expect(args.onRowClick).toHaveBeenCalledTimes(3);
  },
};

export const ActiveRow: Story = {
  args: { isRowActive: (row) => row.id === 2 },
  play: async ({ canvas }) => {
    const current = canvas.getAllByRole("row").filter((row) => row.getAttribute("aria-current") === "true");
    await expect(current).toHaveLength(1);
    await expect(current[0]).toHaveTextContent("dent");
  },
};

export const Empty: Story = {
  args: { rows: [], empty: "No matches above the threshold." },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("table")).toBeNull();
    await expect(canvas.getByText("No matches above the threshold.")).toBeVisible();
  },
};

export const Compact: Story = {
  decorators: [
    (Story) => (
      <DensityProvider value="compact">
        <Story />
      </DensityProvider>
    ),
  ],
};

/** Frame, defect and score sort; `#` does not. Score sorts best-first, unscored last. */
export const Sortable: Story = {
  args: { columns: SORT_COLUMNS, rows: SORT_ROWS, onSortChange: fn(), onRowClick: fn() },
  play: async ({ canvas, canvasElement, args }) => {
    const frame = canvas.getByRole("columnheader", { name: "Frame" });
    await expect(canvas.queryByRole("button", { name: "#" })).toBeNull();
    await expect(frame).not.toHaveAttribute("aria-sort");
    await expect(ids(canvasElement)).toEqual([1, 2, 3, 4]);

    // Frames sort by their number: 2, 9, 10, 11.
    await userEvent.click(canvas.getByRole("button", { name: "Frame" }));
    await expect(args.onSortChange).toHaveBeenLastCalledWith({ key: "frame", direction: "ascending" });
    await expect(frame).toHaveAttribute("aria-sort", "ascending");
    await expect(ids(canvasElement)).toEqual([3, 2, 1, 4]);

    await userEvent.click(canvas.getByRole("button", { name: "Frame" }));
    await expect(frame).toHaveAttribute("aria-sort", "descending");
    await expect(ids(canvasElement)).toEqual([4, 1, 2, 3]);

    await userEvent.click(canvas.getByRole("button", { name: "Frame" }));
    await expect(args.onSortChange).toHaveBeenLastCalledWith(null);
    await expect(frame).not.toHaveAttribute("aria-sort");
    await expect(ids(canvasElement)).toEqual([1, 2, 3, 4]);

    // From the keyboard: the header is a button. Score starts best-first, the unscored last.
    canvas.getByRole("button", { name: "Score" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("columnheader", { name: "Score" })).toHaveAttribute("aria-sort", "descending");
    await expect(ids(canvasElement)).toEqual([1, 2, 4, 3]);

    // A row reports its index in `rows`, not its place on screen.
    await userEvent.click(canvas.getAllByRole("row")[3]!);
    await expect(args.onRowClick).toHaveBeenLastCalledWith(SORT_ROWS[3], 3, expect.anything());
  },
};

/** Opens sorted by score, best first. The third click on the header comes back to it. */
export const DefaultSort: Story = {
  args: { columns: SORT_COLUMNS, rows: SORT_ROWS, defaultSort: { key: "score", direction: "descending" } },
  play: async ({ canvas, canvasElement }) => {
    const header = canvas.getByRole("columnheader", { name: "Score" });
    const button = canvas.getByRole("button", { name: "Score" });
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(ids(canvasElement)).toEqual([1, 2, 4, 3]);

    // Ascending keeps the unscored match last.
    await userEvent.click(button);
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(ids(canvasElement)).toEqual([4, 2, 1, 3]);

    await userEvent.click(button);
    await expect(header).not.toHaveAttribute("aria-sort");
    await expect(ids(canvasElement)).toEqual([1, 2, 3, 4]);

    await userEvent.click(button);
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(ids(canvasElement)).toEqual([1, 2, 4, 3]);
  },
};

/**
 * The app sorts: each click asks a stand-in server for the first three of six matches in the
 * new order, and the table shows the page as given.
 */
export const ManualSort: Story = {
  args: { columns: SORT_COLUMNS, rows: [], onSortChange: fn() },
  render: (args) => <ServerSorted {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    const header = canvas.getByRole("columnheader", { name: "Score" });
    await expect(ids(canvasElement)).toEqual([1, 2, 3]);

    // Best first across all six: match 5 was not on the page before.
    await userEvent.click(canvas.getByRole("button", { name: "Score" }));
    await expect(args.onSortChange).toHaveBeenLastCalledWith({ key: "score", direction: "descending" });
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(ids(canvasElement)).toEqual([5, 1, 2]);

    await userEvent.click(canvas.getByRole("button", { name: "Score" }));
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(ids(canvasElement)).toEqual([4, 6, 2]);
  },
};

/** Position sorts in reading order — by row (y), then along it (x) — which no single value gives. */
export const CustomCompare: Story = {
  args: {
    rows: SORT_ROWS,
    columns: [
      { key: "id", header: "#", numeric: true, width: "3rem", cell: (row) => row.id },
      { key: "label", header: "Defect", cell: (row) => row.label },
      {
        key: "position",
        header: "Position (px)",
        numeric: true,
        cell: (row) => `${row.x.toFixed(2)}, ${row.y.toFixed(2)}`,
        compare: (a, b) => a.y - b.y || a.x - b.x,
      },
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    const header = canvas.getByRole("columnheader", { name: "Position (px)" });
    const button = canvas.getByRole("button", { name: "Position (px)" });

    // Matches 1 and 3 share a row; 1 is further left.
    await userEvent.click(button);
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(ids(canvasElement)).toEqual([4, 1, 3, 2]);

    await userEvent.click(button);
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(ids(canvasElement)).toEqual([2, 3, 1, 4]);
  },
};

/** Arrow keys, Page Up / Page Down and Home / End move between activatable rows. */
export const KeyboardNavigation: Story = {
  args: { columns: SORT_COLUMNS, rows: SORT_ROWS, onRowClick: fn() },
  play: async ({ canvas, args }) => {
    const rows = canvas.getAllByRole("row").slice(1);
    rows[0]!.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(rows[1]).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(rows[3]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(rows[3]).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(rows[0]).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onRowClick).toHaveBeenLastCalledWith(SORT_ROWS[0], 0, expect.anything());
  },
};

/**
 * 5,000 matches in a 400 px scroll area: only the rows in view are in the DOM, and the header
 * stays put. Sorting orders all 5,000.
 */
export const Windowed: Story = {
  args: {
    columns: SORT_COLUMNS.map((column) => (column.key === "frame" ? { ...column, width: "8rem" } : column)),
    rows: MANY,
    caption: "Matches",
    windowed: { rowHeight: 36, height: 400 },
  },
  play: async ({ canvas, canvasElement }) => {
    const table = canvas.getByRole("table", { name: "Matches" });
    const scroller = table.parentElement!;
    await expect(table).toHaveAttribute("aria-rowcount", "5001");
    await expect(renderedRows(canvasElement).length).toBeLessThan(30);
    await expect(renderedRows(canvasElement)[0]).toHaveAttribute("aria-rowindex", "2");
    // Every row is the height the window counts with, so the scroll height is exact.
    await expect(renderedRows(canvasElement)[0]!.getBoundingClientRect().height).toBe(36);

    // Halfway down, the rows there are rendered, and the header is still at the top.
    scroller.scrollTop = 2500 * 36;
    await waitFor(() => expect(canvasElement.querySelector('tr[aria-rowindex="2502"]')).not.toBeNull());
    await expect(renderedRows(canvasElement).length).toBeLessThan(30);
    const header = canvas.getByRole("columnheader", { name: "Frame" });
    await expect(Math.round(header.getBoundingClientRect().top)).toBe(Math.round(scroller.getBoundingClientRect().top));

    // Sorting orders every row, not just the rendered ones: the best score is first.
    scroller.scrollTop = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Score" }));
    const best = Math.max(...MANY.map((row) => row.score ?? -1));
    await waitFor(() => expect(renderedRows(canvasElement)[0]).toHaveTextContent(best.toFixed(4)));
  },
};

/** The keyboard reaches every row: End jumps to row 5,000, scrolling it into view. */
export const WindowedKeyboard: Story = {
  args: { rows: MANY, caption: "Matches", windowed: { rowHeight: 36, height: 320 }, onRowClick: fn() },
  render: (args) => <Selectable {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    const first = renderedRows(canvasElement)[0]!;
    first.focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(document.activeElement).toHaveAttribute("aria-rowindex", "5001"));
    await userEvent.keyboard("{Enter}");
    await expect(args.onRowClick).toHaveBeenLastCalledWith(MANY[4999], 4999, expect.anything());
    await expect(document.activeElement).toHaveAttribute("aria-current", "true");

    // A page is the rows that fit under the header.
    const scroller = canvas.getByRole("table").parentElement!;
    const page = Math.floor((scroller.clientHeight - canvasElement.querySelector("thead")!.offsetHeight) / 36);
    await userEvent.keyboard("{PageUp}");
    await waitFor(() => expect(document.activeElement).toHaveAttribute("aria-rowindex", String(5001 - page)));
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(document.activeElement).toHaveAttribute("aria-rowindex", "2"));
    await expect(scroller.scrollTop).toBe(0);
  },
};

/** Without `height` the scroll area fills its container, here a 240 px panel. */
export const WindowedFill: Story = {
  args: { rows: MANY, caption: "Matches", windowed: { rowHeight: 22 } },
  decorators: [
    (Story) => (
      <DensityProvider value="compact">
        <div
          className="rounded-panel bg-surface p-2.5 ring-1 ring-line"
          style={{ display: "flex", flexDirection: "column", height: 240, padding: 10 }}
        >
          <div style={{ minHeight: 0, flex: 1 }}>
            <Story />
          </div>
        </div>
      </DensityProvider>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    // Nothing in it is focusable, so the scroll area is a tab stop of its own.
    const region = canvas.getByRole("region", { name: "Matches" });
    await expect(region).toHaveAttribute("tabindex", "0");
    // It is as tall as the panel's content box, not as tall as 5,000 rows.
    await expect(region.getBoundingClientRect().height).toBe(region.parentElement!.getBoundingClientRect().height);
    await expect(region.getBoundingClientRect().height).toBeLessThanOrEqual(240);
    await expect(renderedRows(canvasElement).length).toBeLessThan(30);
  },
};
