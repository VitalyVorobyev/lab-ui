# @vitavision/ui

## 0.14.0

### Minor Changes

- e8b571d: New `Breakdown`: how many things of a set are in each state, as one thin stacked bar, such as a file list showing how far each file's translation has got.
  
  ```tsx
  <Breakdown
    segments={[
      { value: 412, tone: "normal", label: "done" },
      { value: 20, tone: "warn", label: "to check" },
      { value: 3, tone: "defect", label: "problems" },
    ]}
    total={566}
    remainderLabel="to do"
  />
  ```
  
  - **Segments** are drawn left to right in the order given, each as wide as its share of `total`. `total` defaults to the sum of the segments; the rest of it is drawn as empty track. Segments of 0 are left out, and a non-zero count is never narrower than 2 px, so a single problem still shows.
  - **Tones** are `normal`, `warn` and `defect`, the verdict colours, plus `neutral` for a category that is no verdict ("skipped"). Use it only for things the app has judged, never for a continuous quantity or for series side by side: that is a `Progress` or a chart.
  - **Accessible:** a `role="img"` named with every non-zero count, "412 done, 20 to check, 3 problems, 131 to do of 566", so colour is never the only cue. `aria-label` or `aria-labelledby` replaces the name. Neighbouring segments are also set apart by a 1 px gap.
  - `breakdownText(segments, { total, remainderLabel })` gives the same text, for a tooltip or a label printed beside the bar.
  - The track matches `Progress`, thinner in the compact density. `data-state` is `empty`, `partial` or `complete`, and each segment carries its `data-tone`. Width changes ease, and hold still with reduced motion.
  
  `Table` can make the selection follow the keyboard: with `selectionFollowsFocus`, every arrow key, Page Up / Page Down, Home or End that moves to another row also calls `onRowClick` for that row.
  
  ```tsx
  <Table
    columns={columns}
    rows={strings}
    rowKey={(s) => s.id}
    isRowActive={(s) => s.id === selectedId}
    onRowClick={(s) => setSelectedId(s.id)}
    selectionFollowsFocus
  />
  ```
  
  - Use it where the selected row shows its detail beside the table, so moving through the rows updates the detail as you go. Leave it off when activating a row is costly or leaves the page.
  - The event passed to `onRowClick` is the key press, so modifiers can be read as for a click. The index is still the row's index in `rows`, whatever the sort, and windowed tables select rows outside the window as the keyboard reaches them.
  - Clicks, Enter and Space behave as before. Off by default.
  
  Fixes in a windowed `Table`:
  
  - The arrow keys, Page Up / Page Down and Home / End now move focus to a row that is already in view. Before, focus only moved when the table had to scroll to the row.
  - A table whose rows are cleared and then come back (a filter that matches nothing, then matches again) fills its scroll area again. Before, it measured the scroll area that had gone away and rendered only a few rows until it was resized.

## 0.13.0

### Minor Changes

- d36cb3c: New `HighlightedText`: a string with its placeholders, markup tags, protected terms and mismatches marked, such as a UI string next to its translation.
  
  ```tsx
  const spans = findSpans(source, [
    { pattern: /%\d+/, kind: "placeholder" },
    { pattern: /<\/?[a-z][^>]*>/i, kind: "tag" },
    { pattern: /\bParamsManager\b/, kind: "protected-term" },
  ]);
  <HighlightedText text={source} spans={spans} />
  ```
  
  - **Spans** are `{ start, end, kind, label? }` in UTF-16 offsets, in any order. Overlaps are allowed. The kinds are `placeholder`, `tag`, `protected-term` and `mismatch`.
  - **`findSpans(text, rules)`** builds spans from regular expressions. It finds every match, skips empty ones and sorts the result.
  - **Text only:** the string is never parsed as HTML. `<b>` shows as the characters `<b>`. Whitespace and line breaks are kept.
  - **Accessible:** each kind has its own shape: an outlined mono box, a mono face on a quiet box, a dotted underline, or a wavy underline with a tint. None is told apart by colour alone. Each span is a `<mark>`, followed by its kind for screen readers ("%1, placeholder"). That label is left out when the text is copied. `labels` renames or silences a kind, and a span's `label` says why it is marked.
- d36cb3c: New `Progress`: how far a long operation has got, as a count out of a total.
  
  ```tsx
  <Progress aria-label="Translating" value={412} max={2556} />
  <Progress aria-label="Loading the catalog" /> {/* no value: indeterminate */}
  ```
  
  - **Determinate** with a `value` out of `max` (100 by default), clamped. Screen readers hear "412 of 2,556"; `valueText` replaces it ("412 of 2,556 strings").
  - **Indeterminate** without a `value`: a sweeping bar, with no `aria-valuenow`, `aria-valuemax` or `aria-valuetext`. It holds still with reduced motion.
  - The bar is in the accent colour, never a verdict colour. The track is thinner in the compact density. `data-state` is `loading`, `complete` or `indeterminate`.
  - `progressText(value, max)` gives the same "412 of 2,556" text, for a label printed beside the bar.
  - `ProgressBar` is deprecated in favour of `Progress`. It still works as before.
- d36cb3c: `Table` can render only the rows in view (`windowed`), so a table of thousands of rows scrolls smoothly, and rows can be navigated with the keyboard.
  
  ```tsx
  <Table columns={columns} rows={strings} rowKey={(s) => s.id} windowed={{ rowHeight: 36, height: 480 }} />
  ```
  
  - **`windowed={{ rowHeight, height?, overscan? }}`:** the table scrolls itself under a sticky header and keeps only the visible rows (plus `overscan`, 8 by default) in the DOM. Without `height` it fills its container, which needs a height of its own. Every row is drawn `rowHeight` tall (at least 36 px comfortable, 22 px compact). Cells keep to one line and longer content ends in an ellipsis. Columns use a fixed layout, so give a column a `width` where its content needs one.
  - Sorting, `onRowClick`, `isRowActive` and `onRowHover` work over all the rows. The table carries `aria-rowcount` and each rendered row its `aria-rowindex`, so a screen reader still hears a row's place among all of them. A windowed table with nothing focusable in it is a tab stop itself, so it can be scrolled from the keyboard.
  - **Keyboard:** from a focused activatable row, the arrow keys, Page Up / Page Down and Home / End move to another row, and a windowed table scrolls to it. Before, these keys scrolled the page. Enter and Space still activate the row.
  - The props type of the option is exported as `TableWindowing`.
- d36cb3c: `Textarea` grows with its content, shows an invalid state, and is set in the sans face unless you ask for mono.
  
  ```tsx
  <Field label="German" error={error}>
    <Textarea minRows={2} maxRows={8} value={text} onValueChange={setText} />
  </Field>
  ```
  
  - **Growing:** with `minRows` and/or `maxRows` it starts `minRows` tall (also in a server render), follows its content and scrolls past `maxRows`. It also refits when a controlled `value` changes or its width changes. Without them it is `rows` tall and resizable, as before.
  - **Invalid:** `invalid` sets `aria-invalid`, `data-invalid` and a border in the defect colour. Inside a `Field` with an `error` it is on without the prop.
  - **`onValueChange`** is called with the text on every edit, alongside the native `onChange`.
  - **Breaking:** the text is now IBM Plex Sans by default; it used to always be mono. Pass `mono` to keep the old look, for JSON, code or lists. The props type is exported as `TextareaProps`.

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
