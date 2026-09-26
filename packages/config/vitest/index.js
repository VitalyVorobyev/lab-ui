// @ts-check
/**
 * Vitest presets for vitavision packages and apps.
 *
 * `dom()` — component and logic tests in happy-dom: React plugin, Testing Library cleanup,
 * and the `@vitavision/source` condition so workspace siblings resolve to their sources.
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
      },
    }),
    overrides,
  );
}
