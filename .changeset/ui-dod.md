---
"@vitavision/ui": minor
---

`@vitavision/ui` meets the PLAN §4 Definition of Done (L1-5): axe finds 0 serious/critical
issues in every story in both themes, every export is documented (0 `ae-undocumented`), lint
reports 0 problems, and every file meets its coverage threshold.

**Visible: colour tokens.** Seven token values change so that text reaches WCAG AA (4.5:1).
Hues are unchanged; the light theme's accent, verdict colours and quiet greys are darker. In the
dark theme only `--fg-subtle` changes. Ratios are measured against `--ground` (#eef1f2 light), the
darkest light background the tokens sit on, or against the named background.

| Token | Theme | Old | New | Pair measured | Old ratio | New ratio |
|---|---|---|---|---|---|---|
| `--fg-subtle` | light | `#8b949b` | `#646d74` | on `ground` / on `surface` | 2.72 / 3.09 | 4.65 / 5.27 |
| `--fg-subtle` | dark | `#616a71` | `#838d94` | on `overlay` / on `surface` | 2.83 / 3.26 | 4.61 / 5.31 |
| `--fg-muted` | light | `#5f6871` | `#5b646d` | callout text on `defect/8` over `ground` (old: old `--defect`; new: new) / on `ground` | 4.43 / 4.99 | 4.65 / 5.30 |
| `--signal` | light | `#0e8fa3` | `#0a6b7a` | `signal-fg` (#fff) on `signal` (primary button) | 3.83 | 6.18 |
| | | | | `signal` text on `signal/12` over `ground` (info badge) | 2.95 | 4.60 |
| | | | | `signal` text on `signal/15` over `surface` (Tabs count) | 3.20 | 4.95 |
| `--signal-strong` | light | `#0b7080` | `#085763` | `signal-fg` on it (primary hover) — kept darker than `signal` | 5.76 | 8.22 |
| `--normal` | light | `#059669` | `#046e4d` | text on `normal/12` over `ground` (badge) | 2.90 | 4.67 |
| `--defect` | light | `#dc2626` | `#b31d1d` | text on `defect/12` over `ground` (badge) | 3.55 | 4.88 |
| | | | | text on `defect/10` over `ground` (danger button) | 3.66 | 5.05 |
| `--warn` | light | `#b45309` | `#9d4808` | text on `warn/12` over `ground` (badge) | 3.78 | 4.63 |

One class changes with them: the `danger` button's hover tint is `bg-defect/15` (was `/20`),
so its label keeps 4.63:1 on hover. Residue for L3-2: with AA as the floor, `fg-subtle` now sits
close to `fg-muted` in both themes, so the two-step grey hierarchy is mostly carried by size and
weight; the token-pair contrast tests of L3-2 should revisit the scale as a whole.

**Accessibility.**

- `Slider`: `aria-label` is set on the thumb (the `role="slider"` element), not the root.
- `ProgressBar`: has an accessible name — new `aria-label` prop, defaulting to `label`, then
  "Progress".
- `Dialog`: a body that overflows its height cap becomes a keyboard tab stop (with the focus
  ring) and carries `data-overflowing`; a body that fits adds no tab stop.
- `Select`: controlled for its whole lifetime (`value=""` is Radix's own "no selection"), which
  removes React's controlled/uncontrolled warning; `""` still means unset. While the list is open
  the trigger leaves the tab order, since Radix hides it from assistive technology.
- `Field`: the description and the error are wired into the control's `aria-describedby`, and an
  error sets `aria-invalid`, for `Input`, `NumberInput`, `Textarea`, `Select`, `Slider`,
  `SegmentedControl` and `Checkbox`; with `as="group"` they describe the group. The description and
  error now sit outside the `<label>` (a new outer `<div>` carries `className`), so they are no
  longer read as part of the control's name.
- `Switch` and `Checkbox` wire their own `description` into `aria-describedby`.
- `Tabs`: roving focus — one tab stop, ←/→ move to and select the previous/next enabled tab,
  Home/End jump to the ends. New optional `idPrefix` gives the tabs ids and the active tab
  `aria-controls` for the panel the caller renders.

**API (additive).**

- `className` (merged with `cn`) on `StatusDot`, `CountRun`, `Dialog`, `ConfirmDialog`,
  `ErrorBox`, `Empty`, `ProgressBar`, `Section`, `PageHeader`, `Switch`, `Checkbox`, `ToggleChip`.
- State as `data-*`: `data-tone` (`Badge`, `StatusDot`, `Callout`), `data-variant`/`data-loading`
  (`Button`, `ButtonLink`), `data-state` (`Tabs`, `ToggleChip`, `SegmentedControl` segments, the
  active `Table` row), `data-invalid`/`data-required` (`Field`), `data-disabled`
  (`SegmentedControl`, `Slider` via Radix), `data-complete` (`ProgressBar`), `data-theme-choice`
  (`ThemeToggle`).
- `Button`, `ButtonLink`, `Input`, `NumberInput` and `Textarea` take their element's full props,
  `ref` included (React 19 ref-as-prop).
- `Select` and `Slider` take `aria-describedby`.
- Newly exported types: `ButtonVariant`, `ButtonSize`, `CalloutTone`.
- `ThemeToggle` reads the stored choice with `useSyncExternalStore` instead of an effect: the
  server and hydrating renders still show "system", and a change made in another tab is picked up until this toggle is next clicked.
- `theme.ts` guards its `window`/`document` access, so `resolveTheme`, `readThemeChoice` and
  `setThemeChoice` are safe to call on the server.
