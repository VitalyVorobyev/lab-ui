# ADR-0003: Type family — IBM Plex Sans + IBM Plex Mono (D1)

- Status: Accepted
- Date: 2026-09-27. The owner decided after reviewing the L3-1 specimen (Storybook →
  Foundations → *Type family (D1)*, PR #35).
- Evidence: the comparison below, measured for the specimen. The measurement record it came from is in the git history (`docs/measurements/l3-1-foundations.md`, removed 2026-10).

## Decision

The default type pair of every `@vitavision/*` package and every migrated app is
**IBM Plex Sans** (variable) for text and **IBM Plex Mono** for values. It replaces Inter and
Geist Mono in vitavision and calibration-rs as each app migrates (L3-3..n). **Source
Serif 4** stays on vitavision's editorial pages (spec §7).

## Comparison

Before the decision, lab-ui and VAL used IBM Plex Sans/Mono, and vitavision and calibration-rs
used Inter/Geist Mono. Measured from the files each candidate would ship (`tools/visual-language/fonts.py`):

| | IBM Plex Sans + IBM Plex Mono | Inter + Geist Mono |
|---|---|---|
| x-height / em | 0.516 (mono 0.516) | 0.546 (mono 0.530): about 6 % larger at the same px |
| Width of a typical inspector line | 24.0 em | 25.0 em: about 4 % wider |
| Sans digits | tabular by default: prose and tables align with no feature | proportional; tabular needs `tnum` |
| Side effect of `tnum` | none (Plex has no `tnum`) | also re-spaces `- . , : ( ) + − ×`, so global tabular figures visibly space the hyphens in prose |
| I / l / 1 | distinct (`l` has a tail) | identical `I` and `l` by default; `cv05` + `cv08` fix it (serifed `I`, tailed `l`) |
| Mono zero | dotted in fontsource's build, which drops `zero`; slashed in IBM's complete build, where the existing `slashed-zero` rule works | slashed by default |
| Files | Plex Sans 45 KB + Plex Mono 48 KB per weight (IBM complete; a latin subset that keeps `zero` would be ~15 KB) | Inter 97 KB (latin, `opsz` + `wght`) + Geist Mono 23 KB |
| npm source | fontsource + `@ibm/plex-mono` (IBM) | `inter-ui` (a third-party repackaging; Inter's author does not publish to npm) + fontsource |
| Personality | engineered, slightly technical, IBM | neutral, contemporary, the default of many products |

## Why

- **Numbers:**
  - Plex Sans digits are tabular by default, so columns and live readouts align without a
    font feature.
  - Plex has no `tnum`, so the global `tabular-nums` changes nothing else. With Inter,
    `tnum` also re-spaces `- . , : ( ) + − ×` in prose.
- **Legibility:** `I`, `l` and `1` are distinct by default. Inter needs `cv05` and `cv08`
  for that, and those features are only in a third-party npm repackaging.
- **Character:** engineered and technical. That suits an instrument UI, and lab-ui and VAL
  already use it.
- **Supply:** IBM publishes the fonts on npm itself (`@ibm/plex-mono`, `@ibm/plex-sans`).

## Consequences

- **The mono build must carry `zero`.** fontsource's Plex Mono drops the feature, so
  `slashed-zero` silently shows Plex's dotted zero. The build must keep `zero` in weights
  400 and 500: IBM's complete or split (Latin1, 17.5 KB) files, or a subset made from them.
  **L3-2** decides how the build reaches the apps. The candidate is font-face CSS owned by
  `@vitavision/ui`, so every app loads the same files. Until then, fontsource remains the
  documented way to load Plex.
- **The font tokens are unchanged:** `--font-sans` and `--font-mono` in
  `@vitavision/ui/styles.css` already name Plex.
- **vitavision and calibration-rs** change their text font when they adopt `ui`. At the
  same pixel size Plex is about 6 % smaller (x-height) and 4 % narrower than Inter.
  Their visual baselines move in those PRs, not in a separate one.
- **Storybook cleanup (L3-2):** the Inter comparison is retired. That removes the
  toolbar's **Type** switch, `inter-ui` and Geist Mono. *Foundations / Type family* becomes
  the Plex specimen.

## Update — L3-2 (2026-09-27)

- **Delivery is settled.** `@vitavision/ui/fonts.css` serves Plex Sans (variable,
  fontsource's files) and IBM's split Plex Mono 400/500, vendored into the package by
  `tools/visual-language/vendor-fonts.ts`. Apps import it next to `styles.css`.
- **The Inter comparison is gone from Storybook.** *Foundations / Type* is the Plex specimen.
