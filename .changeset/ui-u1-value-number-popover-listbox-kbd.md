---
"@vitavision/ui": minor
---

Add `Popover`, `DropdownMenu`, `Listbox` and `Kbd`, and a number-valued `NumberInput`.

- **`NumberInput` takes `onValueChange`.** With it, `value` is a number (`null` is empty).
  - While focused, the field keeps the typed text and reports only parsed numbers, so
    clearing a field to retype it never passes through 0.
  - Leaving the field empty, or pressing Enter on it, reports `null`.
  - Escape restores the value the field had on focus.
  - `precision` sets the decimals shown at rest.

  Without `onValueChange` the field is unchanged, down to its markup.
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
