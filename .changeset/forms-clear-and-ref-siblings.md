---
"@vitavision/forms": minor
---

`SchemaValueForm` no longer writes `null` when an optional field is cleared: clearing an optional number or text removes the key (or restores a non-null schema default, for numbers), so serde `#[serde(default)]` structs see "use the default" instead of `None`. A required nullable field still clears to `null`. The new `FieldUi.clearTo: "null"` makes clearing write `null` for an optional `Option<T>` whose default is `Some(…)`. An absent key now shows its schema default as the placeholder (and as the selected option of an enum).

`$ref` with sibling `properties` / `required` (ringgrid's `target_spec` variants) now merges the target's fields with the sibling's instead of dropping them, so every tagged variant exposes its struct fields.
