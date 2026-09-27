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

/**
 * The D1 comparison (PLAN §8): "Inter + Geist Mono" renders every story in the other candidate
 * pair (see `src/styles.css`). The default leaves `<html>` alone, so the package's own family
 * applies — what the tests and the visual baselines see.
 */
const withTypeFamily: Decorator = (Story, context) => {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (context.globals["typeFamily"] === "inter") root.dataset["typeFamily"] = "inter";
    else delete root.dataset["typeFamily"];
  }
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
  decorators: [withProviders, withTheme, withTypeFamily],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: { title: "Theme", icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
    typeFamily: {
      description: "Type family (decision D1)",
      toolbar: {
        title: "Type",
        icon: "paragraph",
        items: [
          { value: "plex", title: "IBM Plex Sans + Mono" },
          { value: "inter", title: "Inter + Geist Mono" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", typeFamily: "plex" },
  parameters: {
    layout: "fullscreen",
    options: {
      storySort: {
        order: [
          "Foundations",
          ["Introduction", "Colour", "Type family (D1)", "Scales", "Data-vis palette", "Overlay grammar"],
          "ui",
          "forms",
          "charts",
          "stage2d",
        ],
      },
    },
    controls: { expanded: true },
    a11y: { test: "error" },
  },
  tags: ["autodocs"],
};

export default preview;
