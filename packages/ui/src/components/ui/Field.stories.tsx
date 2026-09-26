import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { DensityProvider } from "./Density";
import { Field } from "./Field";
import { Input, NumberInput } from "./Input";

const meta = {
  title: "ui/Field",
  component: Field,
  parameters: {
    docs: {
      description: {
        component: `A labelled control: label, optional required marker and annotation, the control, then its
description and error.

**Use** it around every form control. \`annotation\` is a compact fact about the accepted values
(a range, a unit) kept out of the prose; \`description\` is what a reader needs to answer.
\`as="group"\` labels a set of controls (radios, a segmented control) that a \`<label>\` cannot.

**Don't** put a tooltip where a description belongs — anything needed to answer stays visible.
Don't use the default \`label\` wrapper around more than one control.

**Accessibility**: the default wraps the control in a \`<label>\`, so it is named by the label
text. \`as="group"\` renders \`role="group"\` with \`aria-label\`. The error is \`role="alert"\`. The
description gets an id, but the caller's control must reference it itself via
\`aria-describedby\` — the field does not pass it down. The required marker is a \`*\` with a
\`title\`, not \`aria-required\` on the control.`,
      },
    },
  },
  args: { label: "Threshold", children: <Input defaultValue="0.5" /> },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "Threshold" });
    await userEvent.clear(input);
    await userEvent.type(input, "0.7");
    await expect(input).toHaveValue("0.7");
  },
};

export const WithDescription: Story = {
  args: { description: "Scores above this are reported as defects." },
};

export const Required: Story = {
  args: { label: "Dataset name", required: true, children: <Input placeholder="bolts-2024" /> },
};

export const WithAnnotation: Story = {
  args: {
    label: "Kernel size",
    annotation: "3–31 px",
    children: <NumberInput min={3} max={31} defaultValue={5} />,
  },
};

export const WithError: Story = {
  args: {
    label: "Kernel size",
    annotation: "3–31 px",
    error: "Must be an odd number.",
    children: <NumberInput min={3} max={31} defaultValue={4} />,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Must be an odd number.");
  },
};

export const Group: Story = {
  args: {
    label: "Image size",
    as: "group",
    children: (
      <div className="flex gap-2">
        <Input aria-label="Width" defaultValue="1920" />
        <Input aria-label="Height" defaultValue="1080" />
      </div>
    ),
  },
  play: async ({ canvas }) => {
    const group = canvas.getByRole("group", { name: "Image size" });
    await expect(group).toBeInTheDocument();
  },
};

export const Compact: Story = {
  args: { description: "Scores above this are reported as defects." },
  render: (args) => (
    <DensityProvider value="compact">
      <Field {...args} />
    </DensityProvider>
  ),
};
