import type { ESLint, Linter } from "eslint";

/** The plugin carrying vitavision's own rules (`vitavision/tokens-only`). */
export declare const plugin: ESLint.Plugin;

/** The shared flat config: typescript-eslint (type-aware), React, hooks, Storybook. */
export declare function recommended(options: { tsconfigRootDir: string }): Linter.Config[];

/** Gate G5.1 — no raw palette classes or hex colours — over the given migrated directories. */
export declare function tokensOnly(files: string[]): Linter.Config;
