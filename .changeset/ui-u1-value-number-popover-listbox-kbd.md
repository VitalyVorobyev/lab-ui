---
"@vitavision/ui": minor
---

Add `Popover`, `DropdownMenu`, `Listbox` and `Kbd`, and a number-valued `NumberInput`.

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
