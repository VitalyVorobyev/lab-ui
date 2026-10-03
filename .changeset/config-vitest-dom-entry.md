---
"@vitavision/config-vitest": minor
---

Add a `@vitavision/config-vitest/dom` entry that exports `dom()` without loading a browser provider, so an app whose tests all run in happy-dom no longer has to install `@vitest/browser-playwright` and Playwright. `@vitest/browser-playwright` is now an optional peer, needed only by `library()`. The root entry still exports `dom()`.
