import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Button } from "./Button";
import { DensityProvider } from "./Density";
import { Section } from "./Panel";

const meta = {
  title: "ui/Section",
  component: Section,
  parameters: {
    docs: {
      description: {
        component: `A numbered step inside a form: a small heading, an optional hint and actions, then its content.

**Use** \`step\` where the order is real — each choice narrows the next (pick a dataset, then a model,
then its parameters). Without \`step\` it is a plain titled group.

**Don't** number parts that are merely adjacent, and don't use it as a bordered region (that is
\`Panel\`).

**Accessibility**: the title is an \`<h3>\`, so it nests under a panel's \`<h2>\`. The step number is
\`aria-hidden\` — the heading order already carries the sequence — so put anything a reader must hear
in the title or hint.`,
      },
    },
  },
  args: {
    title: "Model",
    children: <p className="text-sm text-fg-muted">A backbone and its weights.</p>,
  },
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Model" })).toBeVisible();
  },
};

export const Numbered: Story = {
  args: { step: 2 },
  play: async ({ canvas }) => {
    // The number is decoration for sighted readers only; the heading name stays the title.
    await expect(canvas.getByRole("heading", { level: 3, name: "Model" })).toBeVisible();
    await expect(canvas.getByText("02")).toHaveAttribute("aria-hidden", "true");
  },
};

export const WithHintAndActions: Story = {
  args: {
    step: 3,
    title: "Parameters",
    hint: "Defaults come from the model card.",
    actions: (
      <Button size="sm" variant="ghost">
        Reset
      </Button>
    ),
  },
};

export const Compact: Story = {
  args: { step: 1, hint: "Pick one." },
  decorators: [
    (Story) => (
      <DensityProvider value="compact">
        <Story />
      </DensityProvider>
    ),
  ],
};
