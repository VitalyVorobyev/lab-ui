import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, userEvent, waitFor } from "storybook/test";

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

**Number-valued**: pass \`onValueChange\` and \`value\` becomes a number (\`null\` shows empty). The field keeps the
text being typed while it has focus and reports only finite numbers inside \`[min, max]\`, so clearing a field to
retype it never passes through 0; Escape restores the value it had on focus, \`precision\` sets the decimals shown at
rest, and \`onClear\` (optional) hears a field committed empty.

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

/** A number-valued field, as an ROI or datum editor keeps it: at least 10 px wide. */
function NumberValued({ initial, nullable }: { initial: number | null; nullable: boolean }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <div style={{ width: 240 }} className="flex flex-col gap-1">
      <Field label="Width">
        <NumberInput
          unit="px"
          precision={1}
          min={10}
          value={value}
          onValueChange={(next) => {
            reported(next);
            setValue(next);
          }}
          onClear={
            nullable
              ? () => {
                  cleared();
                  setValue(null);
                }
              : undefined
          }
        />
      </Field>
      <output className="font-mono text-xs text-fg-muted">value: {value === null ? "none" : value}</output>
    </div>
  );
}

const reported = fn();
const cleared = fn();

/*
 * Edit as a person does, through plain DOM events: user-event rewrites a number field's value
 * to its shortest form (see VectorInput's stories), which would hide the formatting under test.
 */
async function edit(field: HTMLElement, text: string) {
  await fireEvent.focusIn(field);
  await fireEvent.change(field, { target: { value: text } });
}

export const NumberValuedEditing: Story = {
  render: () => <NumberValued initial={320} nullable={false} />,
  play: async ({ canvas }) => {
    reported.mockClear();
    const input = canvas.getByRole("spinbutton", { name: "Width" });
    // At rest: the value at `precision`.
    await expect(input).toHaveDisplayValue("320.0");
    // Clearing to retype reports nothing: the value stays 320.
    await edit(input, "");
    await expect(reported).not.toHaveBeenCalled();
    await expect(canvas.getByText("value: 320")).toBeVisible();
    // Each keystroke that parses to a number inside [min, max] is reported; "4" on the way to
    // "48" is below the minimum, so it is not.
    await fireEvent.change(input, { target: { value: "4" } });
    await expect(reported).not.toHaveBeenCalled();
    await fireEvent.change(input, { target: { value: "48" } });
    await expect(reported).toHaveBeenLastCalledWith(48);
    // Enter shows the value at `precision`, still editing.
    await fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(input).toHaveDisplayValue("48.0"));
    // Escape restores the value on focus.
    await fireEvent.keyDown(input, { key: "Escape" });
    await expect(reported).toHaveBeenLastCalledWith(320);
    await waitFor(() => expect(input).toHaveDisplayValue("320.0"));
    await fireEvent.focusOut(input);
  },
};

export const NumberValuedEmpty: Story = {
  render: () => <NumberValued initial={12.5} nullable={false} />,
  play: async ({ canvas }) => {
    reported.mockClear();
    const input = canvas.getByRole("spinbutton", { name: "Width" });
    // Without `onClear` an emptied field is not a value: leaving it shows the value again.
    await edit(input, "");
    await fireEvent.focusOut(input);
    await expect(reported).not.toHaveBeenCalled();
    await waitFor(() => expect(input).toHaveDisplayValue("12.5"));
    // Enter on an empty field shows the value too, and out-of-range text reverts on leaving.
    await edit(input, "");
    await fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(input).toHaveDisplayValue("12.5"));
    await fireEvent.change(input, { target: { value: "3" } });
    await fireEvent.focusOut(input);
    await waitFor(() => expect(input).toHaveDisplayValue("12.5"));
    // Keys while not editing do nothing.
    await fireEvent.keyDown(input, { key: "Escape" });
    await fireEvent.keyDown(input, { key: "Enter" });
    await expect(reported).not.toHaveBeenCalled();
  },
};

export const NumberValuedNullable: Story = {
  render: () => <NumberValued initial={null} nullable />,
  play: async ({ canvas }) => {
    reported.mockClear();
    cleared.mockClear();
    const input = canvas.getByRole("spinbutton", { name: "Width" });
    await expect(input).toHaveDisplayValue("");
    await expect(canvas.getByText("value: none")).toBeVisible();
    await edit(input, "70");
    await fireEvent.focusOut(input);
    await waitFor(() => expect(input).toHaveDisplayValue("70.0"));
    // With `onClear`, an emptied field is committed as unset.
    await edit(input, "");
    await fireEvent.focusOut(input);
    await expect(cleared).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(canvas.getByText("value: none")).toBeVisible());
    // Escape back to an unset value clears it again.
    await edit(input, "25");
    await fireEvent.keyDown(input, { key: "Escape" });
    await expect(cleared).toHaveBeenCalledTimes(2);
    await fireEvent.focusOut(input);
    // Enter on an emptied, cleared field keeps it empty.
    await edit(input, "40");
    await fireEvent.change(input, { target: { value: "" } });
    await fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(input).toHaveDisplayValue(""));
  },
};
