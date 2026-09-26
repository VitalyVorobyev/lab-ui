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

/** The strip wired to the one panel it controls, through `idPrefix`. */
function PanelledTabs(props: ComponentProps<typeof Tabs<View>>) {
  const [active, setActive] = useState(props.active);
  const prefix = props.idPrefix ?? "tabs";
  return (
    <div className="flex flex-col gap-3">
      <Tabs {...props} active={active} onSelect={setActive} />
      <div
        role="tabpanel"
        id={`${prefix}-panel-${active}`}
        aria-labelledby={`${prefix}-tab-${active}`}
        className="text-sm text-fg-muted"
      >
        The {active} view.
      </div>
    </div>
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

**Accessibility**: a \`tablist\` named by \`label\`, of \`tab\` buttons with \`aria-selected\` and
\`data-state\`. Roving focus: the strip is one Tab stop (the active tab); ←/→ move to the previous or
next enabled tab and select it, Home/End jump to the ends, disabled tabs are skipped. Pass
\`idPrefix\` and render the panel with the matching ids to get \`aria-controls\`/\`aria-labelledby\`
(see *WithPanel*). A disabled tab's \`title\` is not reachable by keyboard.`,
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
    const images = canvas.getByRole("tab", { name: /Images/ });
    const labels = canvas.getByRole("tab", { name: "Labels" });
    const options = canvas.getByRole("tab", { name: /Options/ });
    // One tab stop: only the active tab is in the tab order.
    await expect(images).toHaveAttribute("tabindex", "0");
    await expect(labels).toHaveAttribute("tabindex", "-1");

    images.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(args.onSelect).toHaveBeenCalledWith("labels");
    await expect(labels).toHaveFocus();
    await expect(labels).toHaveAttribute("aria-selected", "true");

    // The disabled History tab is skipped: past Options the focus wraps to Images.
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(images).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(options).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(images).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(options).toHaveFocus();
    await expect(options).toHaveAttribute("data-state", "active");

    // Keys other than the arrows and Home/End are left alone; Enter still activates.
    await userEvent.keyboard("{ArrowUp}");
    await expect(options).toHaveFocus();
    labels.focus();
    await userEvent.keyboard("{Enter}");
    await expect(labels).toHaveAttribute("aria-selected", "true");
  },
};

export const WithPanel: Story = {
  args: { idPrefix: "dataset" },
  render: (args) => <PanelledTabs {...args} />,
  play: async ({ canvas }) => {
    const images = canvas.getByRole("tab", { name: /Images/ });
    await expect(images).toHaveAttribute("aria-controls", "dataset-panel-images");
    await expect(canvas.getByRole("tabpanel", { name: /Images/ })).toHaveTextContent("The images view.");
    await userEvent.click(canvas.getByRole("tab", { name: "Labels" }));
    await expect(canvas.getByRole("tabpanel", { name: "Labels" })).toHaveTextContent("The labels view.");
    await expect(images).not.toHaveAttribute("aria-controls");
  },
};

export const DisabledActive: Story = {
  args: { active: "history" },
  play: async ({ canvas }) => {
    // The active tab cannot take focus, so the first enabled tab keeps the strip reachable.
    await expect(canvas.getByRole("tab", { name: /Images/ })).toHaveAttribute("tabindex", "0");
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
