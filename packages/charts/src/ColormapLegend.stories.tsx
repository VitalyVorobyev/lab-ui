import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ColormapLegend } from "./ColormapLegend";

const meta = {
  title: "charts/ColormapLegend",
  component: ColormapLegend,
  parameters: {
    docs: {
      description: {
        component: `The scale of a colour map as one line: what the colour encodes, the low end, the bar, the high end, with
units. Every map drawn over an image or in a table needs one. Colour a value with \`colormapValue(map, value, domain)\`.

- **Maps:** \`viridis\`, \`cividis\`, \`magma\` and \`inferno\` for a magnitude; \`blueOrange\` for a signed value around zero.
- **\`orientation="vertical"\`:** a column beside a map, the high end at the top, the label above it and its unit after the label.
  \`length\` sets the bar's height.
- **\`ticks\`:** values along the bar at their position on the map: a list, or a rough count of round ones.
- **\`symmetric\`:** centres the scale on zero for a diverging map, widening \`domain\` to \`[-m, m]\` and labelling zero.

**Use** it for a magnitude: an error in px, a validity fraction, a confidence, or, with \`symmetric\`, a signed difference.

**Don't** use a colour map for a verdict — a pass/fail judgement is a verdict colour with its text.

**Accessibility**: the bar is decorative; the label and the two end values are text.`,
      },
    },
  },
  args: { map: "viridis", domain: [0, 2.5], unit: "px", label: "Edge error" },
} satisfies Meta<typeof ColormapLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Viridis: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Edge error")).toBeVisible();
    await expect(canvas.getByText("0 px")).toBeVisible();
    await expect(canvas.getByText("2.5 px")).toBeVisible();
    await expect(canvasElement.querySelector("[data-colormap='viridis']")).not.toBeNull();
  },
};

export const CividisPercent: Story = {
  args: { map: "cividis", domain: [0, 100], unit: "%", label: "Validity" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("100 %")).toBeVisible();
  },
};

export const Magma: Story = {
  args: { map: "magma", domain: [0, 0.4], unit: "px", label: "Residual" },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("0.4 px")).toBeVisible();
    await expect(canvasElement.querySelector("[data-colormap='magma']")).not.toBeNull();
  },
};

/** The column beside a map: the high end at the top, the unit after the label. */
export const Vertical: Story = {
  args: { map: "inferno", domain: [0, 0.4], unit: "px", label: "Residual", orientation: "vertical" },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Residual")).toBeVisible();
    await expect(canvas.getByText("0.4")).toBeVisible();
    await expect(canvasElement.querySelector("[data-orientation='vertical']")).not.toBeNull();
  },
};

export const VerticalTicks: Story = {
  args: {
    map: "viridis",
    domain: [0, 1],
    label: "Validity",
    unit: "%",
    orientation: "vertical",
    ticks: [0, 0.25, 0.5, 0.75, 1],
    format: (v) => String(v * 100),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-tick]")).toHaveLength(5);
  },
};

/** A signed value: the neutral middle is zero, so the domain is widened to be symmetric. */
export const SymmetricDiverging: Story = {
  args: { map: "blueOrange", domain: [-0.18, 0.31], label: "Radial shift", unit: "px", orientation: "vertical", symmetric: true, ticks: 5 },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("0.2")).toBeVisible();
    await expect(canvas.getByText("-0.2")).toBeVisible();
    await expect(canvasElement.querySelectorAll("[data-tick]").length).toBeGreaterThanOrEqual(3);
  },
};

export const HorizontalSymmetric: Story = {
  args: { map: "blueOrange", domain: [-1, 1], label: "Difference", unit: "px", symmetric: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Difference")).toBeVisible();
    await expect(canvas.getByText("0")).toBeVisible();
  },
};
