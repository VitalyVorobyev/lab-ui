# @vitavision/ui

## 0.12.0

### Minor Changes

- d224648: `Table` sorts by column.
  
  - **Sortable columns.** Give a `Column` a `sortValue(row)` (a number, a string, or `null`/`undefined`) or a `compare(a, b)` (an ascending comparison, for an order one value cannot express, such as reading order by y then x) and its header becomes a button. Each click moves the column from its `firstSort` direction (default `"ascending"`; `"descending"` suits a score) to the other one, then back to the rows' own order. `sortable` overrides the default: `false` keeps a column with a `sortValue` unsortable, `true` with neither function makes a header sortable for an app that orders the rows itself.
  - **The order.** Numbers compare by value; strings by a fixed English collation that reads digit runs as numbers ("frame 9" before "frame 10"), so a server render and the browser agree; numbers come before strings; `null`, `undefined` and `NaN` go last in both directions. The sort is stable in both directions: rows that compare equal keep their order in `rows`. `compare` takes precedence over `sortValue`.
  - **State.** The table keeps the sort itself, starting from `defaultSort` (default `null`, unsorted), or follows a controlled `sort` (`{ key, direction }` or `null`) with `onSortChange`. With `manualSort` the headers show and report the sort while the rows render exactly as given, for an app that sorts on a server.
  - **Accessibility and styling.** The sorted header carries `aria-sort` and `data-sort` (`"ascending"` or `"descending"`); other sortable headers carry `data-sort="none"` and no `aria-sort`. The header button is reachable with Tab and pressed with Enter or Space; its arrow icon is hidden from assistive technology.
  - **Row indices.** `onRowClick`, `isRowActive`, `onRowHover` and `rowKey` receive each row's index in `rows`, whatever the order on screen.
  - **`sortRows(rows, columns, sort)`** returns the rows in the order the table shows them, for next/previous navigation, an export, or a server that should sort the same way. New types: `TableSort` and `SortDirection`.
  
  Columns without `sortValue`, `compare` or `sortable` render exactly as before, so an existing table is unchanged until a column opts in.

### Patch Changes

- c91bc50: `Table`'s last header cell no longer keeps right padding that its body cells drop, so the last column's header ends where its values do. A numeric last column's header is now flush right with its numbers.
- 1914f7f: READMEs, Storybook descriptions and editor documentation no longer refer to the project's internal tickets, decision records or private apps; the text now stands on its own.

## 0.11.0

### Minor Changes

- 3a82c8f: `SegmentedControl` and `ToggleChip` take a `size` prop, `"sm"` or `"md"` like `Button`. `sm` is the toolbar size they have always had and stays the default, so existing consumers render unchanged. `md` makes the control exactly 32px tall (`h-8`, border included) with `text-sm` labels, so it lines up in a row with a comfortable-density `Input`, `Select` or `Button`; `ToggleChip`'s swatch grows slightly with it. The size is not derived from the density in force.

## 0.10.0

### Minor Changes

- c2d73ad: Add `Popover`, `DropdownMenu`, `Listbox` and `Kbd`, and a number-valued `NumberInput`.
  
  - **`NumberInput` takes `onValueChange(value: number)`.** With it, `value` is a number
    (`null` shows empty).
    - While focused, the field keeps the typed text and reports only finite numbers inside
      `[min, max]`, so clearing a field to retype it never passes through 0.
    - Escape restores the value the field had on focus.
    - `precision` sets the decimals shown at rest.
    - `onClear` (optional) hears a field committed empty.
  
    Without `onValueChange` the field is unchanged, down to its markup.
  - **`VectorInput` names each field by its group and axis** ("Translation x"), so two vectors on
    one screen are told apart by screen readers and tests. The visible labels are unchanged.
    `PoseInput`'s fields follow.
  - **`Popover` / `PopoverClose`:** floating content anchored to a trigger.
  - **`DropdownMenu`** with `MenuItem`, `MenuCheckboxItem`, `MenuLabel` and `MenuSeparator`. It
    is a non-modal command and toggle menu. A checkbox item keeps the menu open, and a
    `shortcut` is shown as a `Kbd`.
  - **`Listbox`:** a single-select list whose options render their own content (thumbnails,
    metadata). One tab stop, `aria-activedescendant` keyboard navigation that skips disabled
    options. Use it on its own or inside a `Popover`.
  - **`Kbd`:** a key cap for shortcuts in hints and menus.
  - **`formatNumber` / `parseNumber`:** the text ↔ number helpers behind the number fields, now
    exported.

## 0.9.0

### Minor Changes

- a037a0f: `Toaster` and `toast()` move from `@vitavision/workbench` to `@vitavision/ui`: notifications are a generic primitive, and apps without the studio shell need them too. Moved with their stories and tests; the API is unchanged.
  
  - `@vitavision/ui` exports `Toaster`, `ToasterProps`, `toast`, `createToastStore`, `defaultToastStore` and the types `ToastTone`, `ToastOptions`, `ToastRecord`, `ToastStore`. No new dependency and no new styles: the stack uses the existing tokens, and `styles.css` already scans the component sources.
  - `@vitavision/workbench` re-exports the same names from `@vitavision/ui` (the same bindings, so there is still exactly one default store), and `import { toast } from "@vitavision/workbench"` keeps working. **Deprecated:** import them from `@vitavision/ui`; the re-exports are kept for compatibility.

