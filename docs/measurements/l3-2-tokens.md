# L3-2: the token update in `@vitavision/ui`

Contrast (WCAG 2.2 AA) and colour-vision checks now run as unit tests. The tokens were
changed until both pass.

- **Measured:** 2026-09-27, macOS / Apple M-series.
- **lab-ui:** branch `l3-2-tokens`, on `main` at `15aad00` (#35).
- **Owner's choice:** "A + B, both themes". That means control borders at 3:1, and
  `signal`/`normal` retuned for tritanopia. It was made from before/after renders of the
  inspector in both themes.

## Token changes

| Token | Light | Dark | Why |
|---|---|---|---|
| `line-strong` | `#c8cdd1` → `#878b8f` | `#3a4147` → `#666e74` | Control boundary ≥ 3:1 on ground, surface and overlay (WCAG 1.4.11). It was 1.4–1.9:1. |
| `signal` | `#0a6b7a` → `#235159` | `#3bc9db` → `#2db2d4` | Apart from `normal` under tritanopia; it was 1.7. |
| `signal-strong` | `#085763` → `#1c3e44` | `#6fdde8` → `#5fc7e0` | Follows `signal`, the hover state. |
| `normal` | `#046e4d` → `#086e4c` | `#34d399` → `#2edeac` | The other half of the separation. |
| charts `--series-3` | unchanged | `#8ba3ff` → `#7ba8ff` | Pairwise ≥ 9.4 under protanopia; it was 9.1. |
| overlay `model` | `#77a2fc` → `#9dbdff` | (one set) | It was 2.7 from the new selection colour. The search is re-run below. |

**How the values were chosen.** The retune was searched in OKLCH, with
`tools/visual-language/colours.py` giving the numbers. Every text and boundary pair
below had to pass, while moving the least from the 0.6 values.
- In the light theme, `signal` must stay dark enough for 4.5:1 text on every surface and
  on its own tint. That leaves hue as the only lever, and 8.1 is the best reachable
  separation from `normal` under tritanopia.
- The spec therefore also requires a non-colour cue: a verdict carries text or an icon, and
  a selection carries a shape.

## Tests

- **`packages/ui/src/contrast.test.ts`: 76 tests, all passing.** For each theme it
  checks:
  - every text token (`fg`, `fg-muted`, `fg-subtle`, `signal`) on
    `ground`/`surface`/`raised`/`overlay`, at ≥ 4.5;
  - `signal-fg` on `signal` and on `signal-strong`, at ≥ 4.5;
  - each verdict and `signal` as text on its /12 tint over `surface` and over `ground`,
    and `defect` on the danger button's /10, at ≥ 4.5;
  - `line-strong` against `ground`/`surface`/`overlay`, and `signal` as focus or
    checked fill on every surface, at ≥ 3;
  - `signal` against each verdict under every dichromacy: ≥ 8 light, ≥ 9.3 dark.
- **`packages/charts/src/palette.test.ts`: 16 tests, all passing.** Every series colour
  is ≥ 3:1 on `surface` and `ground`, and every pair is ≥ 9.4 under every dichromacy,
  in both themes.
- **`@vitavision/config-vitest/colour`** holds the maths both test files share, with its
  own tests. It matches `colours.py` to two decimals; the 0.6 tritanopia pair is 1.72 in
  both.

## Colour vision after the change

### Categorical series: closest pair per simulation

| theme | simulation | min ΔE | pair |
|---|---|---|---|
| light | none | 16.3 | 3 / 4 |
| light | protan | 9.4 | 5 / 6 |
| light | deutan | 9.9 | 1 / 3 |
| light | tritan | 10.2 | 4 / 6 |
| dark | none | 14.7 | 2 / 6 |
| dark | protan | 9.6 | 5 / 6 |
| dark | deutan | 9.5 | 1 / 5 |
| dark | tritan | 9.5 | 4 / 6 |

### Chrome: signal against each verdict

| theme | pair | worst ΔE | under |
|---|---|---|---|
| light | signal / normal | 8.1 | tritan |
| light | signal / defect | 8.8 | protan |
| light | signal / warn | 11.4 | protan |
| dark | signal / normal | 9.4 | tritan |
| dark | signal / defect | 15.4 | protan |
| dark | signal / warn | 23.3 | protan |

### Overlay roles: OKLCH search

Fixed: {'selection': '#2db2d4', 'label': '#e8ebed', 'normal': '#2edeac', 'defect': '#f87171', 'warn': '#fbbf24'}

- a: #ed9d43  (oklch 0.76 0.14 66)
- b: #9dbdff  (oklch 0.8 0.1 264)

Worst-case ΔE between any two overlay colours, or an overlay colour and a verdict: 7.3
Worst-case ΔE between a and b: 22.1

## Fonts (`@vitavision/ui/fonts.css`)

Sample line: `Reprojection error 0.184 px, 42 frames, 1736 corners`

| Font | x-height / em | cap height / em | sample width | digits tabular by default | features of interest | axes | woff2 file |
|---|---|---|---|---|---|---|---|
| IBM Plex Sans (variable, latin) | 0.516 | 0.698 | 24.03 em | yes | frac | wght 100–700 | 45 KB |
| IBM Plex Mono 400 (IBM, Latin1) | 0.516 | 0.698 | 31.20 em | yes | zero, frac | static | 17 KB |
| IBM Plex Mono 500 (IBM, Latin1) | 0.516 | 0.698 | 31.20 em | yes | zero, frac | static | 17 KB |

`check:consumer` packs the packages and builds a scratch Vite app that imports
`@vitavision/ui/fonts.css`. The build emits all 10 woff2 files, so the relative URLs
resolve from an installed package.
