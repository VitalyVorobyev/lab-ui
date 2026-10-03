import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Kbd } from "./Kbd";

const meta = {
  title: "ui/Kbd",
  component: Kbd,
  parameters: {
    docs: {
      description: {
        component: `A key as the keyboard labels it — next to a command, in a hint, in a tooltip.

**Use** one \`Kbd\` per key or chord (\`⌘K\` reads better as one cap than as two).

**Don't** use it for code or values (that is mono text).

**Accessibility**: renders \`<kbd>\`, announced as its text.`,
      },
    },
  },
  args: { children: "F" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Key: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("F").tagName).toBe("KBD");
  },
};

export const InHint: Story = {
  render: () => (
    <p className="text-xs text-fg-muted">
      Step frames with <Kbd>[</Kbd> and <Kbd>]</Kbd>, frame the selection with <Kbd>F</Kbd>, open the palette with{" "}
      <Kbd>⌘K</Kbd>.
    </p>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("⌘K")).toBeVisible();
  },
};
