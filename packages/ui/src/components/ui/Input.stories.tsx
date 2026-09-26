import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";

import { DensityProvider } from "./Density";
import { Input, NumberInput, Textarea } from "./Input";

const meta = {
  title: "ui/Input",
  component: Input,
  parameters: {
    docs: {
      description: {
        component: `Text entry on the shared control palette and focus treatment: \`Input\` for text,
\`NumberInput\` for a quantity (mono, tabular figures, the schema's bounds as \`min\`/\`max\`),
\`Textarea\` for multi-line text.

**Use** them inside a \`Field\`, which supplies the label. The height follows the density in force.

**Don't** use \`Input type="number"\` — that is \`NumberInput\`; and don't use these for a choice from
a fixed list (that is \`Select\` or \`SegmentedControl\`).

**Accessibility**: plain native \`<input>\`/\`<textarea>\` elements with every native attribute passed
through. They carry no label of their own: wrap them in a \`Field\` or give them an \`aria-label\`.
A placeholder is not a label.`,
      },
    },
  },
  args: { "aria-label": "Dataset name", placeholder: "bolts-2024", onChange: fn() },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole("textbox", { name: "Dataset name" });
    await userEvent.type(input, "nuts");
    await expect(input).toHaveValue("nuts");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const WithValue: Story = { args: { defaultValue: "bolts-2024" } };

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "bolts-2024" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toBeDisabled();
  },
};

export const Compact: Story = {
  render: (args) => (
    <DensityProvider value="compact">
      <Input {...args} />
    </DensityProvider>
  ),
};

export const NumberEntry: Story = {
  render: () => <NumberInput aria-label="Kernel size" min={3} max={31} step={2} defaultValue={5} />,
  play: async ({ canvas }) => {
    const input = canvas.getByRole("spinbutton", { name: "Kernel size" });
    await expect(input).toHaveAttribute("min", "3");
    await expect(input).toHaveAttribute("max", "31");
    await userEvent.clear(input);
    await userEvent.type(input, "7");
    await expect(input).toHaveValue(7);
  },
};

export const MultiLine: Story = {
  render: () => <Textarea aria-label="Notes" rows={4} defaultValue={"frame 7: out of focus\nframe 12: glare"} />,
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole("textbox", { name: "Notes" });
    await userEvent.type(textarea, "{enter}frame 15: ok");
    await expect(textarea).toHaveValue("frame 7: out of focus\nframe 12: glare\nframe 15: ok");
  },
};
