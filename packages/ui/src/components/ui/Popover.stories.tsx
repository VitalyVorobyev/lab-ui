import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./Button";
import { Field } from "./Field";
import { NumberInput } from "./Input";
import { Popover, PopoverClose, type PopoverProps } from "./Popover";

const meta = {
  title: "ui/Popover",
  component: Popover,
  parameters: {
    docs: {
      description: {
        component: `Floating content anchored to a trigger — a small form, a picker, a list to choose from — on the
\`overlay\` surface with the floating-layer shadow.

**Use** it for content a person works in for a moment without leaving the screen.

**Don't** use it for commands (that is \`DropdownMenu\`), for a short explanation (that is \`Tooltip\`), or for a task
that needs the whole screen's attention (that is \`Dialog\`).

**Accessibility**: Radix Popover. The trigger gets \`aria-expanded\`; focus moves into the content on open and back to
the trigger on close; Escape and a press outside close it. Name the content with \`aria-label\` when nothing inside it
does.`,
      },
    },
  },
  args: {
    trigger: <Button variant="secondary">Grid spacing</Button>,
    "aria-label": "Grid spacing",
    children: null,
  },
  render: (args) => <SpacingPopover {...args} />,
} satisfies Meta<typeof Popover>;

/** A small form behind a trigger: the typical content of a popover. */
function SpacingPopover(args: PopoverProps) {
  const [spacing, setSpacing] = useState<number | null>(25);
  return (
    <Popover {...args}>
      <div className="flex w-56 flex-col gap-2 p-2">
        <Field label="Spacing">
          <NumberInput unit="mm" value={spacing} precision={1} onValueChange={setSpacing} />
        </Field>
        <PopoverClose>
          <Button size="sm">Done</Button>
        </PopoverClose>
      </div>
    </Popover>
  );
}

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Grid spacing" })).toHaveAttribute("aria-expanded", "false");
  },
};

export const Open: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Grid spacing" });
    await userEvent.click(trigger);
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "Grid spacing" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  },
};

export const CloseButtonAndEscape: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Grid spacing" });
    const body = within(document.body);

    await userEvent.click(trigger);
    await userEvent.click(await body.findByRole("button", { name: "Done" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());

    await userEvent.click(trigger);
    await body.findByRole("dialog", { name: "Grid spacing" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
  },
};

export const Side: Story = {
  args: { side: "right", align: "center", defaultOpen: true },
  play: async () => {
    const dialog = await within(document.body).findByRole("dialog", { name: "Grid spacing" });
    await expect(dialog).toHaveAttribute("data-side", "right");
  },
};
