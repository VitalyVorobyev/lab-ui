# @vitavision/forms

## 0.6.0

### Minor Changes

- 7c6c4e4: Split `@vitavision/lab-ui` into four packages: `@vitavision/ui` (tokens, theme, primitives),
  `@vitavision/forms` (`SchemaForm`), `@vitavision/charts` and `@vitavision/stage2d` (`ImageStage`,
  `MeasureOverlay`, value planes). `@vitavision/lab-ui` is now a deprecated re-export of the four
  with the identical 0.5 surface; its `styles.css` imports the four stylesheets, each of which
  declares its own Tailwind `@source`, so consumers no longer need an `@source` line.
  
  Optional props that forward a value now accept `undefined` explicitly (for consumers on
  `exactOptionalPropertyTypes`).

### Patch Changes

- d891e42: Every export is documented (TSDoc; the API report has no undocumented symbols). A
  structured default — a nested model's — now shows as JSON in its field's placeholder
  instead of `[object Object]` (new `displayValue` helper in `api/schemaForm`). Size budget
  set (2.3 kB).
- Updated dependencies [038fcec]
- Updated dependencies [7c6c4e4]
- Updated dependencies [51bdec5]
- Updated dependencies [b60a923]
  - @vitavision/ui@0.6.0
