import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { DeltaCell } from "./DeltaCell";
import { type Column, Table } from "./Table";

const meta = {
  title: "ui/DeltaCell",
  component: DeltaCell,
  parameters: {
    docs: {
      description: {
        component: `A number with its signed difference from a reference and a tint for how much that difference matters, for a
numeric \`Table\` cell: "1204.5 +0.21" with the second part in muted text.

You decide what the reference is (a default, a previous run) and how large a change is: pass \`magnitude\` already normalised to
\`[0, 1]\`, and the cell steps it into four strengths (\`none\` below 0.1, \`low\` below 0.4, \`medium\` below 0.7, else \`high\`) as a tint
of the accent, or of a neutral grey with \`tone="neutral"\`. It never uses a verdict colour: a change is not a pass or a fail.

**Use** it where a column compares each row with a reference. **Don't** use it for a verdict (that is a \`Badge\`), and don't let the
tint carry the finding alone: the signed difference is always text.

**Accessibility**: the difference is announced as "change +0.012", or with \`deltaLabel\` ("from default +0.012"); a zero has no sign
and a missing value is an em dash. The tint is decorative and contrast holds in both themes at every strength.`,
      },
    },
  },
  args: { value: 1204.52, delta: 0.21, format: (v: number) => v.toFixed(2), deltaFormat: (v: number) => v.toFixed(2) },
} satisfies Meta<typeof DeltaCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoHighlight: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("1204.52")).toBeVisible();
    await expect(canvas.getByText("change")).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-strength='none']")).not.toBeNull();
  },
};

export const Strengths: Story = {
  render: (args) => (
    <div className="flex flex-col items-end gap-1.5 font-mono text-sm tabular-nums">
      {[0.05, 0.25, 0.55, 0.9].map((magnitude, i) => (
        <DeltaCell key={magnitude} {...args} delta={[0.01, -0.12, 0.45, -1.4][i]} magnitude={magnitude} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cells = [...canvasElement.querySelectorAll("[data-delta-cell]")].map((c) => c.getAttribute("data-strength"));
    await expect(cells).toEqual(["none", "low", "medium", "high"]);
  },
};

export const Neutral: Story = {
  render: (args) => (
    <div className="flex flex-col items-end gap-1.5 font-mono text-sm tabular-nums">
      {[0.25, 0.55, 0.9].map((magnitude, i) => (
        <DeltaCell key={magnitude} {...args} tone="neutral" delta={[0.12, -0.45, 1.4][i]} magnitude={magnitude} />
      ))}
    </div>
  ),
};

export const UnitAndLabel: Story = {
  args: {
    value: 0.412,
    delta: -0.031,
    unit: "px",
    deltaLabel: "from run A",
    magnitude: 0.5,
    format: (v: number) => v.toFixed(3),
    deltaFormat: (v: number) => v.toFixed(3),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("from run A")).toBeInTheDocument();
    await expect(canvas.getByText("px")).toBeVisible();
  },
};

export const Missing: Story = {
  args: { value: null, delta: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-delta-cell]")).toHaveTextContent("—");
  },
};

type Row = { name: string; value: number; delta: number };
const ROWS: Row[] = [
  { name: "focal length", value: 1204.52, delta: 0.21 },
  { name: "k1", value: -0.2398, delta: 0.0014 },
  { name: "k2", value: 0.0702, delta: -0.0029 },
];

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Parameter", cell: (row) => row.name },
  {
    key: "value",
    header: "Value",
    numeric: true,
    cell: (row) => (
      <DeltaCell
        value={row.value}
        delta={row.delta}
        magnitude={Math.min(1, Math.abs(row.delta / row.value) * 40)}
        format={(v) => v.toFixed(4)}
        deltaFormat={(v) => v.toFixed(4)}
      />
    ),
  },
];

/** In a numeric column the cell sits flush right, under its header. */
export const InATable: Story = {
  render: () => <Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} caption="Parameters" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("table", { name: "Parameters" })).toBeVisible();
    await expect(canvas.getAllByText("change", { exact: false })).toHaveLength(3);
  },
};
