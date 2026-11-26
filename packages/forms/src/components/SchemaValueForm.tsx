/**
 * A form that edits a whole JSON value, generated from the value's JSON Schema.
 *
 * `SchemaForm` is for *options*: every field starts unset and only what the operator
 * touches is sent. This is for *configs*: the value is complete — a calibration's settings,
 * a detector's parameters — and the form edits it in place, down to a nested struct, a
 * serde enum's data, a nullable block or a tuple of points, handing back the whole next
 * value on each edit. What the schema cannot say (grouping, labels, units, a different
 * control) the app says in a `UiSchema`.
 */

import { Disclosure, Section, TooltipProvider, cn } from "@vitavision/ui";
import { useMemo, useState, type Ref } from "react";

import type { JsonSchema } from "../api/schemaNode";
import { defaultValueForSchema, fieldAt, shapeOf } from "../api/schemaValue";
import { fieldUiAt, type RenderField, type UiGroup, type UiSchema } from "../api/uiSchema";
import { changeCounts, diffPaths } from "../api/valueDiff";
import { setAtPath } from "../api/valuePath";
import { Grid } from "./valueForm/chrome";
import { FormContext, useForm, type FieldMessage, type FormState } from "./valueForm/context";
import { FieldNode, ObjectBody } from "./valueForm/nodes";

const NO_UI: UiSchema = {};

/** Messages from the app, by dot path (`""` is the form as a whole). A bare string is an error. */
export type FieldMessages = Readonly<Record<string, FieldMessage | string>>;

export type { FieldMessage };

/** Props of `SchemaValueForm`. */
export interface SchemaValueFormProps {
  /**
   * The value's JSON Schema (draft 2020-12, as schemars emits it), `$defs` included. Not
   * watched for change in the uncontrolled mode: give the form a `key` per schema.
   */
  schema: JsonSchema;
  /** The value, for a controlled form. Complete: the form edits it, it does not complete it. */
  value?: unknown;
  /**
   * The starting value, for an uncontrolled form. Without either, the form starts from
   * `defaultValueForSchema(schema)`.
   */
  defaultValue?: unknown;
  /**
   * Called with the whole next value on each edit. The previous value is never mutated;
   * untouched subtrees are shared with it, and keys the schema does not know are kept.
   */
  onValueChange?: ((next: unknown) => void) | undefined;
  /** Layout the schema cannot carry: groups, labels, units, widgets. */
  ui?: UiSchema | undefined;
  /**
   * The value to compare with, such as the defaults or a previous run. A field whose value
   * differs from it is marked "changed" (a rule in the gutter and a note under the control
   * saying what it was), with a Reset that writes the baseline's value back through
   * `onValueChange`; a struct, a variant or a tuple shows how many leaves under it changed
   * and one Reset for them all. A key missing on one side differs from a key present on the
   * other; arrays of equal length compare by index, others as a whole. Without it, nothing is marked.
   */
  baseline?: unknown;
  /**
   * Messages to show on fields, by dot path (`solver.max_iters`, `cameras.0.id`, the paths
   * `getAtPath` reads), for validation that comes from elsewhere, such as a backend. An `error`
   * (or a bare string) is announced as an alert and marks the control invalid; a `warning`
   * is shown under it without blocking. A path of `""` shows above the form. A path that no
   * visible field has shows nowhere: list those yourself.
   */
  messages?: FieldMessages | undefined;
  /** `2` (the default) puts fields side by side from `sm:` up; `1` is one column, for a narrow rail. */
  columns?: 1 | 2 | undefined;
  /** Blocks every control. The value is still shown. */
  disabled?: boolean | undefined;
  /**
   * Take over a field. Called for every field before the form's own control; return
   * `undefined` to let the form render it. The result is placed in the field's grid cell
   * as it is, so wrap it in a `Field` if it should look like its neighbours.
   */
  renderField?: RenderField | undefined;
  /** Merged with the form's own classes through `cn`. */
  className?: string | undefined;
  /** The root element. */
  ref?: Ref<HTMLDivElement> | undefined;
}

/** Controlled when `value` is given, otherwise the form keeps the value itself. */
function useValue(
  value: unknown,
  seed: () => unknown,
  onValueChange: ((next: unknown) => void) | undefined,
): [unknown, (next: unknown) => void] {
  const [inner, setInner] = useState(seed);
  const controlled = value !== undefined;
  return [
    controlled ? value : inner,
    (next) => {
      if (!controlled) setInner(next);
      onValueChange?.(next);
    },
  ];
}

