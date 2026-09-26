import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Frame, Legend, areaFor, seriesColour } from "./Frame";
import { linearScale } from "./scale";

const panel = areaFor("panel");
const wide = areaFor("wide");

const meta = {
  title: "charts/Frame",
  component: Frame,
  subcomponents: { Legend },
  parameters: {
    docs: {
      description: {
        component: `The shell every chart here composes: axes, ticks, grid, axis labels, and a footer slot, over a fixed
\`viewBox\` scaled by CSS. \`variant\` says where the chart is going — \`panel\` (480×280) for a column of a
two-column grid, \`wide\` (960×320) for a full-width panel — so the text renders at the same size as its
neighbours. Children are drawn in plot coordinates, over the grid. \`Legend\` is the swatch row that goes
in the footer, in real text rather than SVG.

**Don't** reach for it directly when \`LineChart\`, \`LineProfile\` or \`ScoreHistogram\` already fits —
it is for a new kind of chart. Don't pick the variant by pixel width; pick it by placement.

**Accessibility**: the SVG is \`role="img"\` and \`label\` is required — it is the chart's accessible name.
The footer is a \`<figcaption>\`. Legend swatches are \`aria-hidden\`; the series name is the text.`,
      },
    },
  },
  args: {
    label: "Empty frame",
    xScale: linearScale([0, 100], panel.x0, panel.x1),
    yScale: linearScale([0, 1], panel.y0, panel.y1),
    xLabel: "step",
    yLabel: "score",
  },
} satisfies Meta<typeof Frame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PanelVariant: Story = {
  play: async ({ canvas }) => {
    const svg = canvas.getByRole("img", { name: "Empty frame" });
    await expect(svg).toHaveAttribute("viewBox", "0 0 480 280");
    await expect(canvas.getByText("step")).toBeInTheDocument();
  },
};

export const WideVariant: Story = {
  args: {
    label: "Wide frame",
    variant: "wide",
    xScale: linearScale([0, 1000], wide.x0, wide.x1),
    yScale: linearScale([0, 250], wide.y0, wide.y1),
    xTicks: 10,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Wide frame" })).toHaveAttribute(
      "viewBox",
      "0 0 960 320",
    );
  },
};

/** Children in plot coordinates, with a `Legend` in the footer. */
export const WithContentAndLegend: Story = {
  args: {
    label: "Two markers",
    children: [0.2, 0.55, 0.8].map((value, index) => (
      <circle
        key={value}
        cx={linearScale([0, 100], panel.x0, panel.x1).project(20 + index * 30)}
        cy={linearScale([0, 1], panel.y0, panel.y1).project(value)}
        r={4}
        fill={seriesColour(index)}
      />
    )),
    footer: (
      <Legend
        items={["first", "second", "third"].map((label, index) => ({
          label,
          colour: seriesColour(index),
        }))}
      />
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("second")).toBeInTheDocument();
  },
};

export const WithoutAxisLabels: Story = {
  args: { label: "Bare frame", xLabel: undefined, yLabel: undefined, xTicks: 3, yTicks: 2 },
};
