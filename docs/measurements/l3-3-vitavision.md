# L3-3: vitavision adopts `@vitavision/ui`

The vitavision website moved onto `@vitavision/ui` ^0.8.0 in two PRs. It deploys to Cloudflare from `main`, so both went live on merge.

- **Measured:** 2026-09-30, macOS / Apple M-series, Chromium from Playwright; the live site was checked after each deploy.
- **vitavision:**
  - PR [#168](https://github.com/VitalyVorobyev/vitavision/pull/168), merged as `a890e077`: the foundation (tokens, base styles, IBM Plex, theme).
  - PR [#169](https://github.com/VitalyVorobyev/vitavision/pull/169), merged as `2ee7dcc9`: the interactive components and G5.1.
- **User decisions (2026-09-30):**
  - Editorial pages keep Source Serif 4 body text, heading tracking and prose widths (§7).
  - Headings, UI and code move to IBM Plex (D1).
  - The editor's field components are replaced outright, dropping the touch-mode extras.

## Done-when (PLAN L3-3)

| Criterion | Result |
|---|---|
| Concept matrix: 0 local implementations of the ui concepts in vitavision | ✅ The 8 `impl` files are deleted, and every ui concept the site uses is ◆ `@vitavision/ui` (replacements below). The notes that remain are editorial (badges, atlas tabs, navigation buttons) or sonner, which ui has no replacement for. |
| G5.1 holds in the migrated directories | ✅ `tokensOnly(["src/**"])` covers the whole site. |

**Replacements:**
- `RailSection` → `Panel`
- `SelectField` → `Select` / `SegmentedControl`
- `ConfigModal` → `Dialog`
- `ui/Tooltip` → ui `Tooltip`
- `fieldChrome` → `InfoHint` + `Field`
- `CheckboxField` → `Checkbox`
- `NumberField` (114 uses) → `NumberInput`
- `sections` → `Section` / `Disclosure`

**G5.1 exemptions:**
- `src/generated/**`: Shiki output.
- Per-feature data colours.
- Printed-target ink.
- The ChESS figure's named hues.

Editorial status and category colours come from an ink layer in `editorial-tokens.css`, checked by script: minimum 4.95:1 (light) and 5.57:1 (dark) against every background.

## Theme and CSP

- `next-themes` is replaced by ui's `initTheme` / `ThemeToggle`. The storage key stays `theme`, so returning visitors keep their choice.
- The default is "system" on the server too; previously the SSR forced dark.
- The CSP now has a single inline-script hash, `sha256-vA82SeF7…Wg=`. It matches all 841 prerendered pages, and the live header serves it.

## Gates

| Gate | main (before) | after #169 |
|---|---|---|
| lint | 0 errors · 160 warnings | 0 errors · 158 warnings |
| vitest | 894 | 893 (−16 removed with `numberUtils`, +15 new) |
| build + prerender | ✓ | ✓ 840 pages |
| `content:validate`, `ds:validate` | ✓ | ✓ |
| CI (`build-frontend`, `validate-content`) | ✓ | ✓ |
| Live site: routes × light/dark in Chromium | | 0 console errors, 0 CSP violations |

**Bundle, after #168:**
- Main JS +7.9 kB gzip (the ui runtime).
- CSS −27.1 kB gzip.
- All JS+CSS −18 kB gzip.
- Fonts 952 → 680 kB.

## Screenshots

The change is intentionally visual. The 17-route × 2-theme suite was reviewed before and after each PR, with extra shots of:
- the editor with results, the config dialog and tooltips;
- the target-generator panels;
- the article illustrations;
- touch layouts.

After #169, 27 of the 34 route shots were pixel-identical to #168. The ones that changed are the editor, the target generator, the chess demo and one atlas badge.

**Caveat:** the local screenshots used a dummy Clerk key. The owner should run `test:screens` once with the real `.env.local`.

## Notes

- **Matrix header SHA:** the `concept-matrix.md` header lists vitavision at the local checkout's SHA. That checkout is on a blog branch, not `main`. The ui-concept paths don't depend on it, because `main` no longer has any of them.
- **Upstream issue:** ui's reduced-motion rule broke mermaid's layout; worked around here and filed as lab-ui#48.
- **Remaining vitavision implementations in other layers:**
  - schema forms (L4-3)
  - the editor canvas (L6)
  - the target overlays (L7)
