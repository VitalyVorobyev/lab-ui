---
"@vitavision/ui": minor
---

`SegmentedControl` and `ToggleChip` take a `size` prop, `"sm"` or `"md"` like `Button`. `sm` is the toolbar size they have always had and stays the default, so existing consumers render unchanged. `md` makes the control exactly 32px tall (`h-8`, border included) with `text-sm` labels, so it lines up in a row with a comfortable-density `Input`, `Select` or `Button`; `ToggleChip`'s swatch grows slightly with it. The size is not derived from the density in force.
