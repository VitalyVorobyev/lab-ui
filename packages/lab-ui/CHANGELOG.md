# @vitavision/lab-ui

## 0.6.0

### Minor Changes

- 038fcec: **Breaking:** no router dependency. `react-router` is no longer a peer of `@vitavision/ui` or
  `@vitavision/lab-ui`; everything that navigates renders a plain `<a href>` or your own link
  element through `asChild` (Radix `Slot`).
  
  - `Button` gains `asChild`: `<Button asChild><Link to="/x">…</Link></Button>`.
  - `ButtonLink` takes `href` (a plain anchor) instead of react-router's `LinkProps`; for
    client-side navigation, `<ButtonLink asChild><Link to="/x">…</Link></ButtonLink>`.
  - `PageHeader`'s `back` is `{ href, label }` or a link element (`back={<Link to="/runs">Runs</Link>}`),
    replacing `{ to, label }`. New type: `BackLink`.
  - `ReadoutItem` takes `href` or `link` (an element, given without children) instead of `to`.
- 7c6c4e4: Split `@vitavision/lab-ui` into four packages: `@vitavision/ui` (tokens, theme, primitives),
  `@vitavision/forms` (`SchemaForm`), `@vitavision/charts` and `@vitavision/stage2d` (`ImageStage`,
  `MeasureOverlay`, value planes). `@vitavision/lab-ui` is now a deprecated re-export of the four
  with the identical 0.5 surface; its `styles.css` imports the four stylesheets, each of which
  declares its own Tailwind `@source`, so consumers no longer need an `@source` line.
  
  Optional props that forward a value now accept `undefined` explicitly (for consumers on
  `exactOptionalPropertyTypes`).

### Patch Changes

- Updated dependencies [9336e74]
- Updated dependencies [d891e42]
- Updated dependencies [038fcec]
- Updated dependencies [7c6c4e4]
- Updated dependencies [9aeeb5d]
- Updated dependencies [51bdec5]
- Updated dependencies [b60a923]
  - @vitavision/charts@0.6.0
  - @vitavision/forms@0.6.0
  - @vitavision/ui@0.6.0
  - @vitavision/stage2d@0.6.0
