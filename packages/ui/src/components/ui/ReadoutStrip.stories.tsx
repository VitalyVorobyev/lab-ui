import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AnchorHTMLAttributes } from "react";
import { expect } from "storybook/test";

import { ReadoutStrip } from "./Panel";

/** Stands in for a router's `<Link>`: an element that renders an anchor from its own props. */
function FakeRouterLink({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a data-router-link href={to} {...rest} />;
}

const meta = {
  title: "ui/ReadoutStrip",
  component: ReadoutStrip,
  parameters: {
    docs: {
      description: {
        component: `The instrument's display line: the facts about what is on screen, in one mono row.

**Use** it in the same slot on every screen for the identifiers of what is shown — run, model, frame,
resolution. An item's \`label\` is a quiet prefix for a value that is ambiguous alone; \`href\` makes
the value a plain link, and \`link\` (a router's \`<Link to="…" />\` without children) routes it
through the app's own element. Items whose value is \`null\`/\`undefined\` are dropped, and an empty
strip renders nothing.

**Don't** use it for editable values or for status that needs a colour (that is \`Badge\`).

**Accessibility**: an ordered list, one \`<li>\` per fact; the \`·\` separators are \`aria-hidden\`.`,
      },
    },
  },
  args: {
    items: [
      { label: "run", value: "12" },
      { label: "model", value: "patchcore" },
      { value: "1920×1080" },
    ],
  },
} satisfies Meta<typeof ReadoutStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};

export const WithLinks: Story = {
  args: {
    items: [
      { label: "run", value: "12", href: "/runs/12" },
      { label: "model", value: "patchcore", link: <FakeRouterLink to="/models/patchcore" /> },
      { value: "1920×1080" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "12" })).toHaveAttribute("href", "/runs/12");
    const routed = canvas.getByRole("link", { name: "patchcore" });
    await expect(routed).toHaveAttribute("href", "/models/patchcore");
    await expect(routed).toHaveAttribute("data-router-link");
  },
};

export const SkipsMissingValues: Story = {
  args: {
    items: [
      { label: "run", value: "12" },
      { label: "frame", value: undefined },
      { label: "model", value: null },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("listitem")).toHaveLength(1);
  },
};

export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("list")).toBeNull();
  },
};