### Patch Changes

- 5115556: Fix: under `prefers-reduced-motion: reduce`, style changes are applied synchronously again. `styles.css` collapsed motion to `0.01ms`, which is still a transition: an element with `transition-property: all` kept its old computed value until the next frame, so code that sets a style and measures in the same tick read stale numbers (mermaid laid a 1508×201 diagram out as 2146×2079). Transitions and animations are now `0s` (delays too). `animationend` still fires at once, so a Radix `Presence` exit animation added by a consumer still unmounts. Apps that scoped `transition-duration: 0s` to work around this can drop it.

## 0.8.0

### Minor Changes

- a019b87: Three additions for editing physical quantities:
  
  - **`NumberInput` takes a `unit`** (`mm`, `m`, `°`, `px`), written inside the field after the number — mono, muted, not part of the value, and announced as the field's description (after the caller's own `aria-describedby`, before a surrounding `Field`'s). The input then sits in a full-width wrapper carrying `data-unit`; `className`, `style` and `ref` still go to the `<input>`. Without `unit` the markup is byte-identical to 0.6.0. Its props are now exported as `NumberInputProps`.
  - **`VectorInput`** — a small vector (a position, a set of angles) edited as one row: an axis label before each field, the unit once at the end, `precision` at rest and the typed text while a field has focus (Escape restores the value on focus). `readOnly` renders a `ReadoutStrip`.
  - **`PoseInput`** — an SE(3) pose in the wire form `{ rotation: [qx, qy, qz, qw], translation: [tx, ty, tz] }`, edited as a translation (m or mm) and three angles in degrees. It does no rotation mathematics: the conversion is passed in as a `RotationView`. New types: `PoseInputProps`, `PoseValue`, `Quaternion`, `RotationView`, `Vec3`, `VectorInputProps`.

## 0.7.0

### Minor Changes

- bab71f8: Tokens meet WCAG AA in both themes, now held by unit tests; IBM Plex ships with the package.
  
  - `line-strong`, the border that identifies a control, is ≥ 3:1 against the page and panels (WCAG 1.4.11): `#c8cdd1` → `#878b8f` light, `#3a4147` → `#666e74` dark. Inputs, selects, segmented controls, switches, checkboxes and secondary buttons get a firmer outline.
  - `signal` and `normal` are told apart by a reader with tritanopia (they were 1.7 OKLab ΔE×100 apart, now ≥ 8): light `signal` `#0a6b7a` → `#235159`, `signal-strong` `#085763` → `#1c3e44`, `normal` `#046e4d` → `#086e4c`; dark `signal` `#3bc9db` → `#2db2d4`, `signal-strong` `#6fdde8` → `#5fc7e0`, `normal` `#34d399` → `#2edeac`.
  - New `@vitavision/ui/fonts.css`: IBM Plex Sans (variable) and IBM Plex Mono 400/500 (IBM's build, which keeps the `zero` feature, so mono values get the slashed zero `styles.css` asks for). Import it next to `styles.css` and drop any fontsource Plex.
  - `Select`'s trigger follows density like every other control (28 px when compact).

## 0.6.0

### Minor Changes

- 038fcec: **Breaking:** no router dependency. `react-router` is no longer a peer of `@vitavision/ui` or
  `@vitavision/lab-ui`; everything that navigates renders a plain `<a href>` or your own link
  element through `asChild` (Radix `Slot`).
  
  - `Button` gains `asChild`: `<Button asChild><Link to="/x">…</Link></Button>`.
  - `ButtonLink` takes `href` (a plain anchor) instead of react-router's `LinkProps`; for
    client-side navigation, `<ButtonLink asChild><Link to="/x">…</Link></ButtonLink>`.
  - `PageHeader`'s `back` is `{ href, label }` or a link element (`back={<Link to="/runs">Runs</Link>}`),
    replacing `{ to, label }`. New type: `BackLink`.
  - `ReadoutItem` takes `href` or `link` (an element, given without children) instead of `to`.
- 7c6c4e4: Split `@vitavision/lab-ui` into four packages: `@vitavision/ui` (tokens, theme, primitives),
  `@vitavision/forms` (`SchemaForm`), `@vitavision/charts` and `@vitavision/stage2d` (`ImageStage`,
  `MeasureOverlay`, value planes). `@vitavision/lab-ui` is now a deprecated re-export of the four
  with the identical 0.5 surface; its `styles.css` imports the four stylesheets, each of which
  declares its own Tailwind `@source`, so consumers no longer need an `@source` line.
  
  Optional props that forward a value now accept `undefined` explicitly (for consumers on
  `exactOptionalPropertyTypes`).
- 51bdec5: `@vitavision/ui` gets its quality pass: axe finds 0 serious/critical issues in every story in
  both themes, every export is documented, lint reports 0 problems, and every file meets its
  coverage threshold.
  
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
  so its label keeps 4.63:1 on hover. With AA as the floor, `fg-subtle` now sits close to
  `fg-muted` in both themes, so the two-step grey hierarchy is mostly carried by size and weight.
  
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

### Patch Changes

- b60a923: Declare `tailwindcss` (^4.3) as a peer dependency: `styles.css` is Tailwind v4 source that
  `@import`s it, so a consumer always needed it; now the manifest says so.
