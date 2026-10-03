import type { ViteUserConfig } from "vitest/config";

/** happy-dom component tests with the shared setup; `overrides` are merged over it. Loads no browser provider. */
export declare function dom(overrides?: ViteUserConfig): ViteUserConfig;
