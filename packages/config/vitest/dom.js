// @ts-check
/**
 * `dom()` on its own, for apps whose tests all run in happy-dom: importing this entry loads no
 * browser provider, so `@vitest/browser-playwright` (and Playwright) need not be installed.
 * `@vitavision/config-vitest` re-exports it beside `library()`.
 */

import react from "@vitejs/plugin-react";
import { defaultClientConditions } from "vite";
import { defineConfig, mergeConfig } from "vitest/config";

const setup = new URL("./setup.js", import.meta.url).pathname;

/** @param {import("vitest/config").ViteUserConfig} [overrides] */
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
