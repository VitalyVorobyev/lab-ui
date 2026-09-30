# L3-3: calib-targets-rs `studio/` adopts `@vitavision/ui`

Calib Targets Studio adopted `@vitavision/ui` ^0.8.0. Before this the studio had no Tailwind: it used its own dark-first CSS tokens and plain class names. It now runs on Tailwind 4, the ui tokens and IBM Plex. The detection overlays are untouched: they stay locked to the bench CLI's PNG conventions.

- **Measured:** 2026-09-30, macOS / Apple M-series, Chromium from Playwright.
- **calib-targets-rs:** PR [#107](https://github.com/VitalyVorobyev/calib-targets-rs/pull/107), merged as `13816455`.

## Done-when (PLAN L3-3)

| Criterion | Result |
|---|---|
| Concept matrix: 0 local implementations of the ui concepts in ct-studio | ✅ See the replacements below; every ui concept the studio uses is ◆ `@vitavision/ui`. |
| G5.1 holds in the migrated directories | ✅ `tokensOnly(["src/**"])`, with no exemptions. The overlay palettes are `rgb()` data in `overlays.ts` / `diagnoseOverlays.ts`, which the rule does not flag. |

**Replacements:**
- `DiffTable` → `Badge` + data-driven `Table`
- `InfoTip` → `InfoHint`
- `LayerToggles` → `ToggleChip`
- Inline buttons, selects and inputs → `Button`, `Select`, `NumberInput`, `Input`, `Field`
- Also used: `Tabs`, `SegmentedControl`, `Panel`, `ProgressBar`, `ErrorBox`, `Empty`, `PageHeader`

`ParamForm` / `ConfigEditor` keep their structure (the schema-form concept, L4-1), restyled with ui primitives.

**Theme:** the studio stays dark by default for its grayscale imagery. On first load the no-flash script stores `"dark"` under `ct-studio-theme`, an ordinary choice in ui's storage contract. `ThemeToggle` offers system and light.

## Gates (`studio/`, PR #107)

| Gate | Result |
|---|---|
| lint | 0 errors · 27 warnings (main: 30) |
| `tsc -b`, build | ✅ |
| `cargo build --release -p calib-targets-studio` | ✅ |
| `test:screens` (7 screens, local baseline) | All load; the only differences are the intended restyle (ratios 0.01–0.07). Refresh the local baseline with `--update-snapshots`. |
| Overlay parity | The image and overlay region is pixel-identical to main on Detect, Config, Diagnose, Baseline, advanced config and ChArUco, in both themes. Compare shifts about 9 px (taller header) with the same overlay pixel counts. |
| Console | 0 errors on every screen. `/compare` without a label logs the same 2 × 404 as main. |
| CI (8 jobs) | ✅ |

**Fixed on the way:**
- The diagnose funnel bars were drawn at equal widths; they are now proportional.
- Arrow-key image navigation no longer fires when a tab strip, open select or radio group has already handled the key.

## Remaining in ct-studio (other layers)

These belong to L4-1 (forms), L6 (stage2d) and L7 (overlays):
- `ParamForm` / `ConfigEditor`
- `CanvasViewport`
- the overlays
