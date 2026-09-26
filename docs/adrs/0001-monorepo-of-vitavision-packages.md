# ADR-0001: lab-ui becomes a monorepo of `@vitavision/*` packages

- Status: Accepted
- Date: 2026-09-26
- Plan: `docs/plan/PLAN.md` §0, §2 (L1-2)

## Context

`@vitavision/lab-ui` 0.5 is a single package. It holds primitives, a schema form, charts,
the 2D image stage and a measurement overlay. Every consumer installs all of it, along with
a `react-router` peer that only two components need.

The concept matrix (`docs/measurements/concept-matrix.md`) shows the same concepts
re-implemented across six frontends:

- 9 image stages
- 4 schema forms
- 6 panel variants

The apps can only converge on packages they can adopt one layer at a time.

## Decision

This repository becomes a bun-workspace monorepo of independently versioned, ESM-only
packages: `ui`, `forms`, `charts`, `stage2d`, and later `overlays`, `three` and `three-react`.
Shared configuration lives in `config-{ts,eslint,vitest}`.

`@vitavision/lab-ui` becomes a deprecated compatibility package. It re-exports the old
surface until its last consumer migrates (PLAN L9-1).

The layering rules are enforced in CI by `tools/inventory/check-deps.ts`:

- `ui` has no router and no motion library.
- `forms`, `charts` and `stage2d` depend on `ui`.
- React is always a peer dependency.

## Consequences

- Consumers of `@vitavision/lab-ui` 0.x keep working through the compatibility package. Today those are visual-anomaly-lab and vision-metrology/lab.
- Tailwind v4 must see class names from every package it uses, so a consumer's CSS entry needs one `@source` per package `dist`. The `ui` README documents this.
- Each new package name needs its own npm trusted-publisher entry before it can be published from CI.
