import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { SegmentedControl } from "./SegmentedControl";

/** Holds the value, so the story behaves like the form field it stands in for. */
function Controlled(props: ComponentProps<typeof SegmentedControl>) {
  const [value, setValue] = useState(props.value);
  return (
    <SegmentedControl
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange(next);
      }}
    />
  );
}

const meta = {
  title: "ui/SegmentedControl",
  component: SegmentedControl,
  parameters: {
    docs: {
      description: {
        component: `A choice among two or three, all shown at once — no popup, no typing.

**Use** it for a small closed set the app knows up front (a model size, an axis). \`""\` means
unset: the highlighted segment is the *effective* value (\`defaultValue\` while unset), and choosing
the segment that matches the default stores \`""\` again, so the default lives in one place.

**Don't** use it for more than about three options or labels that don't fit on one line (that is
\`Select\`), or for an on/off setting (that is \`Switch\`).

**Accessibility**: native radios in one \`name\` inside a \`role="radiogroup"\`, so arrow keys move
the choice and Tab enters and leaves the group as one stop. Give the group an \`aria-label\`.`,
      },
    },
  },
  args: {
    value: "",
    defaultValue: "medium",
    options: [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
    onValueChange: fn(),
    "aria-label": "Model size",
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unset: Story = {
  play: async ({ canvas, args }) => {
    // Unset shows the default as the effective choice.
    await expect(canvas.getByRole("radio", { name: "Medium" })).toBeChecked();

    await userEvent.click(canvas.getByRole("radio", { name: "Large" }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith("large");
    await expect(canvas.getByRole("radio", { name: "Large" })).toBeChecked();

    // Choosing the default returns the field to unset.
    await userEvent.click(canvas.getByRole("radio", { name: "Medium" }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith("");
    await expect(canvas.getByRole("radio", { name: "Medium" })).toBeChecked();
  },
};

export const Selected: Story = {
  args: { value: "small" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radiogroup", { name: "Model size" })).toBeVisible();
    await expect(canvas.getByRole("radio", { name: "Small" })).toBeChecked();
  },
};

export const Keyboard: Story = {
  args: { value: "small" },
  play: async ({ canvas, args }) => {
    await userEvent.tab();
    await expect(canvas.getByRole("radio", { name: "Small" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", { name: "Medium" })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenLastCalledWith("");
  },
};

export const TwoOptions: Story = {
  args: {
    value: "",
    defaultValue: "overlay",
    options: [
      { value: "overlay", label: "Overlay" },
      { value: "side", label: "Side by side" },
    ],
    "aria-label": "Comparison layout",
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("radio", { name: "Large" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("radio", { name: "Large" }), { pointerEventsCheck: 0 });
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
