import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Select } from "./Select";

/** Holds the value, so the story behaves like the form field it stands in for. */
function Controlled(props: ComponentProps<typeof Select>) {
  const [value, setValue] = useState(props.value);
  return (
    <div className="w-64">
      <Select
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          props.onValueChange(next);
        }}
      />
    </div>
  );
}

const meta = {
  title: "ui/Select",
  component: Select,
  parameters: {
    docs: {
      description: {
        component: `A picker whose option list is styled with the app, with room for a quiet note per option.

**Use** it for a closed set too long for a \`SegmentedControl\`, or whose options need a note (a
strategy, a count) or a disabled entry with a reason. \`""\` means unset and shows the
\`placeholder\`; \`unsetLabel\` adds a leading entry that returns the field to \`""\`.

**Don't** use it for two or three short options (that is \`SegmentedControl\`) or for free text.

**Accessibility**: Radix Select — a \`combobox\` trigger opening a \`listbox\`, operable by keyboard
(Enter/Space/arrows to open and move, typeahead, Escape to close). The trigger needs a name: an
\`aria-label\`, or a \`<label>\` via \`Field\`.`,
      },
    },
  },
  args: {
    value: "",
    onValueChange: fn(),
    "aria-label": "Backbone",
    options: [
      { value: "resnet18", label: "ResNet-18", note: "11M" },
      { value: "wide_resnet50", label: "Wide ResNet-50", note: "69M" },
      { value: "vit_b16", label: "ViT-B/16", note: "needs GPU", disabled: true },
    ],
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unset: Story = {
  play: async ({ canvas, args }) => {
    const trigger = canvas.getByRole("combobox", { name: "Backbone" });
    await expect(trigger).toHaveTextContent("Choose…");

    await userEvent.click(trigger);
    const body = within(document.body);
    await expect(await body.findByRole("listbox")).toBeVisible();
    await expect(body.getByRole("option", { name: /ViT-B\/16/ })).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(body.getByRole("option", { name: /Wide ResNet-50/ }));
    await expect(args.onValueChange).toHaveBeenCalledWith("wide_resnet50");
    await waitFor(() => expect(body.queryByRole("listbox")).toBeNull());
    await expect(trigger).toHaveTextContent("Wide ResNet-50");
  },
};

export const Selected: Story = {
  args: { value: "resnet18" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Backbone" })).toHaveTextContent("ResNet-18");
  },
};

export const Keyboard: Story = {
  args: { value: "resnet18" },
  play: async ({ canvas, args }) => {
    const trigger = canvas.getByRole("combobox", { name: "Backbone" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(document.body);
    await expect(await body.findByRole("listbox")).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    await expect(args.onValueChange).toHaveBeenCalledWith("wide_resnet50");
    await waitFor(() => expect(body.queryByRole("listbox")).toBeNull());
  },
};

export const WithUnsetEntry: Story = {
  args: { value: "resnet18", unsetLabel: "Use the default" },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Backbone" }));
    const body = within(document.body);
    await userEvent.click(await body.findByRole("option", { name: "Use the default" }));
    // The sentinel never leaks: callers only ever see "".
    await expect(args.onValueChange).toHaveBeenCalledWith("");
    await waitFor(() => expect(body.queryByRole("listbox")).toBeNull());
    // Back to unset: still controlled, and the trigger shows the placeholder again.
    await expect(canvas.getByRole("combobox", { name: "Backbone" })).toHaveTextContent("Choose…");
  },
};

export const Open: Story = {
  args: { value: "resnet18" },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Backbone" }));
    await expect(await within(document.body).findByRole("listbox")).toBeVisible();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Backbone" })).toBeDisabled();
  },
};
