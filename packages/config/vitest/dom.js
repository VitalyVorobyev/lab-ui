// @ts-check
/**
 * `dom()` on its own, for apps whose tests all run in happy-dom: importing this entry loads no
 * browser provider, so `@vitest/browser-playwright` (and Playwright) need not be installed.
 * `@vitavision/config-vitest` re-exports it beside `library()`.
 */

import react from "@vitejs/plugin-react";
import { defaultClientConditions } from "vite";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

const setup = new URL("./setup.js", import.meta.url).pathname;

/**
 * Browser tests (`*.browser.test.*`) and the stories runner (`src/stories.test.tsx`) belong to
 * `library()`'s Chromium projects and would fail in happy-dom, so they are excluded. Arrays in
 * `overrides` are appended, so a caller's `test.exclude` adds to these.
 *
 * @param {import("vitest/config").ViteUserConfig} [overrides]
 */
export function dom(overrides = {}) {
  return mergeConfig(
    defineConfig({
      plugins: [react()],
      resolve: { conditions: ["@vitavision/source", ...defaultClientConditions] },
      test: {
        environment: "happy-dom",
        globals: false,
        setupFiles: [setup],
        include: ["src/**/*.test.{ts,tsx}"],
        exclude: [...configDefaults.exclude, "src/**/*.browser.test.{ts,tsx}", "src/stories.test.tsx"],
        coverage: {
          provider: "v8",
          include: ["src/**/*.{ts,tsx}"],
          exclude: ["src/**/*.{test,stories}.{ts,tsx}", "src/index.ts"],
          reporter: ["text-summary", "json-summary"],
        },
      },
    }),
    overrides,
  );
}
