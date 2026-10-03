/**
 * The furniture around a field: the grid it sits in, the cell it takes, and the hint and
 * range note beside its label. Shared by every control so that "where does the description
 * go" is decided once.
 */

import { InfoHint, byDensity, cn, useDensity } from "@vitavision/ui";
import { use, type ReactNode } from "react";

import { firstParagraph } from "../../api/firstParagraph";
import type { JsonSchema } from "../../api/schemaNode";
import type { FieldUi } from "../../api/uiSchema";
import { DenseContext, useForm } from "./context";

/** Everything a control needs to know about its field. */
export interface FieldMeta {
  /** The field's dot path from the root. */
  path: string;
  /** The label shown. */
  label: string;
  /** Whether the parent object requires the key. */
  required: boolean;
  /** The schema as written. */
  node: JsonSchema;
  /** The schema with `$ref` and "or null" looked through. */
  schema: JsonSchema;
  /** Whether `null` is accepted. */
  nullable: boolean;
  /** The app's presentation for the field. */
  ui: FieldUi;
}

/**
 * The grid cell a field takes: the full row (`sm:col-span-2`) where it has two columns to
 * span, nothing otherwise.
 *
 * @param columns - The form's column count.
 * @param ui - The field's presentation (its `span` wins).
 * @param fallback - The span for a field the app said nothing about.
 * @returns A Tailwind class, or `undefined`.
 */
export function spanClass(columns: 1 | 2, ui: FieldUi, fallback: 1 | 2): string | undefined {
  return columns === 2 && (ui.span ?? fallback) === 2 ? "sm:col-span-2" : undefined;
}

/** The field grid: two columns on `sm:` (or one), or an auto-fit row inside a tuple. */
export function Grid({ children }: { children: ReactNode }) {
  const { columns } = useForm();
  const dense = use(DenseContext);
  const density = useDensity();
  return (
    <div
      className={cn(
        "grid min-w-0",
        dense
          ? "grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2"
          : cn(
              byDensity(density, "gap-x-5 gap-y-4", "gap-x-4 gap-y-2.5"),
              columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
            ),
      )}
    >
      {children}
    </div>
  );
}

function present(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== "";
}

/**
 * What a field shows besides its label: the description as an `InfoHint` or as an inline
 * line (or not at all), and the range note, together as the `Field` annotation.
 *
 * @param meta - The field.
 * @param range - The bounds as text, for a number.
 * @returns The hint (for a control that has no annotation slot), the inline description,
 *   and the annotation.
 */
export function useChrome(
  meta: FieldMeta,
  range: string | null = null,
): { hint: ReactNode; description: ReactNode; annotation: ReactNode } {
  const dense = use(DenseContext);
  const mode = meta.ui.descriptionAs ?? "hint";
  const text: ReactNode = meta.ui.hint ?? firstParagraph(meta.schema.description);
  const shown = !dense && present(text);

  const hint = shown && mode === "hint" ? <InfoHint label={`About ${meta.label}`}>{text}</InfoHint> : null;
  const description = shown && mode === "inline" ? text : undefined;
  const note = dense ? null : range;
  const annotation =
    note !== null || hint !== null ? (
      <span className="inline-flex items-center gap-1.5">
        {note}
        {hint}
      </span>
    ) : undefined;
  return { hint, description, annotation };
}
