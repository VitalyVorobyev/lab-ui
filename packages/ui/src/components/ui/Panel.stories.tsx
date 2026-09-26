import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Button } from "./Button";
import { DensityProvider } from "./Density";
import { Panel } from "./Panel";

const meta = {
  title: "ui/Panel",
  component: Panel,
  parameters: {
    docs: {
      description: {
        component: `A bordered surface holding one region of a screen, with an optional header row.

**Use** it for a self-contained block — a result, a parameter group, an inspector — whose \`title\`
names the region and whose \`actions\` act on it. It reads the density in force: \`compact\` tightens
the header and body padding and sets the title as a small uppercase label.

**Don't** use it for a numbered step inside a form (that is \`Section\`) or for the page's own
heading (that is \`PageHeader\`); don't nest panels to make spacing.

**Accessibility**: a \`<section>\` whose title is an \`<h2>\`, so each panel is a navigable heading.
The \`<section>\` is not given an accessible name, so it is not exposed as a landmark region.`,
      },
    },
  },
  args: { title: "Detections", children: <p className="text-sm">12 matches above threshold.</p> },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTitle: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 2, name: "Detections" })).toBeVisible();
  },
};

export const WithActions: Story = {
  args: {
    actions: (
      <Button size="sm" variant="ghost">
        Export
      </Button>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Export" })).toBeVisible();
  },
};

export const Untitled: Story = {
  args: { title: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("heading")).toBeNull();
  },
};

export const Compact: Story = {
  args: {
    actions: (
      <Button size="sm" variant="ghost">
        Export
      </Button>
    ),
  },
  decorators: [
    (Story) => (
      <DensityProvider value="compact">
        <Story />
      </DensityProvider>
    ),
  ],
};
