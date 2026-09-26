# lab-ui

The `@vitavision/*` frontend packages — one home for the UI primitives, forms, charts, the 2D
image stage and (later) calibration overlays and the 3D scene used across the vitavision apps.
The design direction is an *instrument*: the chrome is grey so the data can be loud.

| Package | What | |
|---|---|---|
| [`@vitavision/ui`](packages/ui) | Tokens (Tailwind v4 source CSS), theme, primitives | |
| [`@vitavision/forms`](packages/forms) | JSON Schema → options form | depends on `ui` |
| [`@vitavision/charts`](packages/charts) | Histogram, line, bar, line profile, scales | depends on `ui` |
| [`@vitavision/stage2d`](packages/stage2d) | Image stage: view transform, zoom/pan, layers, measurement | depends on `ui` |
| [`@vitavision/lab-ui`](packages/lab-ui) | **Deprecated** re-export of the four, for 0.x consumers | |
| [`@vitavision/config-ts`](packages/config/ts), [`config-eslint`](packages/config/eslint), [`config-vitest`](packages/config/vitest) | Shared toolchain presets for the apps | |

`docs/plan/PLAN.md` is the roadmap; `docs/adrs/` holds the decisions (ADR-0002 is the toolchain
baseline); `docs/measurements/` holds every gate result (concept matrix, dependency matrix,
stage benchmark).

## Development

This repo is a **bun** workspace (`packageManager` pins the version).

```bash
bun install
bun run typecheck   # every package, sources resolved across the workspace
bun run test        # vitest per package + bun test for tools/ and config/
bun run build       # tsdown → packages/*/dist
bun run check:deps  # the PLAN §2 layering rules
bun run bench       # the stage2d benchmark (headed Chromium)
```

Packages resolve each other's **sources** through the `@vitavision/source` export condition,
so typecheck and tests need no prior build. To try a change in a consuming app before
publishing, `bun link` the package there and rebuild it.

## Releasing

Changesets, independent versions, all 0.x (PLAN §7). Every PR with a user-facing change
carries a changeset (`bun run changeset`); a breaking change is a **minor**.

On `main`, `.github/workflows/release.yml` keeps a **"Version Packages" PR** open while
changesets are pending. Merging that PR is the release: the workflow typechecks, tests,
builds, runs the consumer check (`bun run check:consumer` — the packed tarballs installed
into a fresh app), and publishes every package whose version is not yet on npm, with
provenance.

Publishing is npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) — no npm
token in the repo. **Each package name needs its trusted publisher registered on npmjs.com**
(repository `VitalyVorobyev/lab-ui`, workflow `release.yml`, environment `npm`) before its
first release from CI. After the first release of the split, mark the compat package
deprecated: `npm deprecate @vitavision/lab-ui "Split into @vitavision/ui, /forms, /charts and /stage2d — see its README"`.

The Storybook docs site deploys from `main` to GitHub Pages (`.github/workflows/storybook.yml`).

## Scope

Deliberately not here:

- **App-shell layout rules.** How an app fills the viewport is that app's decision; a
  design system should not force every consumer into a fixed-viewport shell.
- **Compiled CSS.** `styles.css` is Tailwind source on purpose — pre-compiling it would
  fix its utilities against *this* package's Tailwind config instead of yours.
- **API routes and generated types.** `fetchPlane` takes a URL and `SchemaForm` types its
  input structurally, so neither is coupled to any one app's backend.
- **ROC/PR curves** (`CurveChart`/`ThresholdCurve`) — anomaly-lab specific.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
