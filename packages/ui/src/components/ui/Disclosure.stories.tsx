import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Disclosure } from "./Disclosure";

const meta = {
  title: "ui/Disclosure",
  component: Disclosure,
  parameters: {
    docs: {
      description: {
        component: `Content folded away behind a summary line, with a caret that rotates with the open state.

**Use** it for secondary detail a reader may want — advanced options, the list behind a count.
\`count\` is for when the number is the reason to open it.

**Don't** hide anything needed to answer the question on screen, and don't use it for
navigation between views (that is \`Tabs\`).

**Accessibility**: a native \`<details>\`/\`<summary>\`, so the semantics, keyboard behaviour
(Enter/Space on the summary) and find-in-page come from the element itself; the caret is
\`aria-hidden\`.`,
      },
    },
  },
  args: {
    summary: "Advanced options",
    children: <p className="text-sm text-fg-muted">Subpixel refinement window: 5 px.</p>,
  },
} satisfies Meta<typeof Disclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvas }) => {
    const summary = canvas.getByText("Advanced options");
    const details = summary.closest("details");
    await expect(details).not.toHaveAttribute("open");
    await userEvent.click(summary);
    await expect(details).toHaveAttribute("open");
    await expect(canvas.getByText("Subpixel refinement window: 5 px.")).toBeVisible();
  },
};

export const Open: Story = { args: { defaultOpen: true } };

export const WithCount: Story = {
  args: {
    summary: "Overrides",
    count: 3,
    children: (
      <ul className="text-sm text-fg-muted">
        <li>threshold</li>
        <li>min area</li>
        <li>kernel</li>
      </ul>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("3")).toBeInTheDocument();
  },
};

export const KeyboardReachable: Story = {
  play: async ({ canvas }) => {
    // The native <summary> is a tab stop; Enter/Space toggling is the browser's own
    // (trusted-event) behaviour, which synthetic key events cannot trigger.
    const summary = canvas.getByText("Advanced options");
    summary.focus();
    await expect(summary).toHaveFocus();
  },
};
