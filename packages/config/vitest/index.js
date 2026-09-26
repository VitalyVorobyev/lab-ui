// @ts-check
/**
 * Vitest presets for vitavision packages and apps.
 *
 * `dom()` — component and logic tests in happy-dom: React plugin, Testing Library cleanup,
 * and the `@vitavision/source` condition so workspace siblings resolve to their sources.
 *
 * `library()` — a package's full suite as two projects sharing one coverage report:
 * `unit` (happy-dom, `src/**\/*.test.{ts,tsx}`) and `stories` (Chromium via Vitest browser
 * mode, `src/stories.test.tsx`, which runs every story's `play` — see `./stories`). Stories
 * are the component fixtures (PLAN §4.3), so component coverage counts them.
 */

import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
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

/**
 * PLAN §4.3: at least 90 % of lines for `*.ts` logic, 80 % for components — per file, so one
 * well-covered module cannot carry an untested one.
 */
export const DOD_COVERAGE = {
  "src/**/*.ts": { lines: 90, perFile: true },
  "src/**/*.tsx": { lines: 80, perFile: true },
};

/**
 * @param {{ coverage?: Record<string, unknown> }} [options]
 *   coverage thresholds for the merged report (vitest `coverage.thresholds`); the DoD's by default
 */
export function library(options = {}) {
  return defineConfig({
    plugins: [react()],
    resolve: { conditions: ["@vitavision/source", ...defaultClientConditions] },
    test: {
      globals: false,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.{test,stories}.{ts,tsx}", "src/index.ts"],
        reporter: ["text", "text-summary", "json-summary"],
        thresholds: options.coverage ?? DOD_COVERAGE,
      },
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "happy-dom",
            setupFiles: [setup],
            include: ["src/**/*.test.{ts,tsx}"],
            exclude: ["src/stories.test.tsx"],
          },
        },
        {
          extends: true,
          test: {
            name: "stories",
            include: ["src/stories.test.tsx"],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  });
}
