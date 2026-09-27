# L3-1: measurements behind the visual-language spec

These are the numbers behind `docs/visual-language.md` §2 (D1), §4 and §5.

- **Measured:** 2026-09-27, macOS / Apple M-series, Chromium from Playwright 1.63.
- **lab-ui:** branch `l3-1-foundations`, on `main` at `1165e4e` (#34).
- **Reproduce** at `15aad00` (L3-2 replaced the candidates with the vendored Plex), from the repo root, after `bun install`:

  ```bash
  uv run --with fonttools --with brotli python tools/visual-language/fonts.py
  python3 tools/visual-language/colours.py
  ```

## Type families (D1)

The fonts are measured from the files each candidate would ship. The glyph findings come
from rendering them in Chromium; they are in the *Confusables* story.

Sample line: `Reprojection error 0.184 px, 42 frames, 1736 corners`

| Font | x-height / em | cap height / em | sample width | digits tabular by default | features of interest | axes | woff2 file |
|---|---|---|---|---|---|---|---|
| IBM Plex Sans (fontsource, variable) | 0.516 | 0.698 | 24.03 em | yes | frac | wght 100–700 | 45 KB |
| Inter (inter-ui, variable latin) | 0.546 | 0.728 | 24.96 em | no (needs tnum) | tnum, zero, cv05, cv08, case, frac | opsz 14–32; wght 100–900 | 97 KB |
| IBM Plex Mono 400 (fontsource) | 0.516 | 0.698 | 31.20 em | yes | frac | static | 14 KB |
| IBM Plex Mono 400 (IBM complete) | 0.516 | 0.698 | 31.20 em | yes | zero, frac | static | 48 KB |
| Geist Mono (fontsource, variable) | 0.530 | 0.710 | 31.20 em | yes | frac | wght 100–900 | 23 KB |

**Findings**
- **fontsource subsets strip features.** Its Plex Mono has no `zero`, so the existing
  `slashed-zero` rule silently falls back to Plex's dotted zero. Its Inter has no
  `cv05`/`cv08`/`zero`. IBM's complete Plex Mono and inter-ui's Inter keep them.
- **Inter's `tnum` substitutes 51 glyphs,** including `- . , : ( ) + − ×`. Under
  lab-ui's global `tabular-nums` this puts visible space around hyphens in prose
  ("Saddle - point"). Plex's digits are tabular by default and Plex has no `tnum`, so
  the rule changes nothing there.
- **Capital I and lowercase l:** Inter draws them identically unless `cv05` (tailed l)
  and `cv08` (serifed I) are on. Plex distinguishes them by default.
- **The zero:** Geist Mono's is slashed by default. Plex Mono's is dotted unless the build
  carries `zero`.

## Colour vision

### Categorical series: closest pair per simulation

| theme | simulation | min ΔE | pair |
|---|---|---|---|
| light | none | 16.3 | 3 / 4 |
| light | protan | 9.4 | 5 / 6 |
| light | deutan | 9.9 | 1 / 3 |
| light | tritan | 10.2 | 4 / 6 |
| dark | none | 14.7 | 2 / 6 |
| dark | protan | 9.1 | 3 / 5 |
| dark | deutan | 9.5 | 3 / 5 |
| dark | tritan | 9.5 | 4 / 6 |

### Chrome: signal against each verdict

| theme | pair | worst ΔE | under |
|---|---|---|---|
| light | signal / normal | 1.7 | tritan |
| light | signal / defect | 15.0 | deutan |
| light | signal / warn | 14.3 | protan |
| dark | signal / normal | 1.7 | tritan |
| dark | signal / defect | 14.5 | deutan |
| dark | signal / warn | 20.6 | protan |

### Overlay roles: OKLCH search

Fixed: {'selection': '#3bc9db', 'label': '#e8ebed', 'normal': '#34d399', 'defect': '#f87171', 'warn': '#fbbf24'}

- a: #77a2fc  (oklch 0.72 0.14 264)
- b: #ed9d43  (oklch 0.76 0.14 66)

Worst-case ΔE between any two overlay colours, or an overlay colour and a verdict: 7.4
Worst-case ΔE between a and b: 25.7

**Findings**
- **Overlay colours.** A magenta `feature` against cyan `selection` measured **1.9**
  under deuteranopia, so the first-draft overlay colours were replaced by the searched
  pair above.
- **Chrome.** `signal` against `normal` is **1.7** under tritanopia in both themes:
  "selected" and "passed" become the same colour. This is open for L3-2.
- **Series palette.** The dark palette's closest pair under protanopia is 9.1, below the
  9.4 that `packages/charts/src/styles.css` states. The light palette meets 9.4. This
  is open for L3-2.
