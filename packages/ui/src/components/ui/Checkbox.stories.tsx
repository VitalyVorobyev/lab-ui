import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { Checkbox } from "./Toggle";

/** Holds the checked state, so the story behaves like the field it stands in for. */
function Controlled(props: ComponentProps<typeof Checkbox>) {
  const [checked, setChecked] = useState(props.checked);
  return (
    <Checkbox
      {...props}
      checked={checked}
      onCheckedChange={(next) => {
        setChecked(next);
        props.onCheckedChange(next);
      }}
    />
  );
}

const meta = {
  title: "ui/Checkbox",
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component: `A statement about a state you are about to commit — "I have read the warnings", "keep this channel".

**Use** it inside a form that is then submitted, or to select rows of a table (\`aria-label\` with no
\`label\`; \`"indeterminate"\` on a header box over a partial selection). \`onClick\` receives the
modifier keys, for shift-range and platform-key toggling; \`onCheckedChange\` gets a boolean.

**Don't** use it for a setting that takes effect immediately (that is \`Switch\`), or for a layer
toggle in a toolbar (that is \`ToggleChip\`).

**Accessibility**: Radix Checkbox — a \`<button role="checkbox">\` with \`aria-checked\` (\`mixed\`
when indeterminate), toggled by Space. With \`label\` it sits in a \`<label>\`; without one it needs an
\`aria-label\`.`,
      },
    },
  },
  args: {
    checked: false,
    onCheckedChange: fn(),
    label: "Keep this channel",
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  play: async ({ canvas, args }) => {
    const box = canvas.getByRole("checkbox", { name: "Keep this channel" });
    await expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.click(box);
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);
    await expect(box).toHaveAttribute("aria-checked", "true");
    // Clicking the label text toggles it too.
    await userEvent.click(canvas.getByText("Keep this channel"));
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(false);
  },
};

export const Checked: Story = {
  args: { checked: true },
  play: async ({ canvas, args }) => {
    const box = canvas.getByRole("checkbox", { name: "Keep this channel" });
    box.focus();
    await userEvent.keyboard(" ");
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(false);
    await expect(box).toHaveAttribute("aria-checked", "false");
  },
};

export const Indeterminate: Story = {
  args: { checked: "indeterminate", label: "All channels" },
  play: async ({ canvas, args }) => {
    const box = canvas.getByRole("checkbox", { name: "All channels" });
    await expect(box).toHaveAttribute("aria-checked", "mixed");
    await userEvent.click(box);
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);
  },
};

export const WithDescription: Story = {
  args: {
    label: "I have read the warnings",
    description: "Retraining discards the current weights.",
  },
};

export const AriaLabelOnly: Story = {
  args: { label: undefined, "aria-label": "Select run 12", onClick: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: "Select run 12" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args }) => {
    const box = canvas.getByRole("checkbox", { name: "Keep this channel" });
    await expect(box).toBeDisabled();
    await userEvent.click(box, { pointerEventsCheck: 0 });
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};
