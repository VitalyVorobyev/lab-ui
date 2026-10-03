import type { Meta, StoryObj } from "@storybook/react-vite";
import { Layers, Trash2 } from "lucide-react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./Button";
import { DropdownMenu, MenuCheckboxItem, MenuItem, MenuLabel, MenuSeparator } from "./DropdownMenu";

const meta = {
  title: "ui/DropdownMenu",
  component: DropdownMenu,
  parameters: {
    docs: {
      description: {
        component: `A menu of commands and toggles behind a trigger — a canvas's layers menu, a row's overflow menu.
\`MenuCheckboxItem\` switches something on or off and leaves the menu open for the next one; \`MenuItem\` runs a
command and closes it. \`shortcut\` shows a key as a \`Kbd\`; binding the key is the app's.

**Use** it for things a person does or switches.

**Don't** use it to pick one value from a set (that is \`Select\`, or a \`Listbox\` in a \`Popover\`).

**Accessibility**: Radix DropdownMenu — \`role="menu"\` with \`menuitem\` / \`menuitemcheckbox\` items, arrow keys,
typeahead, Escape to close, focus returned to the trigger.`,
      },
    },
  },
  args: {
    trigger: (
      <Button variant="secondary" icon={<Layers />}>
        Layers
      </Button>
    ),
    children: null,
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const reset = fn();
const remove = fn();

function LayersMenu() {
  const [layers, setLayers] = useState({ region: true, contours: true, dropped: false, points: false });
  const toggle = (key: keyof typeof layers) => (checked: boolean) => setLayers({ ...layers, [key]: checked });
  return (
    <DropdownMenu
      trigger={
        <Button variant="secondary" icon={<Layers />}>
          Layers
        </Button>
      }
    >
      <MenuLabel>Show</MenuLabel>
      <MenuCheckboxItem checked={layers.region} onCheckedChange={toggle("region")} shortcut="R">
        Region
      </MenuCheckboxItem>
      <MenuCheckboxItem checked={layers.contours} onCheckedChange={toggle("contours")}>
        Kept contours
      </MenuCheckboxItem>
      <MenuCheckboxItem checked={layers.dropped} onCheckedChange={toggle("dropped")}>
        Dropped contours
      </MenuCheckboxItem>
      <MenuCheckboxItem checked={layers.points} onCheckedChange={toggle("points")} disabled>
        Edge points (zoom in)
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem onSelect={reset} shortcut="0">
        Reset view
      </MenuItem>
      <MenuItem onSelect={remove} icon={<Trash2 />} tone="defect">
        Delete model
      </MenuItem>
    </DropdownMenu>
  );
}

/** Opened by the app rather than by its trigger. */
function ControlledMenu() {
  const [open, setOpen] = useState(true);
  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
      align="end"
      side="right"
      trigger={<Button variant="secondary">More</Button>}
    >
      <MenuItem>Duplicate</MenuItem>
    </DropdownMenu>
  );
}

export const Closed: Story = {
  render: () => <LayersMenu />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Layers" })).toHaveAttribute("aria-expanded", "false");
  },
};

export const Open: Story = {
  render: () => <LayersMenu />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Layers" }));
    const menu = await within(document.body).findByRole("menu");
    await expect(menu).toBeVisible();
    await expect(within(menu).getByRole("menuitemcheckbox", { name: /Region/ })).toHaveAttribute("aria-checked", "true");
    await expect(within(menu).getByRole("menuitemcheckbox", { name: /Edge points/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  },
};

export const ToggleKeepsItOpen: Story = {
  render: () => <LayersMenu />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Layers" }));
    const body = within(document.body);
    const dropped = await body.findByRole("menuitemcheckbox", { name: "Dropped contours" });
    await userEvent.click(dropped);
    await waitFor(() => expect(dropped).toHaveAttribute("aria-checked", "true"));
    // Still open for the next toggle.
    await expect(body.getByRole("menu")).toBeVisible();
  },
};

export const CommandClosesIt: Story = {
  render: () => <LayersMenu />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Layers" });
    await userEvent.click(trigger);
    const body = within(document.body);
    await userEvent.click(await body.findByRole("menuitem", { name: /Reset view/ }));
    await expect(reset).toHaveBeenCalled();
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull());

    // Keyboard: open, walk to the destructive command, run it.
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await body.findByRole("menu");
    await userEvent.keyboard("{End}{Enter}");
    await expect(remove).toHaveBeenCalled();
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull());
  },
};

export const Controlled: Story = {
  render: () => <ControlledMenu />,
  play: async () => {
    await expect(await within(document.body).findByRole("menuitem", { name: "Duplicate" })).toBeVisible();
  },
};
