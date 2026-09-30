# L3-3: calibration-rs `app/` adopts `@vitavision/ui`

The calibration-rs desktop app (Tauri 2 + React) dropped its local UI kit and moved to the published `@vitavision/ui` ^0.8.0. That includes its tokens, IBM Plex and its theme handling. The user chose full adoption on 2026-09-30: one visual language across the studio apps.

- **Measured:** 2026-09-30, macOS / Apple M-series, Chromium from Playwright.
- **calibration-rs:** PR [#142](https://github.com/VitalyVorobyev/calibration-rs/pull/142), merged as `0c623a3b`.
  - It landed after [#121](https://github.com/VitalyVorobyev/calibration-rs/pull/121) (`69426e12`, the P2-4 3D viewer on `@vitavision/three`), so the two shared a single resolution of `index.css`, `package.json` and the README.
- **lab-ui:** the packages were published in #42 (`a60a0aa`).

## Done-when (PLAN L3-3)

| Criterion | Result |
|---|---|
| Concept matrix: 0 local implementations of the ui concepts in calibration-rs | ✅ Every ui concept shows ◆ `@vitavision/ui` or is absent. 9 `impl` entries became `uses`. |
| G5.1 holds in the migrated directories | ✅ `tokensOnly(["src/**"])` from `@vitavision/config-eslint` runs in `app/eslint.config.js` with 0 errors and 0 warnings. |

**G5.1 exemptions** (each with its reason in the config):
- `src/lib/errorColors.ts`: the residual severity colour ramp.
- `src/workspaces/Viewer3DWorkspace/LaserTargetCuts.tsx`: the per-laser three.js palette.

`lib/configForm.tsx` still has inline inputs and checkboxes. The matrix notes them under switch and input, and they belong to the schema-form concept, which **L4-1** consolidates into `@vitavision/forms`.

## What replaced what

| calibration-rs (deleted) | `@vitavision/ui` |
|---|---|
| `components/ui/Button` (+ `pressed`) | `Button`; 11 on/off toggles → `ToggleChip`; Depth view mode → `SegmentedControl` |
| `components/ui/Banner` | `ErrorBox`, `Callout` |
| `components/ui/Badge` | `Badge` (topologies neutral: verdict tones are for verdicts) |
| `components/ui/Panel`, `SectionHeader` | `Panel` (`title`, `actions`), compact density in the side rails |
| `components/ui/Select` | `Select` |
| `components/ui/Table` | `Table` (per-pose stats) |
| `components/ui/EmptyState` | `Empty` |
| `RunWorkspace/AskUserModal` | `Dialog`, `Input` |
| `RunWorkspace/CollapsibleSection` | `Disclosure` |
| theme toggle in `layouts/AppShell` | `ThemeToggle storageKey="calib-theme"`, `initTheme`, no-flash script |
| HSL token system, Inter / Geist Mono, 14 px root | `@vitavision/ui/styles.css` + `fonts.css` |

The cameras × poses residual matrix stays a raw `<table>` on token classes. It needs sticky row headers and per-cell buttons, which the data-driven `Table` does not offer.

## Gates (calibration-rs `app/`, PR #142)

| Gate | Result |
|---|---|
| lint | 0 errors, 0 warnings (tokensOnly on) |
| format, typecheck, build | ✅ |
| Vitest | 64 / 64: 63 existing + 1 new (`aria-current` on the selected pose row). Two tests changed selectors where the markup legitimately changed. |
| Playwright smoke | 7 / 7, zero console errors |
| CI (9 jobs) | ✅ all pass |

## Screenshots

The change is intentionally visual, so no pixel threshold applies. Before-and-after screenshots were reviewed by eye, each in light and dark:
- every workspace empty;
- Diagnose with the planar fixture, with and without the stats rail;
- the Run page with an error callout, with the manifest and JSON disclosures open, and with the ask-user dialog.

**Gap:** there is still no rig fixture (as in L2-3), so the Epipolar, Depth and 3D toolbars with a rig export loaded are covered only by typecheck and lint.
