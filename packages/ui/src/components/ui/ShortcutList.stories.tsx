import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ShortcutList, type ShortcutGroup } from "./ShortcutList";

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["J", "↓"], description: "Next image" },
      { keys: ["K", "↑"], description: "Previous image" },
      { keys: ["0"], description: "Fit to window" },
    ],
  },
  {
    title: "Review",
    shortcuts: [
      { keys: ["1", "2", "3"], description: "Verdict: ok, issues, unusable" },
      { keys: ["W"], description: "Flag a wrong id" },
      { keys: ["⇧ click"], description: "Pin a missed marker" },
    ],
  },
];

const meta = {
  title: "ui/ShortcutList",
  component: ShortcutList,
  parameters: {
    docs: {
      description: {
        component: `The keyboard shortcuts of a screen, as titled groups: each row the keys of a command,
as \`Kbd\` caps, beside what it does. Groups flow into two columns where there is room.

**Use** it for a screen's \`?\` help (inside a \`Dialog\`) or a shortcuts section in a panel. Each
\`Shortcut\` takes \`keys\` (alternatives: \`["J", "↓"]\` reads "J or ↓"; write a chord as one entry,
\`⌘K\`) and a short \`description\`. Empty groups are left out.

**Don't** expect it to bind anything: the keys are the app's to handle. A shortcut next to one
command belongs in that command's tooltip or menu item (\`MenuItem\`'s \`shortcut\`).

**Accessibility**: each group is a \`<section>\` labelled by its heading, and its rows a description
list (\`<dt>\` the keys, \`<dd>\` the command).`,
      },
    },
  },
  args: { groups: GROUPS },
} satisfies Meta<typeof ShortcutList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Groups: Story = {
  play: async ({ canvas }) => {
    const review = canvas.getByRole("region", { name: "Review" });
    const keys = within(review).getAllByText(/^[123]$/);
    await expect(keys.map((key) => key.tagName)).toEqual(["KBD", "KBD", "KBD"]);
    await expect(within(review).getByText("Pin a missed marker").tagName).toBe("DD");
    await expect(canvas.getAllByText("or")).toHaveLength(4);
  },
};

export const EmptyGroupLeftOut: Story = {
  args: { groups: [...GROUPS, { title: "Drawing", shortcuts: [] }] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("region", { name: "Drawing" })).toBeNull();
    await expect(canvas.getAllByRole("region")).toHaveLength(2);
  },
};

function HelpDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Keyboard shortcuts</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Keyboard shortcuts" className="max-w-2xl">
        <ShortcutList groups={GROUPS} />
      </Dialog>
    </>
  );
}

/** The usual place: a `?` help dialog. */
export const InDialog: Story = {
  render: () => <HelpDialog />,
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Keyboard shortcuts" }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(within(dialog).getByRole("region", { name: "Navigation" })).toBeVisible();
  },
};
