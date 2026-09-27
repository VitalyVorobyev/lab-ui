# ADR-0003: Type family — IBM Plex Sans + IBM Plex Mono (D1)

- Status: Accepted
- Date: 2026-09-27. The owner decided after reviewing the L3-1 specimen (Storybook →
  Foundations → *Type family (D1)*, PR #35).
- Evidence: `docs/visual-language.md` §2, and `docs/measurements/l3-1-foundations.md`.

## Decision

The default type pair of every `@vitavision/*` package and every migrated app is
**IBM Plex Sans** (variable) for text and **IBM Plex Mono** for values. It replaces Inter and
Geist Mono in vitavision and calibration-rs as each app migrates (L3-3..n). **Source
Serif 4** stays on vitavision's editorial pages (spec §7).

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
