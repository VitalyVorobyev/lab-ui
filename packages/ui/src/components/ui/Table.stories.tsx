import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { DensityProvider } from "./Density";
import { type Column, Table } from "./Table";

type Match = { id: number; label: string; score: number; x: number; y: number };

const ROWS: Match[] = [
  { id: 1, label: "scratch", score: 0.9731, x: 412.5, y: 88.25 },
  { id: 2, label: "dent", score: 0.8412, x: 97.0, y: 301.75 },
  { id: 3, label: "stain", score: 0.6105, x: 1203.25, y: 640.0 },
];

const COLUMNS: Column<Match>[] = [
  { key: "id", header: "#", numeric: true, width: "3rem", cell: (row) => row.id },
  { key: "label", header: "Defect", cell: (row) => row.label },
  { key: "score", header: "Score", numeric: true, cell: (row) => row.score.toFixed(4) },
  { key: "x", header: "x (px)", numeric: true, cell: (row) => row.x.toFixed(2) },
  { key: "y", header: "y (px)", numeric: true, cell: (row) => row.y.toFixed(2) },
];

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

**Don't** use it for layout, or for a two-column key/value list of a single record.

**Accessibility**: a real \`<table>\` with \`<th scope="col">\`; \`caption\` is visually hidden but
names the table. Activatable rows are focusable (\`tabIndex=0\`) and keep their \`row\` role, so the
cells stay announced as cells; the active row carries \`aria-current\`.`,
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
    const current = canvas
      .getAllByRole("row")
      .filter((row) => row.getAttribute("aria-current") === "true");
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
