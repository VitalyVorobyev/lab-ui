# @vitavision/forms

## 0.8.1

### Patch Changes

- 1914f7f: READMEs, Storybook descriptions and editor documentation no longer refer to the project's internal tickets, decision records or private apps; the text now stands on its own.
- Updated dependencies [c91bc50]
- Updated dependencies [d224648]
- Updated dependencies [1914f7f]
  - @vitavision/ui@0.12.0

## 0.8.0

### Minor Changes

- 7fe0c79: `SchemaValueForm` no longer writes `null` when an optional field is cleared: clearing an optional number or text removes the key (or restores a non-null schema default, for numbers), so serde `#[serde(default)]` structs see "use the default" instead of `None`. A required nullable field still clears to `null`. The new `FieldUi.clearTo: "null"` makes clearing write `null` for an optional `Option<T>` whose default is `Some(…)`. An absent key now shows its schema default as the placeholder (and as the selected option of an enum).
  
  `$ref` with sibling `properties` / `required` (ringgrid's `target_spec` variants) now merges the target's fields with the sibling's instead of dropping them, so every tagged variant exposes its struct fields.

## 0.7.0

### Minor Changes

- 4dc04a5: Add `SchemaValueForm`: edits a whole JSON value through its JSON Schema (schemars 1.x, draft 2020-12) and hands back the whole next value (`value` / `defaultValue` / `onValueChange`). Nested objects at any depth, `$ref` into `$defs`, `type: ["T", "null"]` and `anyOf: [T, null]` (a switch for a nullable block, an empty control for a nullable number or string), serde enums (plain, externally tagged including newtype variants, internally tagged on `kind`), tuples, string lists and a JSON fallback; integers stay integers. A `UiSchema` (`groups`, per-path `fields`, `columns`) carries the layout the schema cannot, and `renderField` takes over any field. New pure helpers: `defaultValueForSchema`, `resolveSchema`, `resolveRef`, `shapeOf`, `fieldAt`, `fieldsAt`, `getAtPath`, `setAtPath`, `firstParagraph`. `SchemaForm` and its helpers are unchanged; they now read `$ref` and the "or null" encodings through the same resolver, so `type: ["T", "null"]` and a `$ref` anywhere a schema is read now resolve there too.

## 0.6.5

### Patch Changes

- Updated dependencies [3a82c8f]
  - @vitavision/ui@0.11.0

## 0.6.4

### Patch Changes

- Updated dependencies [c2d73ad]
  - @vitavision/ui@0.10.0

## 0.6.3

### Patch Changes

- Updated dependencies [5115556]
- Updated dependencies [a037a0f]
  - @vitavision/ui@0.9.0

## 0.6.2

### Patch Changes

- Updated dependencies [a019b87]
  - @vitavision/ui@0.8.0

## 0.6.1

### Patch Changes

- Updated dependencies [bab71f8]
  - @vitavision/ui@0.7.0

## 0.6.0

### Minor Changes

- 7c6c4e4: Split `@vitavision/lab-ui` into four packages: `@vitavision/ui` (tokens, theme, primitives),
  `@vitavision/forms` (`SchemaForm`), `@vitavision/charts` and `@vitavision/stage2d` (`ImageStage`,
  `MeasureOverlay`, value planes). `@vitavision/lab-ui` is now a deprecated re-export of the four
  with the identical 0.5 surface; its `styles.css` imports the four stylesheets, each of which
  declares its own Tailwind `@source`, so consumers no longer need an `@source` line.
  
  Optional props that forward a value now accept `undefined` explicitly (for consumers on
  `exactOptionalPropertyTypes`).

### Patch Changes

- d891e42: Every export is documented (TSDoc; the API report has no undocumented symbols). A
  structured default — a nested model's — now shows as JSON in its field's placeholder
  instead of `[object Object]` (new `displayValue` helper in `api/schemaForm`). Size budget
  set (2.3 kB).
- Updated dependencies [038fcec]
- Updated dependencies [7c6c4e4]
- Updated dependencies [51bdec5]
- Updated dependencies [b60a923]
  - @vitavision/ui@0.6.0
