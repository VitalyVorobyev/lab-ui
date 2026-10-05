# @vitavision/config-vitest

## 0.4.1

### Patch Changes

- 8776588: Each config package now has a README with its setup and options. `tokensOnly`'s messages now point to the Foundations / Colour page of the component Storybook, which lists the design tokens to use instead.
- 8bec84f: `dom()` no longer picks up browser tests. It now excludes `src/**/*.browser.test.{ts,tsx}` and the stories runner `src/stories.test.tsx` (on top of Vitest's default exclusions), which need Chromium and failed when run in happy-dom. A `test.exclude` passed to `dom()` adds to this list rather than replacing it. To run such a file anyway, use `library()`, whose `browser` and `stories` projects run them in Chromium.

## 0.4.0

### Minor Changes

- 32eb75b: Add a `@vitavision/config-vitest/dom` entry that exports `dom()` without loading a browser provider, so an app whose tests all run in happy-dom no longer has to install `@vitest/browser-playwright` and Playwright. `@vitest/browser-playwright` is now an optional peer, needed only by `library()`. The root entry still exports `dom()`.

## 0.3.0

### Minor Changes

- 376b38a: `library()` gains a third project, `browser`: `src/**/*.browser.test.{ts,tsx}` run in headless Chromium (Vitest browser mode) on software WebGL (SwiftShader), so pixel read-backs agree between a GPU laptop and a GPU-less CI runner. They count towards the same merged coverage report, and the `unit` project no longer picks them up. A package without stories, such as `@vitavision/three`, now uses `library()` too: a project with no test files is skipped.

## 0.2.0

### Minor Changes

- bab71f8: New `@vitavision/config-vitest/colour`: WCAG contrast, alpha compositing, stylesheet token parsing, and OKLab distance under simulated colour-vision deficiency (Machado 2009), for token tests.
