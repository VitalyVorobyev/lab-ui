import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { LineChart, type Series } from "./LineChart";

/** A training loss: exponential decay with a deterministic ripple, spanning two decades. */
function loss(scale: number, rate: number, floor: number, steps = 60): Series["points"] {
  return Array.from({ length: steps }, (_, index) => {
    const x = index * 50;
    const ripple = 1 + 0.08 * Math.sin(index * 1.7) * Math.cos(index * 0.43);
    return { x, y: (floor + scale * Math.exp(-rate * index)) * ripple };
  });
}

const LOSS_ST: Series = { name: "loss_st", points: loss(4, 0.09, 0.02) };
const LOSS_AE: Series = { name: "loss_ae", points: loss(1.2, 0.06, 0.05) };
const LOSS_STAE: Series = { name: "loss_stae", points: loss(0.6, 0.05, 0.01) };

/** An ROC curve over a fixed [0, 1] square. */
const ROC: Series = {
  name: "val ROC (AUC 0.94)",
  points: [0, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 1].map((fpr) => ({
    x: fpr,
    y: Math.min(1, Math.pow(fpr, 0.18)),
  })),
};

const meta = {
  title: "charts/LineChart",
  component: LineChart,
  parameters: {
    docs: {
      description: {
        component: `One or more series over a shared x axis — training curves, ROC/PR curves, any metric against step.

A series with no points still claims its legend entry (a term that has not reported yet is visibly
pending); a series with one point draws a dot. \`logY\` puts losses that span decades on a log axis;
\`xDomain\`/\`yDomain\` fix the axes where they are known (ROC and PR are both [0, 1]); \`underlay\` draws
behind the series (a chance diagonal, a tolerance band). \`variant\` says where the chart goes —
\`panel\` in a two-column grid, \`wide\` for a full-width panel — so its text matches its neighbours.

**Don't** use it for a signal against arc length with detected edges — that is \`LineProfile\` — or for
a two-class score distribution (\`ScoreHistogram\`). It is not an interactive plot: no zoom, no hover.

**Accessibility**: the SVG is \`role="img"\` named by \`label\` (required); the legend is real text below
the plot. The chart's data is not exposed to a screen reader — put the numbers that matter in the
surrounding text or a table.`,
      },
    },
  },
  args: {
    label: "Training losses",
    xLabel: "step",
    yLabel: "loss",
    series: [LOSS_ST],
  },
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSeries: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Training losses" })).toBeInTheDocument();
    await expect(canvas.getByText("loss_st")).toBeInTheDocument();
  },
};

export const MultiSeries: Story = {
  args: { series: [LOSS_ST, LOSS_AE, LOSS_STAE] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("path")).toHaveLength(3);
    for (const name of ["loss_st", "loss_ae", "loss_stae"]) {
      await expect(canvas.getByText(name)).toBeInTheDocument();
    }
  },
};

export const LogScale: Story = {
  args: { series: [LOSS_ST, LOSS_AE, LOSS_STAE], logY: true },
  play: async ({ canvasElement }) => {
    for (const path of canvasElement.querySelectorAll("path")) {
      await expect(path.getAttribute("d")).not.toContain("NaN");
    }
  },
};

export const Wide: Story = {
  args: { series: [LOSS_ST, LOSS_AE, LOSS_STAE], logY: true, variant: "wide" },
};

/** ROC over fixed domains, with a chance diagonal drawn as an underlay. */
export const FixedDomainsWithUnderlay: Story = {
  args: {
    label: "Validation ROC",
    xLabel: "false positive rate",
    yLabel: "true positive rate",
    series: [ROC],
    xDomain: [0, 1],
    yDomain: [0, 1],
    underlay: (x, y) => (
      <line
        x1={x.project(0)}
        y1={y.project(0)}
        x2={x.project(1)}
        y2={y.project(1)}
        stroke="currentColor"
        strokeDasharray="3 3"
        opacity={0.4}
      />
    ),
    footer: <span>Dashed: chance.</span>,
  },
};

/** The very start of a run: one reported point is a dot, not an empty chart. */
export const SinglePoint: Story = {
  args: { series: [{ name: "lr", points: [{ x: 0, y: 0.0001 }] }], yLabel: "learning rate" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("circle")).toHaveLength(1);
  },
};

/** No points yet: the axes and the pending terms' legend entries still render. */
export const Empty: Story = {
  args: {
    series: [
      { name: "loss_st", points: [] },
      { name: "loss_ae", points: [] },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("loss_ae")).toBeInTheDocument();
  },
};

export const WithoutLegend: Story = {
  args: { series: [LOSS_ST, LOSS_AE], showLegend: false },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("loss_st")).toBeNull();
  },
};
