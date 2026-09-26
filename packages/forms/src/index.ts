/**
 * A JSON Schema (draft 2020-12, as schemars and pydantic emit it) rendered as an options form.
 *
 * `describeFields` turns the schema into field specs, `SchemaForm` renders them, and
 * `toOptions` / `missingRequired` / `outOfRange` / `jsonErrors` turn the form's raw values
 * back into the options to send and the reasons not to send them yet.
 *
 * @packageDocumentation
 */

export { SchemaForm } from "./components/SchemaForm";

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
