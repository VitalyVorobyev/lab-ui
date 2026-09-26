# @vitavision/charts

Small, hand-rolled SVG charts for the vitavision lab apps, on `@vitavision/ui` tokens.

```bash
bun add @vitavision/charts @vitavision/ui
```

```css
@import "@vitavision/ui/styles.css";
@import "@vitavision/charts/styles.css";
```

**Charts** — hand-rolled SVG over the pure domain/tick/project math in `scale.ts`:
`Frame` + `Legend` (the axes/grid/label shell every chart composes), `LineChart`
(multi-series, optional log y), `StackedBars`, `ScoreHistogram` (two-class distribution
with a threshold rule), and `LineProfile` (one or more series against arc length in pixels
along a scan line or caliper axis, with detected edges drawn as labelled vertical rules).

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
