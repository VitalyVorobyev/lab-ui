---
"@vitavision/ui": minor
"@vitavision/forms": minor
"@vitavision/charts": minor
"@vitavision/stage2d": minor
"@vitavision/lab-ui": minor
---

Split `@vitavision/lab-ui` into four packages: `@vitavision/ui` (tokens, theme, primitives),
`@vitavision/forms` (`SchemaForm`), `@vitavision/charts` and `@vitavision/stage2d` (`ImageStage`,
`MeasureOverlay`, value planes). `@vitavision/lab-ui` is now a deprecated re-export of the four
with the identical 0.5 surface; its `styles.css` imports the four stylesheets, each of which
declares its own Tailwind `@source`, so consumers no longer need an `@source` line.

Optional props that forward a value now accept `undefined` explicitly (for consumers on
`exactOptionalPropertyTypes`).
