import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";

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
} from "./storybook.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { sourceType: "module", parserOptions: { lang: "tsx" } } });
const filename = "Button.stories.tsx";

tester.run("default-exports", defaultExports, {
  valid: [
    { filename, code: "export default { title: 'A' };\nexport const Primary = {};" },
    { filename, code: "const meta = { title: 'A' };\nexport { meta as default };" },
    { filename, code: "import preview from '#.storybook/preview';\nconst meta = preview.meta({});" },
  ],
  invalid: [
    {
      filename,
      code: "import { Button } from './Button';\nexport const Primary = {};",
      errors: [{ messageId: "shouldHaveDefaultExport", line: 2 }],
    },
  ],
});

tester.run("story-exports", storyExports, {
  valid: [
    { filename, code: "const meta = { title: 'A' } satisfies Meta;\nexport default meta;\nexport const Primary = {};" },
    // A file of shared data has no meta, so it is not a story file.
    { filename, code: "export const DATA = [1, 2];" },
  ],
  invalid: [
    { filename, code: "export default { title: 'A' };", errors: [{ messageId: "shouldHaveStoryExport" }] },
    {
      filename,
      code: "export default { title: 'A', excludeStories: ['Primary'] };\nexport const Primary = {};",
      errors: [{ messageId: "shouldHaveStoryExportWithFilters" }],
    },
    { filename, code: "export default { excludeStories: /.*Data$/ };\nexport const RowData = {};", errors: 1 },
  ],
});

tester.run("prefer-pascal-case", preferPascalCase, {
  valid: [
    { filename, code: "export default {};\nexport const Primary = {};\nexport const _private = {};" },
    { filename, code: "export default { excludeStories: ['rows'] };\nexport const rows = [];" },
  ],
  invalid: [
    {
      filename,
      code: "export default {};\nexport const primary = {};",
      errors: [{ messageId: "usePascalCase", data: { name: "primary" } }],
    },
  ],
});

tester.run("no-redundant-story-name", noRedundantStoryName, {
  valid: [{ filename, code: "export const PrimaryButton = { name: 'The primary one' };" }],
  invalid: [
    { filename, code: "export const PrimaryButton = { name: 'Primary Button' };", errors: [{ messageId: "storyNameIsRedundant" }] },
  ],
});

tester.run("hierarchy-separator", hierarchySeparator, {
  valid: [{ filename, code: "export default { title: 'ui/Button' };" }],
  invalid: [{ filename, code: "export default { title: 'ui|Button' };", output: "export default { title: 'ui/Button' };", errors: 1 }],
});

tester.run("no-renderer-packages", noRendererPackages, {
  valid: [{ filename, code: "import type { Meta } from '@storybook/react-vite';" }],
  invalid: [{ filename, code: "import type { Meta } from '@storybook/react';", errors: [{ messageId: "noRendererPackages" }] }],
});

tester.run("use-storybook-expect", useStorybookExpect, {
  valid: [{ filename, code: "import { expect } from 'storybook/test';\nexpect(1).toBe(1);" }],
  invalid: [{ filename, code: "expect(1).toBe(1);", errors: [{ messageId: "useExpectFromStorybook" }] }],
});

tester.run("use-storybook-testing-library", useStorybookTestingLibrary, {
  valid: [{ filename, code: "import { within } from 'storybook/test';" }],
  invalid: [{ filename, code: "import { within } from '@testing-library/react';", errors: 1 }],
});

tester.run("await-interactions", awaitInteractions, {
  valid: [
    {
      filename,
      code: "import { expect, userEvent, waitFor } from 'storybook/test';\nexport const A = { play: async ({ canvas }) => { await userEvent.click(canvas.getByRole('button')); await waitFor(() => expect(1).toBe(1)); await waitFor(() => { expect(1).toBe(1); }); } };",
    },
    // Without storybook/test, `userEvent` is someone else's.
    { filename, code: "const userEvent = { click() {} };\nuserEvent.click();" },
    { filename, code: "import { userEvent } from 'storybook/test';\nconst click = () => userEvent.click(document.body);" },
  ],
  invalid: [
    {
      filename,
      code: "import { userEvent } from 'storybook/test';\nexport const A = { play: async () => { userEvent.click(document.body); } };",
      output:
        "import { userEvent } from 'storybook/test';\nexport const A = { play: async () => { await userEvent.click(document.body); } };",
      errors: [{ messageId: "interactionShouldBeAwaited", data: { method: "userEvent" } }],
    },
    {
      filename,
      code: "import { expect } from 'storybook/test';\nexport const A = { play: async ({ canvas }) => { canvas.findByRole('x'); expect(1).toBe(1); } };",
      output:
        "import { expect } from 'storybook/test';\nexport const A = { play: async ({ canvas }) => { await canvas.findByRole('x'); await expect(1).toBe(1); } };",
      errors: 2,
    },
    {
      filename,
      code: "import { userEvent } from 'storybook/test';\nexport const A = { play: () => { userEvent.click(document.body); } };",
      output:
        "import { userEvent } from 'storybook/test';\nexport const A = { play: async () => { await userEvent.click(document.body); } };",
      errors: 1,
    },
  ],
});

tester.run("context-in-play-function", contextInPlayFunction, {
  valid: [
    { filename, code: "export const B = { play: async (context) => { await A.play(context); } };" },
    { filename, code: "export const B = { play: async ({ context }) => { await A.play(context); } };" },
    { filename, code: "export const B = { play: async (ctx) => { await A.play!({ ...ctx, extra: 1 }); } };" },
  ],
  invalid: [
    { filename, code: "export const B = { play: async () => { await A.play(); } };", errors: [{ messageId: "passContextToPlayFunction" }] },
    { filename, code: "export const B = { play: async (ctx) => { await A.play({}); } };", errors: 1 },
  ],
});
