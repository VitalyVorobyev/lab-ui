// @ts-check
/**
 * The `storybook` Oxlint plugin: the recommended rules of `eslint-plugin-storybook`, under
 * the same names, without its ESLint and typescript-eslint dependencies.
 */

import { definePlugin } from "@oxlint/plugins";

import {
  awaitInteractions,
  contextInPlayFunction,
  defaultExports,
  hierarchySeparator,
  noRedundantStoryName,
  noRendererPackages,
  preferPascalCase,
  storyExports,
  useStorybookExpect,
  useStorybookTestingLibrary,
} from "./rules/storybook.js";

export default definePlugin({
  meta: { name: "storybook" },
  rules: {
    "await-interactions": awaitInteractions,
    "context-in-play-function": contextInPlayFunction,
    "default-exports": defaultExports,
    "hierarchy-separator": hierarchySeparator,
    "no-redundant-story-name": noRedundantStoryName,
    "no-renderer-packages": noRendererPackages,
    "prefer-pascal-case": preferPascalCase,
    "story-exports": storyExports,
    "use-storybook-expect": useStorybookExpect,
    "use-storybook-testing-library": useStorybookTestingLibrary,
  },
});
