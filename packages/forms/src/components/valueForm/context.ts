/**
 * What every node of a `SchemaValueForm` shares: the schema, the value, how to edit it, and
 * the app's layout. One context rather than props threaded through every container, because
 * a field is addressed by its path — it reads its own value and writes its own leaf, and
 * the containers in between need not know.
 */

import { createContext, use } from "react";

import type { JsonSchema } from "../../api/schemaNode";
import type { RenderField, UiSchema } from "../../api/uiSchema";

/** The form's state, for the nodes below it. */
export interface FormState {
  /** The root schema, which also holds `$defs`. */
  schema: JsonSchema;
  /** The current root value. */
  value: unknown;
  /** Replace the value at a dot path; `undefined` removes the key. */
  setValue: (path: string, next: unknown) => void;
  /** The app's layout. */
  ui: UiSchema;
  /** Whether every control is disabled. */
  disabled: boolean;
  /** One column, or two on `sm:` and up. */
  columns: 1 | 2;
  /** The app's escape hatch. */
  renderField: RenderField | undefined;
  /** Paths a group has claimed, so the ungrouped remainder skips them. */
  claimed: ReadonlySet<string>;
}

/** `null` outside a form. */
export const FormContext = createContext<FormState | null>(null);

/**
 * True inside a tuple row: cells drop their descriptions and range notes and sit in an
 * auto-fit grid, because a row of four numbers cannot afford a hint line each.
 */
export const DenseContext = createContext(false);

/** The enclosing form's state. */
export function useForm(): FormState {
  const state = use(FormContext);
  if (state === null) throw new Error("A SchemaValueForm field was rendered outside its form.");
  return state;
}
