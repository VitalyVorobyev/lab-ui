# @vitavision/forms

A JSON Schema (draft 2020-12 — what schemars and pydantic emit) rendered as an options form, on `@vitavision/ui` primitives.

```bash
bun add @vitavision/forms @vitavision/ui
```

```css
@import "@vitavision/ui/styles.css";
@import "@vitavision/forms/styles.css";
```

`SchemaForm`, which renders a JSON Schema as a form and is
paired with the pure logic in `api/schemaForm.ts` (`describeFields`, `initialValues`,
`toOptions`, `missingRequired`, `outOfRange`, `jsonErrors`, `overrideCount`). A field
is folded under "Advanced" when its default already works; a schema that knows better marks
its decisions with `"x-primary": true` (pydantic: `json_schema_extra={"x-primary": True}`),
and `false` folds a field whatever its default.

`SchemaValueForm`, which edits a **whole JSON value** (a config, nested to any depth)
through its schema and hands back the whole next value — `value` / `defaultValue` /
`onValueChange`. It reads `$ref` into `$defs`, `anyOf: [T, null]` and `type: ["T", "null"]`,
serde enums (plain, externally tagged including newtype variants, internally tagged on `kind`),
tuples, string lists, and falls back to a JSON textarea for the rest. What the schema cannot
say goes in a `UiSchema` (`groups`, per-path `fields`, a `renderField` escape hatch). Pure
helpers for building your own: `defaultValueForSchema`, `resolveSchema`, `shapeOf`, `fieldAt` /
`fieldsAt`, `getAtPath` / `setAtPath`, `firstParagraph`.

```tsx
<SchemaValueForm schema={schema} value={config} onValueChange={setConfig} ui={ui} columns={1} />
```

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
