/**
 * What an app says about a form that the schema cannot: which fields go together, what to
 * call them, and when a different control is wanted.
 *
 * A schema describes the *data*. It rarely knows that `roi_xywh` is four pixels, that three
 * fields belong under "Detection", or that `refinement` reads better as a strip of
 * segments than a drop-down. That is layout, and it belongs to the app, not to the Rust
 * struct, so it travels beside the schema as a `UiSchema` instead of inside it.
 */

import type { ReactNode } from "react";

import type { JsonSchema } from "./schemaNode";

/** A titled set of fields, rendered together. */
export interface UiGroup {
  /** Stable id, used for keys and test hooks. */
  id: string;
  /** The heading. */
  title: string;
  /**
   * The fields in the group, as dot paths from the form's root: `threshold`, `solver`,
   * `solver.max_iters`. A path to an object brings its whole subtree; a path to a leaf
   * brings only that leaf, and the object's other fields stay in the ungrouped remainder.
   */
  fields: string[];
  /** Fold the group away behind a `Disclosure`. Otherwise it is a `Section`. */
  collapsible?: boolean | undefined;
  /** Whether a collapsible group starts open. Defaults to closed. */
  defaultOpen?: boolean | undefined;
  /** A line of explanation under the heading. */
  hint?: ReactNode;
}

/** The widgets a field can be forced into with `FieldUi.widget`. */
export type FieldWidget =
  | "number"
  | "text"
  | "select"
  | "segmented"
  | "checkbox"
  | "switch"
  | "json"
  | "tuple-row"
  | "string-list";

/** Per-field presentation, looked up by the field's dot path. */
export interface FieldUi {
  /** The label, instead of the schema's `title` or the humanised key. */
  label?: string | undefined;
  /** Explanation shown in place of the schema's description. */
  hint?: ReactNode;
  /** Do not render the field. Its value is kept as it is. */
  hidden?: boolean | undefined;
  /**
   * The control, instead of the one the schema's shape calls for. A widget that does not
   * fit the field (`segmented` on a number) is ignored.
   */
  widget?: FieldWidget | undefined;
  /** The unit written in the field, instead of the schema's `x-unit`. */
  unit?: string | undefined;
  /** Lower bound the control enforces, instead of the schema's `minimum`. */
  min?: number | undefined;
  /** Upper bound the control enforces, instead of the schema's `maximum`. */
  max?: number | undefined;
  /** Arrow-key step, instead of the schema's `multipleOf` (or 1 for an integer). */
  step?: number | undefined;
  /**
   * Labels for an enum's values and a union's variants, by value or tag:
   * `{ brown_conrady5: "Brown-Conrady" }`.
   */
  enumLabels?: Record<string, string> | undefined;
  /** Columns the field takes in the grid. Containers and lists default to the full row. */
  span?: 1 | 2 | undefined;
  /**
   * Where the description goes: `hint` (the default) is an `InfoHint` beside the label,
   * `inline` is a line under the control, `none` drops it.
   */
  descriptionAs?: "hint" | "inline" | "none" | undefined;
  /**
   * Clearing a number input puts the default back (the default, `true`): the schema's
   * non-null `default`, else the nearest legal value for a required field, else — for an
   * optional field with no usable default — nothing, which removes the key (the schema
   * default then applies). With `false` the field is left empty where it can be (an
   * optional field loses its key) and keeps its value where it cannot (a required,
   * non-nullable one). A required nullable field is set to `null`. An optional field is
   * never set to `null` unless `clearTo` says so.
   */
  restoreDefaultOnClear?: boolean | undefined;
  /**
   * For a nullable field, what clearing writes. `"null"` writes `null` even when the key is
   * optional — the way to let a user choose `None` for an `Option<T>` whose default is
   * `Some(…)`, since for a serde `#[serde(default)]` field an absent key means the default
   * and `null` means `None`. Left out, clearing an optional field removes the key and
   * clearing a required nullable one writes `null` (see `restoreDefaultOnClear`). It has no
   * effect on a field that is not nullable.
   */
  clearTo?: "null" | undefined;
}

/**
 * App-supplied layout for a `SchemaValueForm`.
 *
 * Paths are dot paths from the root of the *value*: `solver.max_iters`, `sensor.kind`.
 * An array element is its index (`cameras.0.id`), and `*` stands for any index
 * (`cameras.*.id`). For a serde externally-tagged enum the tag is a path segment
 * (`solver.robust_loss.Huber.scale`).
 */
export interface UiSchema {
  /**
   * Groups, in order. Fields in a group render under its heading; every visible field not
   * claimed by a group renders after the groups, in schema order.
   */
  groups?: UiGroup[] | undefined;
  /** Per-field presentation, by dot path. */
  fields?: Record<string, FieldUi> | undefined;
}

/** What `renderField` is given for a field. */
export interface RenderFieldContext {
  /** The field's dot path from the root. */
  path: string;
  /** The field's schema with `$ref` and "or null" looked through. */
  schema: JsonSchema;
  /** The field's current value; `undefined` where the key is absent. */
  value: unknown;
  /** Replace the field's value (`undefined` removes the key). */
  onChange: (next: unknown) => void;
  /** Whether the whole form is disabled. */
  disabled: boolean;
}

/**
 * Take over a field. Return `undefined` to let the form's own control render, anything else
 * to render in its place (and in its grid cell, with the field's span).
 */
export type RenderField = (context: RenderFieldContext) => ReactNode;

const NO_UI: FieldUi = {};

/**
 * The presentation for a path: the exact entry, merged over the wildcard entry
 * (`cameras.*.id`) when the path has array indices.
 *
 * @param ui - The app's `UiSchema`, if any.
 * @param path - The field's dot path.
 * @returns The presentation; `{}` where the app said nothing.
 */
export function fieldUiAt(ui: UiSchema | undefined, path: string): FieldUi {
  const table = ui?.fields;
  if (table === undefined) return NO_UI;
  const wildcard = path.replaceAll(/(^|\.)\d+(?=\.|$)/g, "$1*");
  const general = wildcard === path ? undefined : table[wildcard];
  const exact = table[path];
  if (general === undefined) return exact ?? NO_UI;
  return exact === undefined ? general : { ...general, ...exact };
}
