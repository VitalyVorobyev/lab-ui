import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ColormapLegend } from "./ColormapLegend";

const meta = {
  title: "charts/ColormapLegend",
  component: ColormapLegend,
  parameters: {
    docs: {
      description: {
        component: `The scale of a sequential colour map — \`viridis\` or \`cividis\` — as one line: what the colour encodes,
the low end, the bar, the high end, with units. Every map drawn over an image or in a table needs one. Colour a value with \`colormapValue(map, value, domain)\`.

**Use** it for a magnitude: an error in px, a validity fraction, a confidence.

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
