import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/react-vite";
import { defaultClientConditions, mergeConfig } from "vite";

/**
 * Stories live next to their components (`packages/<pkg>/src/**\/*.stories.tsx`): they are the
 * fixtures every DoD test runs over, so a package's tests can import them. This app only
 * collects them, adds the Foundations pages, and builds the docs site.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../../../packages/*/src/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  typescript: { reactDocgen: "react-docgen-typescript" },
  viteFinal: (vite) =>
    mergeConfig(vite, {
      plugins: [tailwindcss()],
      // Workspace packages resolve to their sources: the docs show the working tree.
      resolve: { conditions: ["@vitavision/source", ...defaultClientConditions] },
    }),
};

export default config;
