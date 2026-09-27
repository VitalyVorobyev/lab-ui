---
"@vitavision/config-vitest": minor
---

`library()` gains a third project, `browser`: `src/**/*.browser.test.{ts,tsx}` run in headless Chromium (Vitest browser mode) on software WebGL (SwiftShader), so pixel read-backs agree between a GPU laptop and a GPU-less CI runner. They count towards the same merged coverage report, and the `unit` project no longer picks them up. A package without stories, such as `@vitavision/three`, now uses `library()` too: a project with no test files is skipped.
