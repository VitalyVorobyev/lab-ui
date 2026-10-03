# @vitavision/config-vitest

## 0.4.0

### Minor Changes

- 32eb75b: Add a `@vitavision/config-vitest/dom` entry that exports `dom()` without loading a browser provider, so an app whose tests all run in happy-dom no longer has to install `@vitest/browser-playwright` and Playwright. `@vitest/browser-playwright` is now an optional peer, needed only by `library()`. The root entry still exports `dom()`.

## 0.3.0

### Minor Changes

- 376b38a: `library()` gains a third project, `browser`: `src/**/*.browser.test.{ts,tsx}` run in headless Chromium (Vitest browser mode) on software WebGL (SwiftShader), so pixel read-backs agree between a GPU laptop and a GPU-less CI runner. They count towards the same merged coverage report, and the `unit` project no longer picks them up. A package without stories, such as `@vitavision/three`, now uses `library()` too: a project with no test files is skipped.

## 0.2.0

### Minor Changes

- bab71f8: New `@vitavision/config-vitest/colour`: WCAG contrast, alpha compositing, stylesheet token parsing, and OKLab distance under simulated colour-vision deficiency (Machado 2009), for token tests.
