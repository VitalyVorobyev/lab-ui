import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { DensityProvider } from "./Density";
import { Field } from "./Field";
import { NumberInput, type NumberInputProps } from "./Input";

/** Controlled, as in a form: the story keeps the text and reports each change. */
function Stateful(args: NumberInputProps) {
  const [value, setValue] = useState(String(args.value ?? ""));
  return (
    <div style={{ width: 240 }}>
      <Field label="Focal length" description="Nominal, from the lens datasheet.">
        <NumberInput
          {...args}
          value={value}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            args.onChange?.(event);
          }}
        />
      </Field>
    </div>
  );
}

const meta = {
  title: "ui/NumberInput",
  component: NumberInput,
  parameters: {
    docs: {
      description: {
        component: `A quantity: mono, tabular figures, the schema's bounds as \`min\`/\`max\`, and optionally its \`unit\`
written inside the field after the value — muted, not part of the value. Without \`unit\` it is the plain
\`<input type="number">\`; every other prop is forwarded to the input. (The \`ui/Input\` page covers it without a
unit.)

**Use** it for any quantity with a unit (focal length in mm, distance in m, angle in °), so the unit is read
with each number instead of carried from a label.

**Don't** put the unit in the value, and don't use it for a unitless count (omit \`unit\`).

**Accessibility**: the unit is the field's description (\`aria-describedby\`), after the caller's own
\`aria-describedby\` and before a surrounding \`Field\`'s description; it is \`aria-hidden\` so a wrapping \`<label>\` does not fold it into the
field's name.`,
      },
    },
  },
  args: { unit: "mm", value: "16", step: 0.1, min: 0, onChange: fn() },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUnit: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    const input = canvas.getByRole("spinbutton", { name: "Focal length" });
    await expect(input).toHaveValue(16);
    const unit = canvasElement.querySelector("[data-unit] > span");
    await expect(unit).toHaveTextContent("mm");
    const described = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    // The unit, then the surrounding Field's description.
    await expect(described).toHaveLength(2);
    await expect(described[0]).toBe(unit?.id);
    await expect(input).toHaveAccessibleDescription("mm Nominal, from the lens datasheet.");
    await expect(input.style.paddingInlineEnd).toContain("2ch");

    await userEvent.clear(input);
    await userEvent.type(input, "25.5");
    await expect(input).toHaveValue(25.5);
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const WithoutUnit: Story = {
  args: { unit: undefined },
  play: async ({ canvas, canvasElement }) => {
    const input = canvas.getByRole("spinbutton", { name: "Focal length" });
    await expect(canvasElement.querySelector("[data-unit]")).toBeNull();
    await expect(input).toHaveAccessibleDescription("Nominal, from the lens datasheet.");
  },
};

export const OwnDescription: Story = {
  args: { unit: "°", "aria-describedby": "tilt-hint" },
  render: (args) => (
    <div style={{ width: 240 }} className="flex flex-col gap-1">
      <NumberInput {...args} aria-label="Tilt" value="1.5" onChange={args.onChange} />
      <span id="tilt-hint" className="text-xs text-fg-muted">
        Scheimpflug tilt about x.
      </span>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("spinbutton", { name: "Tilt" })).toHaveAccessibleDescription(
      "Scheimpflug tilt about x. °",
    );
  },
};

export const Compact: Story = {
  render: (args) => (
    <DensityProvider value="compact">
      <Stateful {...args} />
    </DensityProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("spinbutton").className).toContain("h-7");
  },
};
