# @vitavision/lab-ui — deprecated

This package was split. It now only re-exports the four packages below, with the identical
0.5 surface, so an existing consumer keeps working while it migrates. New code should depend
on the packages directly.

| Import from `@vitavision/lab-ui` | Now lives in |
|---|---|
| tokens, `initTheme` & theme helpers, `ThemeToggle`, `Tabs`, every primitive, `toneColor` | [`@vitavision/ui`](../ui) |
| `SchemaForm`, `describeFields`, `initialValues`, `toOptions`, … | [`@vitavision/forms`](../forms) |
| `LineChart`, `StackedBars`, `ScoreHistogram`, `LineProfile`, `Frame`, scales | [`@vitavision/charts`](../charts) |
| `ImageStage`, `StageToolbar`, view math, `ZoomPanCanvas`, `MeasureOverlay`, `decodePlane` & co. | [`@vitavision/stage2d`](../stage2d) |

## Migrating

1. `bun add @vitavision/ui` (plus whichever of `forms`, `charts`, `stage2d` you use).
2. Rewrite imports: every name keeps its name; only the module changes.
3. In your CSS entry, replace `@import "@vitavision/lab-ui/styles.css";` with one import per
   package, and drop the `@source "…/@vitavision/lab-ui/dist";` line — each package's
   stylesheet declares its own.
4. `bun remove @vitavision/lab-ui`.

Until then, `@vitavision/lab-ui/styles.css` imports all four stylesheets, and the old `@source`
line is harmless.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
