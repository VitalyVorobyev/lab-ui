import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./Button";
import { Listbox, type ListboxOption, type ListboxProps } from "./Listbox";
import { Popover } from "./Popover";

const FRAMES: ListboxOption[] = [
  { value: "f1", label: "dome_0001.bmp", description: "1280 × 1024" },
  { value: "f2", label: "dome_0002.bmp", description: "1280 × 1024" },
  { value: "f3", label: "dome_0003.bmp", description: "unreadable", disabled: true },
  { value: "f4", label: "dome_0004.bmp", description: "1280 × 1024" },
];

/** Controlled, as an app keeps it. */
function Stateful(args: ListboxProps) {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ width: 260 }}>
      <Listbox
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
      />
    </div>
  );
}

/** A frame switcher: the trigger shows the current frame, the list opens below it. */
function FrameSwitcher(args: ListboxProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(args.value);
  const label = FRAMES.find((frame) => frame.value === value)?.label ?? "no frame";
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      aria-label="Choose a frame"
      className="w-64"
      trigger={<Button variant="secondary">{label}</Button>}
    >
      <Listbox
        {...args}
        value={value}
        autoFocus
        onValueChange={(next) => {
          setValue(next);
          setOpen(false);
          args.onValueChange?.(next);
        }}
      />
    </Popover>
  );
}

const meta = {
  title: "ui/Listbox",
  component: Listbox,
  parameters: {
    docs: {
      description: {
        component: `Pick one option where each option needs more than a label — a frame with its size, a model with its
point counts. Shown in place, in a panel, or inside a \`Popover\` behind a trigger. \`renderOption\` draws an option's
content; the row keeps its padding, its states (selected is a fill, active an outline) and its accessibility.

**Use** it for a choice that is browsed: thumbnails, metadata, a list a person scans.

**Don't** use it to pick a value by name in a form (that is \`Select\`) or for commands (that is \`DropdownMenu\`).

**Accessibility**: one tab stop (\`role="listbox"\`, named by \`aria-label\`). Arrow keys, Home, End and Page keys move
the active option (\`aria-activedescendant\`), skipping disabled ones; Enter or Space chooses it.`,
      },
    },
  },
  args: { options: FRAMES, value: "f2", onValueChange: fn(), "aria-label": "Frames" },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof Listbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const list = canvas.getByRole("listbox", { name: "Frames" });
    await expect(canvas.getByRole("option", { name: /dome_0002/ })).toHaveAttribute("aria-selected", "true");
    // The cursor starts on the selected option.
    await expect(list.getAttribute("aria-activedescendant")).toBe(
      canvas.getByRole("option", { name: /dome_0002/ }).id,
    );
  },
};

export const Keyboard: Story = {
  play: async ({ canvas, args }) => {
    const list = canvas.getByRole("listbox", { name: "Frames" });
    list.focus();
    // Down from 2 skips the disabled 3 and lands on 4.
    await userEvent.keyboard("{ArrowDown}");
    await expect(list.getAttribute("aria-activedescendant")).toBe(
      canvas.getByRole("option", { name: /dome_0004/ }).id,
    );
    await userEvent.keyboard("{Enter}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("f4");
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard(" ");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("f1");
    await userEvent.keyboard("{End}{PageUp}{PageDown}");
    await expect(list.getAttribute("aria-activedescendant")).toBe(
      canvas.getByRole("option", { name: /dome_0004/ }).id,
    );
  },
};

export const Pointer: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("option", { name: /dome_0001/ }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith("f1");
    // A disabled option is shown but not chosen.
    await userEvent.click(canvas.getByRole("option", { name: /dome_0003/ }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole("option", { name: /dome_0003/ })).toHaveAttribute("aria-disabled", "true");
  },
};

export const RichOptions: Story = {
  args: {
    value: "f1",
    renderOption: (option, { selected }) => (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span aria-hidden className="size-8 shrink-0 rounded-control bg-canvas" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{option.label}</span>
        <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{selected ? "current" : option.description}</span>
      </span>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("option", { name: /dome_0001/ })).toHaveTextContent("current");
  },
};

/** Behind a trigger, as a frame switcher uses it: the list takes focus when it opens. */
export const InPopover: Story = {
  render: (args) => <FrameSwitcher {...args} />,
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "dome_0002.bmp" }));
    const body = within(document.body);
    const list = await body.findByRole("listbox", { name: "Frames" });
    await waitFor(() => expect(list).toHaveFocus());
    await userEvent.keyboard("{ArrowUp}{Enter}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("f1");
    await waitFor(() => expect(body.queryByRole("listbox")).toBeNull());
    await expect(canvas.getByRole("button", { name: "dome_0001.bmp" })).toBeVisible();
  },
};
