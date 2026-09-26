import type { Meta, StoryObj } from "@storybook/react-vite";
import { Info } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "./Button";
import { InfoHint, Tooltip } from "./Tooltip";

const meta = {
  title: "ui/Tooltip",
  component: Tooltip,
  parameters: {
    docs: {
      description: {
        component: `A short explanation, on hover or keyboard focus — the replacement for the native \`title\`.
\`InfoHint\` is the standard affordance: a quiet \`?\` (help with a control) or \`Info\` icon (facts
about the thing on screen) that yields the explanation.

**Use** it for text that helps but is not needed to operate the control. Needs a
\`TooltipProvider\` above it (once per app).

**Don't** put anything a reader must have to answer the question in a tooltip — that belongs in
the field's description, where it is always visible. Don't put interactive content in it.

**Accessibility**: Radix Tooltip — opens on hover and on keyboard focus, closes on Escape, and
the trigger is \`aria-describedby\` the tooltip while it is open. The trigger must be focusable
(the child is rendered \`asChild\`). \`InfoHint\` is a real button named by its \`label\`
(default "More information"); its icon is decorative.`,
      },
    },
  },
  args: {
    content: "Scores above the threshold are reported as defects.",
    children: <Button>Threshold</Button>,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Threshold" })).toBeInTheDocument();
    await expect(within(document.body).queryByRole("tooltip")).not.toBeInTheDocument();
  },
};

export const OpenOnHover: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Threshold" });
    await userEvent.hover(trigger);
    const tooltip = await within(document.body).findByRole("tooltip");
    await expect(tooltip).toHaveTextContent("Scores above the threshold are reported as defects.");
    await expect(trigger).toHaveAccessibleDescription(
      "Scores above the threshold are reported as defects.",
    );
  },
};

export const OpenOnFocus: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Threshold" });
    trigger.focus();
    await expect(await within(document.body).findByRole("tooltip")).toBeInTheDocument();
  },
};

export const Hint: Story = {
  render: () => (
    <span className="inline-flex items-center gap-1 text-xs text-fg">
      Kernel size
      <InfoHint>Odd sizes only; the kernel is centred on the pixel.</InfoHint>
    </span>
  ),
  play: async ({ canvas }) => {
    const hint = canvas.getByRole("button", { name: "More information" });
    await userEvent.hover(hint);
    await expect(await within(document.body).findByRole("tooltip")).toHaveTextContent(
      "Odd sizes only; the kernel is centred on the pixel.",
    );
  },
};

export const HintInfoIcon: Story = {
  render: () => (
    <span className="inline-flex items-center gap-1 text-xs text-fg">
      bolts-2024
      <InfoHint icon={Info} label="About this dataset">
        Captured on line 3, March 2024, under ring light.
      </InfoHint>
    </span>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "About this dataset" })).toBeInTheDocument();
  },
};
