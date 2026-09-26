import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { Switch } from "./Toggle";

/** Holds the checked state, so the story behaves like the setting it stands in for. */
function Controlled(props: ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(props.checked);
  return (
    <Switch
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
  title: "ui/Switch",
  component: Switch,
  parameters: {
    docs: {
      description: {
        component: `A setting that changes how the thing behaves from now on — "show the mask", "lock the caliper axis".

**Use** it for an on/off that takes effect immediately, in a settings row with a \`label\` and an
optional \`description\`.

**Don't** use it to assert something about a state you are about to submit (that is \`Checkbox\`), or
for a dense layer toggle in a toolbar (that is \`ToggleChip\`).

**Accessibility**: Radix Switch — a \`<button role="switch">\` with \`aria-checked\`, toggled by Space
or Enter, inside a \`<label>\` so the label text names it and is a click target too.`,
      },
    },
  },
  args: {
    checked: false,
    onCheckedChange: fn(),
    label: "Show the mask",
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  play: async ({ canvas, args }) => {
    const toggle = canvas.getByRole("switch", { name: "Show the mask" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(canvas.getByText("Show the mask"));
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(false);
  },
};

export const On: Story = {
  args: { checked: true },
  play: async ({ canvas, args }) => {
    const toggle = canvas.getByRole("switch", { name: "Show the mask" });
    toggle.focus();
    await userEvent.keyboard(" ");
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(false);
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  },
};

export const WithDescription: Story = {
  args: {
    label: "Allow downloads",
    description: "Anyone with the link can fetch the raw frames.",
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args }) => {
    const toggle = canvas.getByRole("switch", { name: "Show the mask" });
    await expect(toggle).toBeDisabled();
    await userEvent.click(toggle, { pointerEventsCheck: 0 });
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};
