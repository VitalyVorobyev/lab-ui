# lab-ui

React packages for image-inspection, measurement and calibration tools. The repo publishes eight packages:
- the design system and its primitives
- schema-driven forms
- small SVG charts
- a 2D image stage with overlay layers and editors
- calibration-target overlays
- the building blocks of studio apps
- a three.js robot-cell scene and its React bindings

The design direction is an *instrument*: the chrome is grey so the data can be loud.

**[Browse the components in Storybook →](https://vitalyvorobyev.github.io/lab-ui/)**

| Package | What it is | Needs |
|---|---|---|
| [`@vitavision/ui`](packages/ui) [![npm](https://img.shields.io/npm/v/@vitavision/ui)](https://www.npmjs.com/package/@vitavision/ui) | Design tokens (Tailwind v4 source CSS), theme, IBM Plex, and the primitives: buttons, panels, inputs, selects, tables, dialogs, menus, toasts | `tailwindcss` 4 |
| [`@vitavision/forms`](packages/forms) [![npm](https://img.shields.io/npm/v/@vitavision/forms)](https://www.npmjs.com/package/@vitavision/forms) | JSON Schema (draft 2020-12) rendered as a form, for one options object or a whole nested value | `ui` |
| [`@vitavision/charts`](packages/charts) [![npm](https://img.shields.io/npm/v/@vitavision/charts)](https://www.npmjs.com/package/@vitavision/charts) | Histogram, line, bar and line-profile charts with hover, pick, bands, markers and colour maps | `ui` |
| [`@vitavision/stage2d`](packages/stage2d) [![npm](https://img.shields.io/npm/v/@vitavision/stage2d)](https://www.npmjs.com/package/@vitavision/stage2d) | The image stage: zoom and pan, batched point, polyline, area, grid and heatmap layers with one hit-test, ROI, shape, contour and mask editors, measurement overlays | `ui` |
| [`@vitavision/overlays`](packages/overlays) [![npm](https://img.shields.io/npm/v/@vitavision/overlays)](https://www.npmjs.com/package/@vitavision/overlays) | One `TargetOverlay` for chessboard, ChArUco, marker-board, PuzzleBoard and ring-grid detections | `stage2d` (peer) |
| [`@vitavision/workbench`](packages/workbench) [![npm](https://img.shields.io/npm/v/@vitavision/workbench)](https://www.npmjs.com/package/@vitavision/workbench) | Studio-app building blocks: app shell, split panes, tree view, playback bar, sequence navigator, file drop | `ui` |
| [`@vitavision/three`](packages/three) [![npm](https://img.shields.io/npm/v/@vitavision/three)](https://www.npmjs.com/package/@vitavision/three) | Framework-agnostic three.js for robot-cell scenes: CV/GL conventions, frame trees, robots, camera frusta, laser fans, targets | `three` 0.186 |
| [`@vitavision/three-react`](packages/three-react) [![npm](https://img.shields.io/npm/v/@vitavision/three-react)](https://www.npmjs.com/package/@vitavision/three-react) | React Three Fiber components over `three`: scene canvas, frame tree, robot, gizmos, sensor image | `three`, `@react-three/fiber` 9 |
| [`@vitavision/config-ts`](packages/config/ts), [`config-eslint`](packages/config/eslint), [`config-vitest`](packages/config/vitest) | Shared TypeScript, ESLint and Vitest presets | |

React 19 (`react`, `react-dom`) is a peer of every React package. Every package is ESM and
safe to render on the server.

## Getting started

```bash
bun add @vitavision/ui @vitavision/stage2d   # and whichever others you need
```

The stylesheets are Tailwind v4 *source*, built by your own Tailwind. Import them after
Tailwind, `ui` first:

```css
@import "tailwindcss";
@import "@vitavision/ui/fonts.css";
@import "@vitavision/ui/styles.css";
@import "@vitavision/stage2d/styles.css"; /* one line per package that ships styles.css */
```

Each package's README covers its exports and an example. The Storybook site shows every
component in every state, in light and dark.

## Versions

- Every package is versioned on its own and is 0.x. A **minor** release may break, and its
  changelog says how to keep the old behaviour. A **patch** never breaks.
- `@vitavision/lab-ui`, the single package these were split from, is deprecated. Its
  published versions stay installable.

## Scope

Deliberately not here:

- **App-shell layout in `ui`.** How a page-shaped app fills the viewport is that app's
  decision. A *studio* — permanent navigator, viewport, inspector and timeline, where nothing
  scrolls but the panels — takes its frame from `@vitavision/workbench`. An app that scrolls
  never installs it.
- **Compiled CSS.** Pre-compiling `styles.css` would fix its utilities against this repo's
  Tailwind config instead of yours.
- **API routes and generated types.** `fetchPlane` takes a URL and the forms type their input
  structurally, so nothing is coupled to one backend.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
