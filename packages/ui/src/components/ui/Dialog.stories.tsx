import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./Button";
import { ConfirmDialog, Dialog, DialogClose } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";

/** The dialog is controlled; this keeps its `open` in state and reports every change. */
function StatefulDialog(props: ComponentProps<typeof Dialog>) {
  const [open, setOpen] = useState(props.open);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        {...props}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          props.onOpenChange(next);
        }}
      />
    </>
  );
}

function StatefulConfirm(props: ComponentProps<typeof ConfirmDialog>) {
  const [open, setOpen] = useState(props.open);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete dataset
      </Button>
      <ConfirmDialog
        {...props}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          props.onOpenChange(next);
        }}
      />
    </>
  );
}

const meta = {
  title: "ui/Dialog",
  component: Dialog,
  parameters: {
    docs: {
      description: {
        component: `A modal: a title, a body the caller fills, and a footer it chooses. \`ConfirmDialog\` is the
destructive-action confirmation arrangement of it; \`DialogClose\` wraps a footer button that
dismisses it.

**Use** \`ConfirmDialog\` before anything that cannot be undone (deleting a dataset, discarding a
measurement session), with a description naming the thing by the name the reader gave it.
Use \`Dialog\` for a short form that must be answered before going on.

**Don't** use a modal for information that could sit on the page, or for a flow long enough to
deserve its own screen. It is controlled — the caller owns \`open\`.

**Accessibility**: Radix Dialog — \`role="dialog"\`, \`aria-modal\`, focus trapped inside and
returned to the trigger on close, Escape and an overlay click dismiss. The title names the
dialog; the description describes it (when none is given, the title is repeated in a
visually hidden description). The body scrolls under a height cap so the footer stays on screen.`,
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    title: "Rename dataset",
    children: (
      <Field label="Name">
        <Input defaultValue="bolts-2024" />
      </Field>
    ),
    footer: (
      <>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button variant="primary">Save</Button>
      </>
    ),
  },
  render: (args) => <StatefulDialog {...args} />,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "Rename dataset" });
    await expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("bolts-2024");
    // A body that fits adds no tab stop of its own.
    await expect(dialog.querySelector("[data-overflowing]")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const WithDescription: Story = {
  args: { description: "The new name is used in every report generated from now on." },
  play: async () => {
    const dialog = await within(document.body).findByRole("dialog", { name: "Rename dataset" });
    await expect(dialog).toHaveAccessibleDescription(
      "The new name is used in every report generated from now on.",
    );
  },
};

export const EscapeCloses: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    await body.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const Closed: Story = {
  args: { open: false },
  play: async ({ canvas }) => {
    const body = within(document.body);
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Open dialog" }));
    await expect(await body.findByRole("dialog", { name: "Rename dataset" })).toBeInTheDocument();
  },
};

export const LongBody: Story = {
  args: {
    title: "Frames skipped",
    footer: (
      <DialogClose asChild>
        <Button variant="primary">Done</Button>
      </DialogClose>
    ),
    children: (
      <ul className="text-sm text-fg-muted">
        {Array.from({ length: 60 }, (_, index) => (
          <li key={index}>frame {index + 1}: board not found</li>
        ))}
      </ul>
    ),
  },
  play: async () => {
    const dialog = await within(document.body).findByRole("dialog", { name: "Frames skipped" });
    // The scroll region: the list's wrapper's parent. Where it overflows its cap (with the
    // package CSS applied it does), it is a tab stop, so a keyboard can scroll it.
    const region = dialog.querySelector("ul")!.parentElement!.parentElement!;
    await waitFor(async () => {
      const overflowing = region.scrollHeight > region.clientHeight + 1;
      await expect({
        marked: region.hasAttribute("data-overflowing"),
        tabindex: region.getAttribute("tabindex"),
      }).toEqual({ marked: overflowing, tabindex: overflowing ? "0" : null });
    });
  },
};

const onConfirm = fn();

export const Confirm: Story = {
  render: (args) => (
    <StatefulConfirm
      open={args.open}
      onOpenChange={args.onOpenChange}
      title="Delete dataset?"
      description="“bolts-2024” and its 1,204 images will be deleted. This cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      destructive
    />
  ),
  play: async () => {
    const dialog = await within(document.body).findByRole("dialog", { name: "Delete dataset?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await expect(onConfirm).toHaveBeenCalledOnce();
  },
};

export const ConfirmCancel: Story = {
  render: (args) => (
    <StatefulConfirm
      open={args.open}
      onOpenChange={args.onOpenChange}
      title="Discard session?"
      description="The 14 measurements taken in this session will be lost."
      confirmLabel="Discard"
      onConfirm={fn()}
    />
  ),
  play: async ({ args }) => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "Discard session?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const ConfirmLoading: Story = {
  render: (args) => (
    <StatefulConfirm
      open={args.open}
      onOpenChange={args.onOpenChange}
      title="Delete dataset?"
      description="“bolts-2024” and its 1,204 images will be deleted. This cannot be undone."
      confirmLabel="Delete"
      onConfirm={fn()}
      destructive
      loading
    />
  ),
  play: async () => {
    const dialog = await within(document.body).findByRole("dialog", { name: "Delete dataset?" });
    const confirm = within(dialog).getByRole("button", { name: "Delete" });
    await expect(confirm).toHaveAttribute("aria-busy", "true");
    await expect(confirm).toBeDisabled();
  },
};
