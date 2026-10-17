import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { DensityProvider } from "./Density";
import { Progress } from "./Progress";

const meta = {
  title: "ui/Progress",
  component: Progress,
  parameters: {
    docs: {
      description: {
        component: `How far a long operation has got: strings translated, frames detected, files uploaded.

**Use** it with a \`value\` out of a \`max\` (100 by default) when the amount is known, and with
no \`value\` while it is not yet (the bar sweeps). Print the count next to it when the reader
needs it at a glance; the bar's own value text is for assistive technology. The track is
1.5 units tall in the comfortable density and 1 in the compact one.

**Don't** use it for a verdict: the bar is in the accent colour whatever the outcome, and a
failed run is a \`Callout\`. Don't show a bar for work that finishes in under a second.

**Accessibility**: a \`progressbar\` named by \`aria-label\` or \`aria-labelledby\` — name the job.
Determinate, it carries \`aria-valuenow\`, \`aria-valuemax\` and an \`aria-valuetext\` such as
"412 of 2,556" (\`valueText\` overrides it: "412 of 2,556 strings"); indeterminate, it carries
none of them. \`data-state\` is \`loading\`, \`complete\` or \`indeterminate\`. With reduced motion
the sweep holds still.`,
      },
    },
  },
  args: { "aria-label": "Translating", value: 412, max: 2556, className: "w-64" },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Determinate: Story = {
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("progressbar", { name: "Translating" });
    await expect(bar).toHaveAttribute("aria-valuenow", "412");
    await expect(bar).toHaveAttribute("aria-valuemin", "0");
    await expect(bar).toHaveAttribute("aria-valuemax", "2556");
    await expect(bar).toHaveAttribute("aria-valuetext", "412 of 2,556");
    await expect(bar).toHaveAttribute("data-state", "loading");
  },
};

/** A unit in the value text, for a reader who hears the bar out of context. */
export const ValueText: Story = {
  args: { valueText: "412 of 2,556 strings" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "412 of 2,556 strings");
  },
};

/** With the count printed beside it, as a status line would. */
export const WithCount: Story = {
  render: (args) => (
    <div className="flex w-80 items-center gap-3">
      <Progress {...args} aria-label={undefined} aria-labelledby="progress-label" className="flex-1" />
      <span id="progress-label" className="font-mono text-xs text-fg-muted">
        412 / 2,556
      </span>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "412 / 2,556" })).toBeVisible();
  },
};

/** The amount is not known yet: no value, and the bar sweeps. */
export const Indeterminate: Story = {
  args: { value: null, "aria-label": "Loading the catalog" },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("progressbar", { name: "Loading the catalog" });
    await expect(bar).toHaveAttribute("data-state", "indeterminate");
    for (const attribute of ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"]) {
      await expect(bar).not.toHaveAttribute(attribute);
    }
  },
};

export const Complete: Story = {
  args: { value: 2556 },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("progressbar");
    await expect(bar).toHaveAttribute("data-state", "complete");
    await expect(bar).toHaveAttribute("aria-valuetext", "2,556 of 2,556");
  },
};

/** Out-of-range values are clamped, and the default `max` is 100. */
export const Clamped: Story = {
  args: { value: 130, max: undefined },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuenow", "100");
    await expect(bar).toHaveAttribute("aria-valuetext", "100 of 100");
  },
};

/** A thinner track in the compact density, as in a status bar. */
export const Compact: Story = {
  render: (args) => (
    <DensityProvider value="compact">
      <div className="flex flex-col gap-3">
        <Progress {...args} />
        <Progress {...args} value={null} aria-label="Scanning" />
      </div>
    </DensityProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("progressbar")[0]).toHaveClass("h-1");
  },
};
