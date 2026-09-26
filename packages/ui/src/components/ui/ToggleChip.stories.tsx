import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { ToggleChip } from "./ToggleChip";

/** Holds the checked state, so the story behaves like the layer toggle it stands in for. */
function Controlled(props: ComponentProps<typeof ToggleChip>) {
  const [checked, setChecked] = useState(props.checked);
  return (
    <ToggleChip
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
  title: "ui/ToggleChip",
  component: ToggleChip,
  parameters: {
    docs: {
      description: {
        component: `A dense on/off for a thing drawn on screen — an overlay layer, a chart series — in a toolbar's space.

**Use** it in a row over a canvas or chart. \`swatch\` shows the colour the layer is drawn in, so the
control is also the legend. \`title\` can say why it is disabled or what the layer is.

**Don't** use it for a setting with a description (that is \`Switch\`) or for a statement in a form
(that is \`Checkbox\`).

**Accessibility**: a native \`<button role="switch">\` with \`aria-checked\`, named by its text; the
swatch is \`aria-hidden\`, so colour is never the only label. \`title\` is a hover hint, never the only
explanation.`,
      },
    },
  },
  args: {
    checked: true,
    onCheckedChange: fn(),
    children: "Caliper boxes",
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ToggleChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {
  play: async ({ canvas, args }) => {
    const chip = canvas.getByRole("switch", { name: "Caliper boxes" });
    await expect(chip).toHaveAttribute("aria-checked", "true");
    await userEvent.click(chip);
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(false);
    await expect(chip).toHaveAttribute("aria-checked", "false");
  },
};

export const Off: Story = {
  args: { checked: false },
  play: async ({ canvas, args }) => {
    const chip = canvas.getByRole("switch", { name: "Caliper boxes" });
    chip.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);
    await expect(chip).toHaveAttribute("aria-checked", "true");
  },
};

export const WithSwatch: Story = { args: { swatch: "#f59e0b" } };

export const WithSwatchOff: Story = { args: { swatch: "#f59e0b", checked: false } };

export const Disabled: Story = {
  args: { disabled: true, swatch: "#f59e0b", title: "No caliper results for this frame" },
  play: async ({ canvas, args }) => {
    const chip = canvas.getByRole("switch", { name: "Caliper boxes" });
    await expect(chip).toBeDisabled();
    await userEvent.click(chip, { pointerEventsCheck: 0 });
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};
