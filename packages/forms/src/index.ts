/**
 * A JSON Schema (draft 2020-12, as schemars and pydantic emit it) rendered as an options form.
 *
 * `describeFields` turns the schema into field specs, `SchemaForm` renders them, and
 * `toOptions` / `missingRequired` / `outOfRange` / `jsonErrors` turn the form's raw values
 * back into the options to send and the reasons not to send them yet.
 *
 * `SchemaValueForm` is the other form: it edits a *whole* value (a config, nested to any
 * depth, with serde enums and nullable blocks) and hands back the whole next value. It reads
 * the schema through the same resolver, exposed here as `resolveSchema` and `shapeOf`, with
 * `defaultValueForSchema`, `fieldAt` / `fieldsAt`, `getAtPath` / `setAtPath` and
 * `firstParagraph` as pure helpers; a `UiSchema` carries the layout the schema cannot.
 *
 * @packageDocumentation
 */

export { SchemaForm } from "./components/SchemaForm";
export { SchemaValueForm, type SchemaValueFormProps } from "./components/SchemaValueForm";

export {
  describeFields,
  initialValues,
  jsonErrors,
  missingRequired,
  outOfRange,
  overrideCount,
  toOptions,
  type ChoiceOption,
  type FieldKind,
  type FieldSpec,
  type OptionsSchema,
  type RawValues,
  type SchemaNode,
} from "./api/schemaForm";

export { firstParagraph } from "./api/firstParagraph";
export { resolveRef, resolveSchema, type JsonSchema, type ResolvedSchema } from "./api/schemaNode";
export {
  defaultValueForSchema,
  fieldAt,
  fieldsAt,
  shapeOf,
  type EnumOption,
  type EnumValue,
  type ExternalVariant,
  type FieldInfo,
  type SchemaShape,
  type TaggedVariant,
} from "./api/schemaValue";
export type { FieldUi, FieldWidget, RenderField, RenderFieldContext, UiGroup, UiSchema } from "./api/uiSchema";
export { getAtPath, setAtPath } from "./api/valuePath";
