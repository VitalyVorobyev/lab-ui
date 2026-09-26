// @ts-check
/**
 * The build every `@vitavision/*` library shares: one ESM entry, bundled declarations,
 * dependencies and peers left external (tsdown's default), and the package's `styles.css`
 * copied into `dist/` unprocessed — it is Tailwind v4 *source*, compiled by the consumer.
 */

import { existsSync } from "node:fs";

/** @param {import("tsdown").UserConfig} [overrides] */
export function library(overrides = {}) {
  /** @type {import("tsdown").UserConfig} */
  const config = {
    entry: ["src/index.ts"],
    format: "esm",
    platform: "neutral",
    target: "es2022",
    dts: true,
    sourcemap: true,
    clean: true,
    ...(existsSync("src/styles.css") ? { copy: [{ from: "src/styles.css", to: "dist" }] } : {}),
    ...overrides,
  };
  return config;
}
