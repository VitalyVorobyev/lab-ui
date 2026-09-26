---
"@vitavision/charts": minor
---

**Breaking (values, not names):** chart colours are design tokens now, not hex strings.

- `SERIES_COLOURS` is `["var(--series-1)", …, "var(--series-6)"]`, and `seriesColour(i)`
  returns those. The palette is defined in `@vitavision/charts/styles.css` for the light
  and the dark theme, so that stylesheet must be imported (after `@vitavision/ui/styles.css`)
  for series to be coloured. Code that parsed or manipulated the hex strings (alpha
  suffixes, `color-mix` on a literal) has to work on the CSS value instead.
- The palette itself changed. Old (both themes): `#3bc9db #f0883e #a78bfa #34d399 #f87171
  #8b949b`. New, light: `#0f92c5 #b57c38 #7e5be6 #482ab3 #e04b9b #595f65`; dark:
  `#27e4ef #c27421 #8ba3ff #4a6ee0 #f96dcc #7f878d` — cyan, orange, violet, blue, pink,
  neutral. The old series 4 and 5 were the dark theme's verdict colours, which PLAN §5
  forbids; every new colour holds 3:1 against the panel in its theme, and all six stay
  apart under simulated protanopia, deuteranopia and tritanopia.
- `NORMAL_COLOUR` is `"var(--normal)"` and `DEFECT_COLOUR` is `"var(--defect)"` — the
  `@vitavision/ui` verdict tokens, so they follow the theme too.
- Every chart (`Frame`, `Legend`, `LineChart`, `LineProfile`, `ScoreHistogram`,
  `StackedBars`) accepts `className`, merged with `cn`.
- New prop types: `LegendProps`, `LegendItem`, `StackedBarsProps`.
- Every export has TSDoc; the API report has no undocumented items.
