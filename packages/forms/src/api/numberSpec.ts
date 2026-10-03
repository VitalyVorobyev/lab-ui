/**
 * What a number field accepts: the schema's bounds, a `uint` format's implied floor, and
 * the app's own overrides, in one place so the control and its error message cannot
 * disagree.
 */

import type { JsonSchema } from "./schemaNode";
import type { FieldUi } from "./uiSchema";

/** The rules for one number field. */
export interface NumberSpec {
  /** Whole numbers only (`type: "integer"`): `2.5` is rejected, never rounded. */
  integer: boolean;
  /** Inclusive lower bound. */
  min?: number | undefined;
  /** Inclusive upper bound. */
  max?: number | undefined;
  /** Exclusive lower bound. */
  exclusiveMin?: number | undefined;
  /** Exclusive upper bound. */
  exclusiveMax?: number | undefined;
  /** Arrow-key step: the schema's `multipleOf`, 1 for an integer, otherwise `"any"`. */
  step: number | "any";
  /** The unit shown in the field. */
  unit?: string | undefined;
}

/**
 * Collect a number field's rules.
 *
 * `format: uint…` (Rust's unsigned widths) means "at least 0" even where the schema says
 * nothing else. A bound in `ui` replaces the schema's bound of that side, exclusive form
 * included.
 *
 * @param schema - The field's resolved schema.
 * @param ui - The app's presentation for the field.
 * @returns The rules.
 */
export function numberSpec(schema: JsonSchema, ui: FieldUi = {}): NumberSpec {
  const integer = schema.type === "integer";
  const floor = schema.format?.startsWith("uint") === true ? 0 : undefined;
  return {
    integer,
    min: ui.min ?? schema.minimum ?? floor,
    max: ui.max ?? schema.maximum,
    exclusiveMin: ui.min === undefined ? schema.exclusiveMinimum : undefined,
    exclusiveMax: ui.max === undefined ? schema.exclusiveMaximum : undefined,
    step: ui.step ?? schema.multipleOf ?? (integer ? 1 : "any"),
    unit: ui.unit ?? schema["x-unit"],
  };
}

/**
 * Why a number is not acceptable.
 *
 * @param spec - The field's rules.
 * @param value - The parsed number.
 * @returns A short sentence for the field's error line, or `undefined` when it is fine.
 */
export function checkNumber(spec: NumberSpec, value: number): string | undefined {
  if (!Number.isFinite(value)) return "Enter a number";
  if (spec.integer && !Number.isInteger(value)) return "Must be a whole number";
  if (spec.min !== undefined && value < spec.min) return `Must be ≥ ${spec.min}`;
  if (spec.exclusiveMin !== undefined && value <= spec.exclusiveMin) return `Must be > ${spec.exclusiveMin}`;
  if (spec.max !== undefined && value > spec.max) return `Must be ≤ ${spec.max}`;
  if (spec.exclusiveMax !== undefined && value >= spec.exclusiveMax) return `Must be < ${spec.exclusiveMax}`;
  return undefined;
}

/**
 * The bounds as a reader should see them, exclusive ones included.
 *
 * @param spec - The field's rules.
 * @returns `"≥ 2, ≤ 64"`, or `null` for an unbounded field.
 */
export function rangeText(spec: NumberSpec): string | null {
  const parts: string[] = [];
  if (spec.min !== undefined) parts.push(`≥ ${spec.min}`);
  else if (spec.exclusiveMin !== undefined) parts.push(`> ${spec.exclusiveMin}`);
  if (spec.max !== undefined) parts.push(`≤ ${spec.max}`);
  else if (spec.exclusiveMax !== undefined) parts.push(`< ${spec.exclusiveMax}`);
  return parts.length > 0 ? parts.join(", ") : null;
}
