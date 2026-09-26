import "../src/styles.css";

import type { Decorator, Preview } from "@storybook/react-vite";
import { TooltipProvider } from "@vitavision/ui";

/**
 * Both themes are one class on `<html>` (see `@vitavision/ui/styles.css`), so the toolbar's
 * theme switch — and the test harness, which renders every story in both — only toggles it.
 */
const withTheme: Decorator = (Story, context) => {
  const dark = context.globals["theme"] === "dark";
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", dark);
  return <Story />;
};

const withProviders: Decorator = (Story) => (
  <TooltipProvider>
    <div className="bg-ground p-4 text-fg">
      <Story />
    </div>
  </TooltipProvider>
);

const preview: Preview = {
  decorators: [withProviders, withTheme],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: { title: "Theme", icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { test: "error" },
  },
  tags: ["autodocs"],
};

export default preview;
