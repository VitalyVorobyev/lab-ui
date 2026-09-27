import type { ViteUserConfig } from "vitest/config";

/** happy-dom component tests with the shared setup; `overrides` are merged over it. */
export declare function dom(overrides?: ViteUserConfig): ViteUserConfig;

/**
 * A package's unit (happy-dom), stories (Chromium) and browser (Chromium, `*.browser.test.*`)
 * projects with one merged coverage report.
 */
export declare function library(options?: { coverage?: Record<string, unknown> }): ViteUserConfig;

/** The PLAN §4.3 thresholds: ≥ 90 % lines per `*.ts` file, ≥ 80 % per `*.tsx` file. */
export declare const DOD_COVERAGE: Record<string, { lines: number; perFile: boolean }>;
