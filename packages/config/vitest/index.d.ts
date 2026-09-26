import type { ViteUserConfig } from "vitest/config";

/** happy-dom component tests with the shared setup; `overrides` are merged over it. */
export declare function dom(overrides?: ViteUserConfig): ViteUserConfig;

/** A package's unit (happy-dom) and stories (Chromium) projects with one merged coverage report. */
export declare function library(options?: {
  coverage?: { lines?: number; functions?: number; branches?: number; statements?: number };
}): ViteUserConfig;
