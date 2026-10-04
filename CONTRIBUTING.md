# Contributing

This repo is a **bun** workspace; `packageManager` pins the version. The rules every change
follows are in [CLAUDE.md](CLAUDE.md): the layering, the definition of done, and the workflow.

## Develop

```bash
bun install
bun run typecheck      # every package, sources resolved across the workspace
bun run test           # vitest per package + bun test for tools/ and packages/config/
bun run test:stories   # every story: interactions, axe in both themes, server render
bun run lint
bun run build          # tsdown → packages/*/dist
bun run api            # refresh packages/*/etc/*.api.md after a public API change
bun run storybook      # the docs site on :6006
```

**No build needed for tests.** Packages resolve each other's **sources** through the
`@vitavision/source` export condition, so typecheck and tests run straight away.

**Trying a change in an app.** To try a change in a consuming app before publishing,
`bun link` the package there and rebuild it.

**Stories are the fixtures.** Each package's tests import its stories, and the Storybook app
collects them all.

**Visual regression.** The screenshot comparison runs only in CI, on macOS: font
rasterisation differs by OS. To accept new or changed screenshots:
1. Label the PR `update-visual-baselines`.
2. Download the `visual-baselines` artifact from that run.
3. Commit the PNGs of the stories you changed.
4. Remove the label.

## Changesets

**Every PR with a user-facing change carries a changeset** (`bun run changeset`).
- Versions are independent and all 0.x.
- A breaking change is a **minor**; anything else is a **patch**.

**Changesets become the published CHANGELOGs.** Write them for the people who install the
package:
- what changed
- how to use it
- what behaves differently
- how to keep the old behaviour

## Release

On `main`, `.github/workflows/release.yml` keeps a **"Version Packages" PR** open while
changesets are pending. Merging that PR is the release. The workflow then:
1. typechecks, tests and builds;
2. runs the consumer check (`bun run check:consumer`), which installs the packed tarballs into a fresh app;
3. publishes every package whose version is not yet on npm, with provenance.

Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers), so there
is no npm token in the repo.

**A new package needs one manual step.** Each package name needs a trusted publisher on
npmjs.com (repository `VitalyVorobyev/lab-ui`, workflow `release.yml`, environment `npm`)
before CI can publish it. npm only lets you register a publisher on a name that already
exists, so publish the first version by hand, exactly as CI would build it:

```sh
bun install && bun run build                 # every package's dist/
bun tools/release/resolve-workspace.ts       # workspace:^ → real ranges in the manifests
cd packages/<name> && npm pack --dry-run     # check: dist/ is listed, no workspace: ranges
npm publish                                  # then register the trusted publisher
cd ../.. && git checkout packages            # undo the manifest rewrite
```

A bare `npm publish` skips the first two steps and ships a package without `dist/`. CLAUDE.md
lists the places a new package must also be added.

## Docs site

The Storybook docs site deploys from `main` to GitHub Pages (`.github/workflows/storybook.yml`).
