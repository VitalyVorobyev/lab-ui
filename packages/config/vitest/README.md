# @vitavision/config-vitest

Shared Vitest presets for the `@vitavision/*` frontends: happy-dom component tests, stories
run as tests, browser tests in Chromium, one merged coverage report, and colour-contrast
helpers for token tests.

```bash
bun add -d @vitavision/config-vitest vitest@^5.0.2 vite@^8.3.1 @vitejs/plugin-react@^6.1.1 @testing-library/react@^16.3.0
```

## An app: `./dom`

For tests that all run in happy-dom. This entry loads no browser provider, so neither
Playwright nor `@vitest/browser-playwright` needs to be installed.

```ts
// vitest.config.ts
import { dom } from "@vitavision/config-vitest/dom";

export default dom({ test: { include: ["src/**/*.test.{ts,tsx}"] } }); // overrides are merged in
```

- **Included:** `src/**/*.test.{ts,tsx}`, plus the Testing Library cleanup after each test.
- **Excluded:** `*.browser.test.*` files and `src/stories.test.tsx`, which need the browser preset.

## A component library: `library()`

Three projects share one coverage report:

| Project | Runs | Files |
|---|---|---|
| `unit` | happy-dom | `src/**/*.test.{ts,tsx}` |
| `stories` | Chromium | `src/stories.test.tsx`: every story, rendered with its `play` run |
| `browser` | Chromium | `src/**/*.browser.test.{ts,tsx}`: logic that needs a real browser (WebGL read-back, the CSS colour parser) |

```ts
// vitest.config.ts
import { library } from "@vitavision/config-vitest";

export default library(); // or library({ coverage: { ... } }) for your own thresholds
```

```tsx
// src/stories.test.tsx
import { runStories } from "@vitavision/config-vitest/stories";

runStories(import.meta.glob("./**/*.stories.tsx", { eager: true }));
```

- **Extra peers:** `@vitest/browser-playwright`, `@vitest/coverage-v8` and `@storybook/react-vite`.
- **Coverage:** the default thresholds (`DOD_COVERAGE`) are ≥ 90 % of lines per `*.ts` file and ≥ 80 % per `*.tsx` file. Stories count towards component coverage.

## Colour checks: `./colour`

- `contrast(a, b)`: the WCAG 2.2 ratio.
- `composite(fg, alpha, bg)`: a translucent tint over a solid background.
- `cssTokens(css, selector)`: reads `--name: #hex` declarations.
- `deltaE(a, b, simulation)` and `worstDeltaE(a, b)`: OKLab distances under simulated protanopia, deuteranopia and tritanopia.

Use them to assert that a theme's text and boundary pairs keep their contrast:

```ts
import { contrast, cssTokens } from "@vitavision/config-vitest/colour";

const light = cssTokens(css, ":root");
expect(contrast(light["--fg"]!, light["--surface"]!)).toBeGreaterThanOrEqual(4.5);
```

## License

MIT OR Apache-2.0.
