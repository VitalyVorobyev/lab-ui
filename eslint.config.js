// @ts-check
import { recommended, tokensOnly } from "@vitavision/config-eslint";

export default [
  { ignores: ["**/dist/**", "**/temp/**", "**/storybook-static/**", "tools/bench/**", "**/*.config.ts", "**/.storybook/**", "packages/config/**/*.d.ts"] },
  ...recommended({ tsconfigRootDir: import.meta.dirname }),
  // Gate G5.1 holds for the library itself: every package's component sources.
  tokensOnly(["packages/*/src/**/*.{ts,tsx}"]),
];