/**
 * Edit a JSON value through its schema.
 *
 * Renders by the schema's shape: a number is a `NumberInput` (with its bounds, unit and an
 * integer-only rule), a string an `Input`, a boolean a `Switch`, a closed set a
 * `SegmentedControl` or a `Select`, a struct a nested fieldset, a serde enum a variant
 * selector with the variant's fields (switching seeds them from the schema's defaults), a
 * `null`-able block a switch that sets and unsets it, a list of strings an editable list, a
 * fixed-length array a row of cells, and anything else a JSON textarea that keeps the last
 * valid value while showing the parse error.
 *
 * The first paragraph of a field's description is its `InfoHint`. Round-trips: a value in,
 * no edits, the same value out — the form never normalises on mount, and an edit changes
 * only the leaf touched.
 *
 * The root is a `div` carrying `data-columns` and, while disabled, `data-disabled`. Wraps itself in a
 * `TooltipProvider`, so it needs none above it.
 */
export function SchemaValueForm({
  schema,
  value,
  defaultValue,
  onValueChange,
  baseline,
  messages,
  ui = NO_UI,
  columns = 2,
  disabled = false,
  renderField,
  className,
  ref,
}: SchemaValueFormProps) {
  const [current, commit] = useValue(
    value,
    () => (defaultValue !== undefined ? defaultValue : defaultValueForSchema(schema)),
    onValueChange,
  );
  const compared = useMemo(
    () => (baseline === undefined ? null : { value: baseline, counts: changeCounts(diffPaths(current, baseline)) }),
    [current, baseline],
  );
  const claimed = useMemo(() => new Set((ui.groups ?? []).flatMap((group) => group.fields)), [ui.groups]);

  const state: FormState = {
    schema,
    value: current,
    setValue: (path, next) => {
      const updated = setAtPath(current, path, next);
      // Setting what is already there hands back the same value: nothing to report.
      if (!Object.is(updated, current)) commit(updated);
    },
    ui,
    disabled,
    columns,
    renderField,
    claimed,
    baseline: compared,
    messages,
  };

  const root = shapeOf(schema, schema);
  const raw = messages?.[""];
  const formMessage: FieldMessage | undefined = typeof raw === "string" ? { severity: "error", text: raw } : raw;

  return (
    <TooltipProvider>
      <FormContext value={state}>
        <div
          ref={ref}
          data-columns={columns}
          data-disabled={disabled ? "" : undefined}
          className={cn("flex min-w-0 flex-col gap-5", className)}
        >
          {formMessage !== undefined && (
            <p
              role={formMessage.severity === "error" ? "alert" : undefined}
              data-message={formMessage.severity}
              className={cn("text-xs leading-snug", formMessage.severity === "error" ? "text-defect" : "text-warn")}
            >
              {formMessage.text}
            </p>
          )}
          {root.kind === "object" && (ui.groups ?? []).map((group) => <GroupBlock key={group.id} group={group} />)}
          {root.kind === "object" ? (
            <ObjectBody path="" fields={root.fields} />
          ) : (
            <FieldNode path="" name={schema.title ?? "value"} node={schema} required bare />
          )}
        </div>
      </FormContext>
    </TooltipProvider>
  );
}

/** A `UiGroup`: its fields under a heading, folded away if the app said so. */
function GroupBlock({ group }: { group: UiGroup }) {
  const { schema, value, ui } = useForm();
  const fields = group.fields.flatMap((path) => {
    const info = fieldAt(schema, path, schema, value);
    if (info === undefined || fieldUiAt(ui, path).hidden === true) return [];
    return [{ path, info }];
  });
  if (fields.length === 0) return null;

  const body = (
    <Grid>
      {fields.map(({ path, info }) => (
        <FieldNode key={path} path={path} name={path.split(".").at(-1) ?? path} node={info.schema} required={info.required} />
      ))}
    </Grid>
  );

  if (group.collapsible === true) {
    return (
      <Disclosure summary={group.title} count={fields.length} defaultOpen={group.defaultOpen ?? false}>
        {group.hint !== undefined && <p className="mb-3 text-xs text-fg-muted">{group.hint}</p>}
        {body}
      </Disclosure>
    );
  }
  return (
    <Section title={group.title} hint={group.hint}>
      {body}
    </Section>
  );
}
