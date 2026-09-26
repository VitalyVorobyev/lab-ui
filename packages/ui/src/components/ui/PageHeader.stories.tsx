import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AnchorHTMLAttributes } from "react";
import { expect } from "storybook/test";

import { Badge } from "./Badge";
import { Button } from "./Button";
import { PageHeader } from "./Panel";

/** Stands in for a router's `<Link>`: an element that renders an anchor from its own props. */
function FakeRouterLink({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a data-router-link href={to} {...rest} />;
}

const meta = {
  title: "ui/PageHeader",
  component: PageHeader,
  parameters: {
    docs: {
      description: {
        component: `The top of a screen: its \`<h1>\` title, an optional way back, page actions and a meta line.

**Use** once per screen. \`back\` takes \`{ href, label }\` for a plain URL, or the app's own router
link element (\`back={<Link to="/runs">Runs</Link>}\`), which is styled and prefixed with an arrow —
so this package never imports a router.

**Don't** use it for a region inside a page (that is \`Panel\`), and don't put a second \`<h1>\` on the
screen.

**Accessibility**: the title is the page's \`<h1>\`. The back link's accessible name includes the
leading arrow ("← Runs").`,
      },
    },
  },
  args: { title: "Run 12" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1, name: "Run 12" })).toBeVisible();
  },
};

export const WithMetaAndActions: Story = {
  args: {
    meta: (
      <>
        <Badge>patchcore</Badge>
        <span>started 12 min ago</span>
      </>
    ),
    actions: <Button variant="primary">Re-run</Button>,
  },
};

export const BackHref: Story = {
  args: { back: { href: "/runs", label: "Runs" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "← Runs" })).toHaveAttribute("href", "/runs");
  },
};

export const BackRouterLink: Story = {
  args: { back: <FakeRouterLink to="/runs">Runs</FakeRouterLink> },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "← Runs" });
    await expect(link).toHaveAttribute("href", "/runs");
    await expect(link).toHaveAttribute("data-router-link");
  },
};
