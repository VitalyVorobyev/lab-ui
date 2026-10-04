// @ts-check
/**
 * The shared ESLint flat config: typescript-eslint (type-aware), React (`@eslint-react`), the
 * hooks rules, Storybook, and `tokensOnly`, the rule that keeps colour in the design tokens.
 *
 *     // eslint.config.js
 *     import { recommended, tokensOnly } from "@vitavision/config-eslint";
 *     export default [...recommended({ tsconfigRootDir: import.meta.dirname }), tokensOnly(["src/editor/**"])];
 *
 * Accessibility is not linted here — `eslint-plugin-jsx-a11y` does not run on eslint 10;
 * axe checks every story instead.
 */

import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import tseslint from "typescript-eslint";

import { tokensOnly as tokensOnlyRule } from "./rules/tokens-only.js";

/** The plugin carrying vitavision's own rules. */
export const plugin = { meta: { name: "@vitavision/eslint-plugin" }, rules: { "tokens-only": tokensOnlyRule } };

/**
 * @param {{ tsconfigRootDir: string }} options
 * @returns {import("eslint").Linter.Config[]}
 */
export function recommended({ tsconfigRootDir }) {
  return /** @type {import("eslint").Linter.Config[]} */ ([
    { ignores: ["**/dist/**", "**/node_modules/**", "**/storybook-static/**", "**/coverage/**"] },
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } },
    },
    {
      files: ["**/*.{ts,tsx}"],
      ...eslintReact.configs["recommended-typescript"],
    },
    reactHooks.configs.flat["recommended-latest"] ?? reactHooks.configs.flat.recommended,
    ...storybook.configs["flat/recommended"],
    {
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
        "@typescript-eslint/consistent-type-imports": "error",
      },
    },
    { files: ["**/*.{js,mjs,cjs}"], ...tseslint.configs.disableTypeChecked },
  ]);
}

/**
 * Colour from the design tokens only — no raw Tailwind palette classes or hex colours — in the
 * given directories (the ones an app has moved onto the tokens).
 * @param {string[]} files globs of the migrated directories
 * @returns {import("eslint").Linter.Config}
 */
export function tokensOnly(files) {
  return {
    files,
    ignores: ["**/*.test.*", "**/*.stories.*"],
    plugins: { vitavision: plugin },
    rules: { "vitavision/tokens-only": "error" },
  };
}
