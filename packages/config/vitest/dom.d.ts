import type { ViteUserConfig } from "vitest/config";

/**
 * happy-dom component tests with the shared setup. Browser tests (`*.browser.test.*`) and the
 * stories runner (`src/stories.test.tsx`) are excluded. `overrides` are merged over it, arrays
 * appended, so a `test.exclude` adds to these. Loads no browser provider.
 */
export declare function dom(overrides?: ViteUserConfig): ViteUserConfig;
