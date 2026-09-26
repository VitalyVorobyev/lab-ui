import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { StackedBars, type BarRow } from "./BarChart";
import { DEFECT_COLOUR, NORMAL_COLOUR, SERIES_COLOURS } from "./Frame";

function outcome(label: string, caught: number, missed: number): BarRow {
  return {
    label,
    segments: [
      { name: "caught", value: caught, colour: NORMAL_COLOUR },
      { name: "missed", value: missed, colour: DEFECT_COLOUR },
    ],
  };
}

const DEFECT_TYPES: BarRow[] = [
  outcome("scratch", 42, 3),
  outcome("crack", 18, 0),
  outcome("contamination", 11, 6),
  outcome("missing_component_on_underside", 7, 2),
  outcome("print_offset", 0, 4),
];

const meta = {
  title: "charts/StackedBars",
  component: StackedBars,
  parameters: {
    docs: {
      description: {
        component: `Horizontal stacked bars — a per-category breakdown ("of this defect type, how many were caught and
how many missed"). Horizontal because category names are free text; stacked because the question is a
proportion of a known total. Every bar is scaled to the widest row's total, so rows compare by length.

**Don't** use it for independent counts that do not add up to a meaningful total, or for a series
over time (\`LineChart\`). Long labels are truncated (with the full text in a \`title\`).

**Accessibility**: the list is \`role="table"\` named by \`label\`, one \`row\` per category with a
\`rowheader\`, and the counts are also written out as text in the last cell, so the numbers do not
depend on colour or on the bar widths.`,
      },
    },
  },
  args: { label: "Outcome by defect type", rows: DEFECT_TYPES },
} satisfies Meta<typeof StackedBars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CaughtAndMissed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("table", { name: "Outcome by defect type" })).toBeInTheDocument();
    await expect(canvas.getByText("42 caught · 3 missed")).toBeInTheDocument();
  },
};

export const ManySegments: Story = {
  args: {
    label: "Detections by part family",
    rows: ["housing", "bracket", "gasket"].map((family, row) => ({
      label: family,
      segments: ["ok", "rework", "scrap", "unread"].map((name, index) => ({
        name,
        value: ((row + 2) * (index + 3) * 7) % 23,
        colour: SERIES_COLOURS[index] ?? "#8b949b",
      })),
    })),
  },
};

/** A category with nothing in it shows its total rather than an empty cell. */
export const ZeroRow: Story = {
  args: { rows: [outcome("scratch", 12, 1), outcome("dent", 0, 0)] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("0")).toBeInTheDocument();
  },
};

export const Empty: Story = { args: { rows: [] } };
