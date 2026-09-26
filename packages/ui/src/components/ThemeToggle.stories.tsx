import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import { ThemeToggle } from "./ThemeToggle";

/** A key of its own, so the stories never touch a real app's stored preference. */
const STORAGE_KEY = "storybook-theme-toggle";

function forget() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage disabled: nothing to forget.
  }
}

const meta = {
  title: "ui/ThemeToggle",
  component: ThemeToggle,
  parameters: {
    docs: {
      description: {
        component: `The palette switch shared by every lab app: one button cycling system → light → dark,
stored in \`localStorage\` under a per-app \`storageKey\`.

**Use** it once, in the app header. "System" is a real state — it follows the OS and survives
a reload as itself.

**Don't** use it for anything but the app-wide theme, and don't render two with the same key;
a second app sharing the browser profile passes its own \`storageKey\`.

**Accessibility**: a real button whose \`aria-label\` names the *current* state ("Theme: light"),
repeated in a tooltip on hover and focus; the icon is decorative. The stored choice is read (as an external store)
after hydration, so the server and the hydrating client render agree (always "system").`,
      },
    },
  },
  args: { storageKey: STORAGE_KEY },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Theme: following the system" })).toBeInTheDocument();
  },
};

export const Cycle: Story = {
  play: async ({ canvas }) => {
    forget();
    const button = canvas.getByRole("button");
    await waitFor(() => expect(button).toHaveAccessibleName("Theme: following the system"));
    await userEvent.click(button);
    await expect(button).toHaveAccessibleName("Theme: light");
    await expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
    await userEvent.click(button);
    await expect(button).toHaveAccessibleName("Theme: dark");
    await expect(document.documentElement).toHaveClass("dark");
    await userEvent.click(button);
    await expect(button).toHaveAccessibleName("Theme: following the system");
    // Leave the page as the harness found it: no stored choice, the light palette.
    forget();
    document.documentElement.classList.remove("dark");
  },
};
