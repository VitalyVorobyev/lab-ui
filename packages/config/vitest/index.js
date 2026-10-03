// @ts-check
/**
 * Vitest presets for vitavision packages and apps.
 *
 * `dom()` — component and logic tests in happy-dom: React plugin, Testing Library cleanup,
 * and the `@vitavision/source` condition so workspace siblings resolve to their sources.
 * Also at `@vitavision/config-vitest/dom`, which never loads Playwright: an app with only
 * happy-dom tests imports that and needs no browser provider installed.
 *
 * `library()` — a package's full suite as three projects sharing one coverage report:
 * `unit` (happy-dom, `src/**\/*.test.{ts,tsx}`), `stories` (Chromium via Vitest browser
 * mode, `src/stories.test.tsx`, which runs every story's `play` — see `./stories`) and
 * `browser` (Chromium, `src/**\/*.browser.test.{ts,tsx}`: logic that needs a real browser,
 * e.g. WebGL read-back or the CSS colour parser). Stories are the component fixtures
 * (PLAN §4.3), so component coverage counts them. A package without stories or browser
 * tests uses the same preset; an empty project is skipped.
 */

import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

export { dom } from "./dom.js";

const setup = new URL("./setup.js", import.meta.url).pathname;

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
            exclude: ["src/stories.test.tsx", "src/**/*.browser.test.{ts,tsx}"],
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
        {
          extends: true,
          test: {
            name: "browser",
            include: ["src/**/*.browser.test.{ts,tsx}"],
            browser: {
              enabled: true,
              headless: true,
              // Software WebGL (SwiftShader) on every host, so pixel read-backs agree
              // between a GPU laptop and a GPU-less CI runner.
              provider: playwright({
                launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
              }),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  });
}
