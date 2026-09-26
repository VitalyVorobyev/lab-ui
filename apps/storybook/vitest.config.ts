import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The §4 story harness. Every story in `packages/*` is a fixture for two projects:
 *
 *   - `browser`: rendered in Chromium (Vitest browser mode) with the real Tailwind CSS, its
 *     `play` function run, then axe in the light and the dark theme — 0 serious/critical;
 *   - `ssr`: `renderToString` in Node with 0 console errors or warnings (vitavision renders
 *     on the server, so every package must).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { conditions: ["@vitavision/source", ...defaultClientConditions] },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.tsx"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            viewport: { width: 1280, height: 800 },
          },
        },
      },
      {
        extends: true,
        test: {
          name: "ssr",
          environment: "node",
          include: ["test/**/*.ssr.test.tsx"],
        },
      },
    ],
  },
});
