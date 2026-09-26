// @ts-check
/**
 * Run every story of a package as a test: render it and run its `play` (PLAN §4.3 — the
 * stories are the fixtures). Accessibility and server rendering are checked over the same
 * stories by the Storybook app's harness; this is the per-package run that counts towards
 * the package's own coverage.
 *
 *     // src/stories.test.tsx
 *     import { runStories } from "@vitavision/config-vitest/stories";
 *     runStories(import.meta.glob("./**\/*.stories.tsx", { eager: true }), { decorators: [...] });
 */

import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import { afterEach, describe, it } from "vitest";

/**
 * @param {Record<string, any>} modules  story modules, e.g. from `import.meta.glob(…, { eager: true })`
 * @param {Record<string, unknown>} [annotations]  project annotations (decorators, parameters)
 */
export function runStories(modules, annotations = {}) {
  setProjectAnnotations(annotations);
  /** @type {HTMLElement | null} */
  let mounted = null;
  afterEach(() => {
    mounted?.remove();
    mounted = null;
  });
  for (const [path, module] of Object.entries(modules)) {
    const title = module.default?.title ?? path;
    describe(title, () => {
      for (const [name, Story] of Object.entries(composeStories(module))) {
        it(name, async () => {
          mounted = document.createElement("div");
          document.body.append(mounted);
          await /** @type {any} */ (Story).run({ canvasElement: mounted });
        });
      }
    });
  }
}
