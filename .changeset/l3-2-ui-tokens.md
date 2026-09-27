---
"@vitavision/ui": minor
---

Tokens meet WCAG AA in both themes, now held by unit tests; IBM Plex ships with the package.

- `line-strong`, the border that identifies a control, is ≥ 3:1 against the page and panels (WCAG 1.4.11): `#c8cdd1` → `#878b8f` light, `#3a4147` → `#666e74` dark. Inputs, selects, segmented controls, switches, checkboxes and secondary buttons get a firmer outline.
- `signal` and `normal` are told apart by a reader with tritanopia (they were 1.7 OKLab ΔE×100 apart, now ≥ 8): light `signal` `#0a6b7a` → `#235159`, `signal-strong` `#085763` → `#1c3e44`, `normal` `#046e4d` → `#086e4c`; dark `signal` `#3bc9db` → `#2db2d4`, `signal-strong` `#6fdde8` → `#5fc7e0`, `normal` `#34d399` → `#2edeac`.
- New `@vitavision/ui/fonts.css`: IBM Plex Sans (variable) and IBM Plex Mono 400/500 (IBM's build, which keeps the `zero` feature, so mono values get the slashed zero `styles.css` asks for). Import it next to `styles.css` and drop any fontsource Plex.
- `Select`'s trigger follows density like every other control (28 px when compact).
