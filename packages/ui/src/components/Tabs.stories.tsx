import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";
import { expect, fn, userEvent } from "storybook/test";

import { Tabs, type TabItem } from "./Tabs";

type View = "images" | "labels" | "options" | "history";

const ITEMS: TabItem<View>[] = [
  { id: "images", label: "Images", count: 1204 },
  { id: "labels", label: "Labels" },
  { id: "options", label: "Options", count: 3 },
  { id: "history", label: "History", disabled: true, title: "No runs yet" },
];

/** Tabs are controlled; this keeps `active` in state and reports each selection. */
function StatefulTabs(props: ComponentProps<typeof Tabs<View>>) {
  const [active, setActive] = useState(props.active);
  return (
    <Tabs
      {...props}
      active={active}
      onSelect={(id) => {
        setActive(id);
        props.onSelect(id);
      }}
    />
  );
}

const meta = {
  title: "ui/Tabs",
  component: Tabs<View>,
  parameters: {
    docs: {
      description: {
        component: `A tab strip: switches between views of the same thing, with an optional count set in
mono beside each label.

**Use** \`count\` where the number behind a tab is the reason to open it (overrides, rows); a zero
count is not shown. A disabled tab can carry a \`title\` explaining why it has nothing to show.

**Don't** use it for navigation between pages (that is a link), or for a setting's value (that
is \`SegmentedControl\`). It only renders the strip — the caller renders the panel.

**Accessibility**: a \`tablist\` named by \`label\`, of \`tab\` buttons with \`aria-selected\`. It does
not implement the roving-tabindex/arrow-key pattern, and tabs do not point at a \`tabpanel\`
(\`aria-controls\`); every tab is a separate Tab stop activated by Enter/Space. A disabled tab's
\`title\` is not reachable by keyboard.`,
      },
    },
  },
  args: { items: ITEMS, active: "images", onSelect: fn(), label: "Dataset view" },
  render: (args) => <StatefulTabs {...args} />,
} satisfies Meta<typeof Tabs<View>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("tablist", { name: "Dataset view" })).toBeInTheDocument();
    const labels = canvas.getByRole("tab", { name: "Labels" });
    await expect(canvas.getByRole("tab", { name: /Images/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(labels);
    await expect(args.onSelect).toHaveBeenCalledWith("labels");
    await expect(labels).toHaveAttribute("aria-selected", "true");
  },
};

export const Keyboard: Story = {
  play: async ({ canvas, args }) => {
    const options = canvas.getByRole("tab", { name: /Options/ });
    options.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith("options");
    await expect(options).toHaveAttribute("aria-selected", "true");
  },
};

export const DisabledTab: Story = {
  play: async ({ canvas, args }) => {
    const history = canvas.getByRole("tab", { name: "History" });
    await expect(history).toBeDisabled();
    await userEvent.click(history);
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

export const WithoutCounts: Story = {
  args: {
    items: [
      { id: "images", label: "Images" },
      { id: "labels", label: "Labels" },
      { id: "options", label: "Options", count: 0 },
    ],
    active: "options",
  },
};
