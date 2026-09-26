import type { Meta, StoryObj } from "@storybook/react-vite";
import { Play } from "lucide-react";
import { expect, fn, userEvent } from "storybook/test";

import { Button } from "./Button";

const meta = {
  title: "ui/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component: `An action the user takes on this screen.

**Use** \`primary\` for the one action a screen is for, \`secondary\` for the rest, \`ghost\` inside dense
toolbars, \`danger\` for a destructive action (behind a confirmation).

**Don't** use it to navigate — that is \`ButtonLink\` (or \`asChild\` around your router's link), so a
link stays one anchor rather than a button inside a link.

**Accessibility**: a real \`<button type="button">\`; \`loading\` sets \`aria-busy\` and blocks the click
without changing the label, so the accessible name is stable. An icon-only button needs an
\`aria-label\`.`,
      },
    },
  },
  args: { children: "Run detection", onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Run detection" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Secondary: Story = { args: { variant: "secondary" } };

export const Ghost: Story = { args: { variant: "ghost" } };

export const Danger: Story = { args: { variant: "danger", children: "Delete run" } };

export const WithIcon: Story = { args: { variant: "primary", icon: <Play /> } };

export const Loading: Story = {
  args: { variant: "primary", loading: true },
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole("button");
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toBeDisabled();
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const Small: Story = { args: { size: "sm" } };
