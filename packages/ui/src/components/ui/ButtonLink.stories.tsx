import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight } from "lucide-react";
import type { AnchorHTMLAttributes } from "react";
import { expect } from "storybook/test";

import { ButtonLink } from "./Button";
import { DensityProvider } from "./Density";

/** Stands in for a router's `<Link>`: an element that renders an anchor from its own props. */
function FakeRouterLink({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a data-router-link href={to} {...rest} />;
}

const meta = {
  title: "ui/ButtonLink",
  component: ButtonLink,
  parameters: {
    docs: {
      description: {
        component: `A navigation that looks like a button: one \`<a>\`, styled by \`Button\`'s variants and density.

**Use** it where a button-shaped control goes somewhere rather than does something ("Open run",
"New experiment"). For client-side navigation pass the router's link as the only child with
\`asChild\` — \`<ButtonLink asChild><Link to="/runs">Runs</Link></ButtonLink>\` — so the package
never imports a router.

**Don't** wrap a \`Button\` in a link (a button inside an anchor is invalid and gives two tab stops),
and don't render one that cannot be followed: there is no \`disabled\` or \`loading\`.

**Accessibility**: exposed as a link, named by its content; the icon is \`aria-hidden\`. An
icon-only link needs an \`aria-label\`.`,
      },
    },
  },
  args: { children: "Open run" },
} satisfies Meta<typeof ButtonLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {
  args: { href: "/runs/12" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Open run" })).toHaveAttribute("href", "/runs/12");
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const Primary: Story = { args: { href: "/runs/12", variant: "primary" } };

export const Ghost: Story = { args: { href: "/runs/12", variant: "ghost" } };

export const WithIcon: Story = { args: { href: "/runs/12", variant: "primary", icon: <ArrowRight /> } };

export const Small: Story = { args: { href: "/runs/12", size: "sm" } };

export const Compact: Story = {
  args: { href: "/runs/12" },
  decorators: [
    (Story) => (
      <DensityProvider value="compact">
        <Story />
      </DensityProvider>
    ),
  ],
};

export const AsChildRouterLink: Story = {
  args: {
    asChild: true,
    children: <FakeRouterLink to="/runs">Runs</FakeRouterLink>,
  },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "Runs" });
    await expect(link).toHaveAttribute("href", "/runs");
    await expect(link).toHaveAttribute("data-router-link");
    // No href was given to ButtonLink: the router link owns it. One element — the router's
    // anchor carries the button look, nothing is nested in it.
    await expect(canvas.getAllByRole("link")).toHaveLength(1);
    await expect(link.className).toContain("rounded-control");
  },
};
