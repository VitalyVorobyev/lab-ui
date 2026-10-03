# L2-4: vitavision on the toolchain baseline

The vitavision site (SSR-prerendered, deployed to Cloudflare Pages) moved to the §3 baseline and to `@vitavision/config-ts` and `@vitavision/config-eslint`, with no UI change.

- **Measured:** 2026-09-26, macOS / Apple M-series, Chromium from Playwright 1.63.
- **vitavision:** PR [#167](https://github.com/VitalyVorobyev/vitavision/pull/167), merged as `ac6a4c9`.
  - `d3b66f2` adds the screenshot suite; the baseline was captured on it.
  - `ae8f9d0` is the upgrade; the comparison ran on it.

## Done-when (PLAN L2)

| Criterion | Result |
|---|---|
| react-router-dom → react-router 8 | ✅ 76 files, import path only; every API used exists in 8.4 |
| framer-motion → motion | ✅ 4 files (`motion/react`) |
| typecheck | ✅ 0 errors, extending `@vitavision/config-ts`, with two options held off (below) |
| lint, 0 errors | ✅ on the type-aware `@vitavision/config-eslint`: 94 errors fixed without behaviour change, 160 warnings remain |
| unit tests, including `entry-server.test.tsx` | ✅ 894 / 894 |
| SSR build | ✅ the build prerenders 840 pages as before; WASM schema tests 32 / 32; design-system boundary clean |
| L0-2, 0 undocumented deviations | ✅ (checked on the PR branch with `versions.ts` against `baseline.toml`) |
| Screenshots, `maxDiffPixelRatio` ≤ 0.001 against the pre-upgrade baseline | ✅ 34 / 34 (17 routes × light and dark) |
| Bundle delta | below |

## Screenshot suite

`bun run test:screens` runs after `bun run build`. It serves `dist/` through `vite preview`, so it compares the prerendered pages plus hydration, as they ship.

- **Routes:** home, blog and a post, the atlas (index, people, an algorithm, a model, a concept, a narrative), a paper, an author, demos and a demo, the editor, the target generator, about, and 404.
- **Reduced motion** is emulated, so entrance animations render settled.
- **Baseline stays local:** it is uncommitted.

## Bundle (`vite build`)

| Chunk | Before | After | Δ |
|---|---|---|---|
| `index` | 566.3 kB (174.9 gzip) | 600.5 kB (185.3 gzip) | +34.2 kB (+10.4 gzip) |
| `Editor` | 390.1 kB (115.5 gzip) | 409.7 kB (121.5 gzip) | +19.6 kB (+6.1 gzip) |
| largest shared chunk | 662.1 kB | 662.1 kB | 0 |

## Exceptions carried forward

- **Two compiler options were held off, now closed.** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` stayed off in `tsconfig.app.json` at L2 (they reported ~665 places in 110 files). *Closed 2026-10-03* by vitavision [#177](https://github.com/VitalyVorobyev/vitavision/pull/177) (merged as `fe598a6b`): both are inherited from `@vitavision/config-ts`, 645 errors fixed with no behaviour change (34/34 route screenshots pixel-identical to the pre-change build), and lint went from 158 to 59 warnings. vitavision now has no L2 exception.
- **G5.1 `tokensOnly`** was not enabled at L2; it was enabled in L3-3 (vitavision #169).
