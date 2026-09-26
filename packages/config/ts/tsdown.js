// @ts-check
/**
 * The build every `@vitavision/*` library shares: one ESM entry, bundled declarations,
 * dependencies and peers left external (tsdown's default).
 *
 * `styles.css` is not built: it is Tailwind v4 *source*, compiled by the consumer, and is
 * exported straight from `src/` (which ships), so the workspace needs no build to use it.
 */

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
    ...overrides,
  };
  return config;
}
