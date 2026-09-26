import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { Slider } from "./Slider";

/**
 * Holds the value, so the story behaves like the control it stands in for. When the story
 * gives a `readout`, it is replaced by the live value, as a consumer would render it.
 */
function Controlled(props: ComponentProps<typeof Slider>) {
  const [value, setValue] = useState(props.value);
  return (
    <div className="flex w-80">
      <Slider
        {...props}
        value={value}
        readout={
          props.readout === undefined ? undefined : (
            <span className="inline-block w-10">{value.toFixed(2)}</span>
          )
        }
        onValueChange={(next) => {
          setValue(next);
          props.onValueChange(next);
        }}
      />
    </div>
  );
}

const meta = {
  title: "ui/Slider",
  component: Slider,
  parameters: {
    docs: {
      description: {
        component: `A continuous value with its number on screen beside the track.

**Use** it for a value that drives what you are looking at — a results threshold, an overlay
opacity — where the position and the number both matter. Pass \`readout\` (a fixed-width mono span)
so the number is always visible; \`onValueCommit\` fires once on release, for expensive updates.

**Don't** use it where the exact number is typed more often than dragged (that is \`NumberInput\`), or
for a discrete choice of a few values (that is \`SegmentedControl\`).

**Accessibility**: Radix Slider — the thumb is a \`role="slider"\` with \`aria-valuenow/min/max\`,
moved by arrow keys, Page Up/Down and Home/End. \`aria-label\` is set on the slider root.`,
      },
    },
  },
  args: {
    value: 0.5,
    onValueChange: fn(),
    onValueCommit: fn(),
    readout: "0.50",
    "aria-label": "Threshold",
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithReadout: Story = {
  play: async ({ canvas, args }) => {
    const thumb = canvas.getByRole("slider");
    await expect(thumb).toHaveAttribute("aria-valuenow", "0.5");
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(0.51);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(0.51);
    await expect(thumb).toHaveAttribute("aria-valuenow", "0.51");
    await expect(canvas.getByText("0.51")).toBeVisible();
    await userEvent.keyboard("{Home}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(0);
  },
};

export const WithoutReadout: Story = { args: { readout: undefined } };

export const IntegerRange: Story = {
  args: { value: 40, min: 0, max: 255, step: 1, readout: "40", "aria-label": "Search range" },
  play: async ({ canvas }) => {
    const thumb = canvas.getByRole("slider");
    await expect(thumb).toHaveAttribute("aria-valuemin", "0");
    await expect(thumb).toHaveAttribute("aria-valuemax", "255");
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args }) => {
    const thumb = canvas.getByRole("slider");
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
