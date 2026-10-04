---
"@vitavision/config-vitest": patch
---

`dom()` no longer picks up browser tests. It now excludes `src/**/*.browser.test.{ts,tsx}` and the stories runner `src/stories.test.tsx` (on top of Vitest's default exclusions), which need Chromium and failed when run in happy-dom. A `test.exclude` passed to `dom()` adds to this list rather than replacing it. To run such a file anyway, use `library()`, whose `browser` and `stories` projects run them in Chromium.
