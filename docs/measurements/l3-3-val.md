# L3-3: VAL `frontend/` moves from `@vitavision/lab-ui` to the split packages

VAL's frontend left the deprecated, frozen `@vitavision/lab-ui` 0.5 facade for the packages it re-exported: `@vitavision/ui` ^0.8.0, `forms` ^0.6.2, `charts` ^0.6.2 and `stage2d` ^0.7.0. This brings in the L3-2 tokens and the self-hosted IBM Plex.

- **Measured:** 2026-09-30, macOS / Apple M-series, Chromium from Playwright.
- **visual-anomaly-lab:** PR [#165](https://github.com/VitalyVorobyev/visual-anomaly-lab/pull/165), merged as `d41cd634`.

## Done-when (PLAN L3-3)

| Criterion | Result |
|---|---|
| Concept matrix: 0 local implementations of the ui concepts in VAL | ✅ `RailSection` → ui `Section`; `ChannelTabs` → ui `Tabs`, with pure `channelTabItems`. Every ui concept is now ◆ `@vitavision/ui`. |
| G5.1 holds in the migrated directories | ✅ `tokensOnly(["src/**"])` covers the whole frontend. |

**G5.1 exemptions** (each with its reason in the config):
- `src/api/classPalette.ts`: annotation class colours are user data, stored by the backend.
- `src/components/CrashScreen.tsx`: it must draw without the stylesheet.
- One line-level disable: the mask's zero value in `annotationBitmap.ts`.

`uiRules.test.ts` drops its `hex-colour` allowances and gains a `lab-ui-import` rule with no allowance.

## Breaking changes handled

| Change | What VAL had to do |
|---|---|
| ui 0.6 is router-free | `ButtonLink asChild` ×15, `PageHeader back={<Link/>}` ×3, `ReadoutStrip` `link` ×3 |
| charts 0.6 colours are tokens (`var(--series-n)`) | Canvas label painting and server tile URLs need bytes, so `labelPaint.ts` resolves the token from the live theme (`resolveColour` / `classRgb` / `colourHex`). Before this, `rgbOf` was silently turning every class grey, and the old tests compared grey with grey. |
| Class palette moved to `src/api/classPalette.ts` | The backend's palette-parity test (`test_imported_truth.py`) now reads the new file. |

## Gates (`frontend/`, PR #165)

| Gate | main | PR |
|---|---|---|
| lint | 0 errors · 139 warnings | 0 errors · 139 warnings (identical per rule) |
| typecheck, build | ✅ | ✅ |
| vitest | 666 | 669 |
| screens spec, 17 routes × light/dark (fresh seeded backend, spare ports) | 34 / 34 | 34 / 34, plus 5 extra routes |
| CI (8 jobs) | | ✅ |

The change is intentionally visual. Per-screen pixel differences are 0–2.4 %, from the token values and the rail sections. Before/after pairs were reviewed in both themes.

## Remaining in VAL (other layers)

These belong to L5 (charts) and L6 (stage2d):
- `CurveChart` / `CompareCurves`
- `AnnotationCanvas`
- `pixelReadout`
- `LabelLayer`
