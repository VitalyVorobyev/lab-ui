/**
 * The controls of a `SchemaValueForm`: one per kind of leaf value. Each reads its own value
 * from the form by path and writes its own leaf back; none knows its neighbours.
 */

import {
  Button,
  Checkbox,
  Field,
  Input,
  NumberInput,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  byDensity,
  cn,
  parseNumber,
  useDensity,
} from "@vitavision/ui";
import { use, useState, type ChangeEvent, type ReactNode } from "react";

import { firstParagraph } from "../../api/firstParagraph";
import { checkNumber, numberSpec, rangeText } from "../../api/numberSpec";
import { displayValue } from "../../api/schemaForm";
import type { EnumOption } from "../../api/schemaValue";
import { defaultValueForSchema } from "../../api/schemaValue";
import { getAtPath } from "../../api/valuePath";
import type { FieldWidget } from "../../api/uiSchema";
import { useChrome, spanClass, type FieldMeta } from "./chrome";
import { DenseContext, useForm } from "./context";

/** `required` as the marker shows it: a nullable field is never mandatory. */
function marked(meta: FieldMeta): boolean {
  return meta.required && !meta.nullable;
}

/** Where `null` is a legal value, an empty control says so. */
const NULL_PLACEHOLDER = "none";

/**
 * What an empty control shows: the schema default while the key is absent (that is the
 * value the consumer will use), `none` for an explicit `null` or a nullable field with no
 * non-null default.
 */
function placeholderFor(meta: FieldMeta, value: unknown, fallback: string | undefined): string | undefined {
  if (value === null) return meta.nullable ? NULL_PLACEHOLDER : fallback;
  return fallback ?? (meta.nullable ? NULL_PLACEHOLDER : undefined);
}

/** A number field: bounds, unit and a verdict on what was typed. */
export function NumberLeaf({ meta }: { meta: FieldMeta }) {
  const form = useForm();
  const value = getAtPath(form.value, meta.path);
  const spec = numberSpec(meta.schema, meta.ui);
  const chrome = useChrome(meta, rangeText(spec));
  const [error, setError] = useState<string | undefined>();

  const fallback = meta.schema.default;
  const restore = meta.ui.restoreDefaultOnClear ?? true;
  let onClear: (() => void) | undefined;
  if (meta.nullable && meta.ui.clearTo === "null") onClear = () => form.setValue(meta.path, null);
  else if (!meta.required) {
    onClear = () => form.setValue(meta.path, restore && typeof fallback === "number" ? fallback : undefined);
  } else if (meta.nullable) onClear = () => form.setValue(meta.path, null);
  else if (restore && typeof fallback === "number") onClear = () => form.setValue(meta.path, fallback);
  else if (restore) onClear = () => form.setValue(meta.path, defaultValueForSchema(meta.schema, form.schema));

  const judge = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    const parsed = parseNumber(text);
    if (text.trim() === "") setError(undefined);
    else setError(parsed === null ? "Enter a number" : checkNumber(spec, parsed));
  };

  return (
    <Field
      label={meta.label}
      required={marked(meta)}
      annotation={chrome.annotation}
      description={chrome.description}
      error={error}
      className={spanClass(form.columns, meta.ui, 1)}
    >
      <NumberInput
        aria-label={meta.label}
        disabled={form.disabled}
        placeholder={placeholderFor(meta, value, typeof fallback === "number" ? String(fallback) : undefined)}
        value={typeof value === "number" ? value : null}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        unit={spec.unit}
        onChange={judge}
        onBlur={() => setError(undefined)}
        onValueChange={(next) => {
          // The control already holds back what is out of `[min, max]`; the integer rule and
          // the exclusive bounds are ours.
          if (checkNumber(spec, next) === undefined) form.setValue(meta.path, next);
        }}
        onClear={onClear}
      />
    </Field>
  );
}

/**
 * A string field. Emptying a nullable one removes an optional key (the schema default
 * applies) and writes `null` for a required key or under `clearTo: "null"`; a field that
 * cannot be `null` keeps `""`.
 */
export function TextLeaf({ meta }: { meta: FieldMeta }) {
  const form = useForm();
  const value = getAtPath(form.value, meta.path);
  const chrome = useChrome(meta);
  const fallback = meta.schema.default;

  return (
    <Field
      label={meta.label}
      required={marked(meta)}
      annotation={chrome.annotation}
      description={chrome.description}
      className={spanClass(form.columns, meta.ui, 1)}
    >
      <Input
        className="font-mono"
        autoComplete="off"
        spellCheck={false}
        aria-label={meta.label}
        disabled={form.disabled}
        placeholder={placeholderFor(meta, value, typeof fallback === "string" ? fallback : undefined)}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => {
          const text = event.currentTarget.value;
          if (text !== "" || !meta.nullable) form.setValue(meta.path, text);
          else if (meta.ui.clearTo === "null" || meta.required) form.setValue(meta.path, null);
          else form.setValue(meta.path, undefined);
        }}
      />
    </Field>
  );
}

/** A choice among a few values (all shown) or many (a picker). */
export function Chooser({
  label,
  options,
  value,
  onChoose,
  unsetLabel,
  widget,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  /** The chosen option's value, or `""`. */
  value: string;
  onChoose: (value: string) => void;
  /** Adds an entry that returns the field to unset (a nullable value). */
  unsetLabel?: string | undefined;
  widget?: FieldWidget | undefined;
  disabled: boolean;
}) {
  const size = byDensity(useDensity(), "md", "sm");
  const strip = widget === "segmented" || (widget !== "select" && options.length <= 3 && unsetLabel === undefined);
  return strip ? (
    <SegmentedControl
      aria-label={label}
      size={size}
      disabled={disabled}
      value={value}
      options={options}
      onValueChange={onChoose}
    />
  ) : (
    <Select
      aria-label={label}
      disabled={disabled}
      value={value}
      options={options}
      placeholder={unsetLabel ?? "Choose…"}
      unsetLabel={unsetLabel}
      onValueChange={onChoose}
    />
  );
}

/** A closed set of primitives: `enum`, `const`, or `oneOf` of `{ const }`. */
export function EnumLeaf({ meta, options }: { meta: FieldMeta; options: EnumOption[] }) {
  const form = useForm();
  const dense = use(DenseContext);
  const value = getAtPath(form.value, meta.path);
  const chrome = useChrome(meta);

  const shown = options.map((option) => ({
    value: String(option.value),
    label: meta.ui.enumLabels?.[String(option.value)] ?? option.label,
  }));
  // An absent key is its schema default, so that is the option shown as chosen.
  const selected = options.find((option) => option.value === (value === undefined ? meta.schema.default : value));
  // The chosen variant's own sentence ("No distortion; no parameter block.") under the strip.
  const explained =
    !dense && meta.ui.descriptionAs !== "none" ? firstParagraph(selected?.description) : "";
  const description: ReactNode =
    explained !== "" && chrome.description !== undefined ? (
      <>
        {chrome.description} {explained}
      </>
    ) : explained !== "" ? (
      explained
    ) : (
      chrome.description
    );

  return (
    <Field
      as="group"
      label={meta.label}
      required={marked(meta)}
      annotation={chrome.annotation}
      description={description}
      className={spanClass(form.columns, meta.ui, 1)}
    >
      <Chooser
        label={meta.label}
        options={shown}
        value={selected === undefined ? "" : String(selected.value)}
        widget={meta.ui.widget}
        disabled={form.disabled}
        unsetLabel={meta.nullable ? "None" : undefined}
        onChoose={(chosen) => {
          if (chosen === "") {
            if (meta.nullable) form.setValue(meta.path, null);
            return;
          }
          const option = options.find((candidate) => String(candidate.value) === chosen);
          if (option !== undefined) form.setValue(meta.path, option.value);
        }}
      />
    </Field>
  );
}

/** A boolean: a switch (the default) or a checkbox. */
export function BooleanLeaf({ meta }: { meta: FieldMeta }) {
  const form = useForm();
  const value = getAtPath(form.value, meta.path);
  const chrome = useChrome(meta);
  const props = {
    checked: value === true,
    onCheckedChange: (next: boolean) => form.setValue(meta.path, next),
    label: meta.label,
    description: chrome.description,
    disabled: form.disabled,
  };

  return (
    <div className={cn("flex min-w-0 items-start gap-1.5", spanClass(form.columns, meta.ui, 1))}>
      {meta.ui.widget === "checkbox" ? <Checkbox {...props} /> : <Switch {...props} />}
      {chrome.hint !== null && <span className="mt-0.5">{chrome.hint}</span>}
    </div>
  );
}

function pretty(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}

/**
 * Anything the form has no control for, as JSON.
 *
 * What is typed is kept as typed. A valid edit goes to the form; an invalid one shows its
 * parse error and leaves the last good value where it was. The text only resets when the
 * value changes from outside.
 */
export function JsonLeaf({ meta }: { meta: FieldMeta }) {
  const form = useForm();
  const value = getAtPath(form.value, meta.path);
  const chrome = useChrome(meta);
  const canonical = JSON.stringify(value) ?? "";
  const [draft, setDraft] = useState<{ text: string; error: string | undefined; base: string }>(() => ({
    text: pretty(value),
    error: undefined,
    base: canonical,
  }));
  if (draft.base !== canonical) setDraft({ text: pretty(value), error: undefined, base: canonical });

  const edit = (text: string) => {
    if (text.trim() === "") {
      if (meta.required) {
        setDraft({ text, error: "Enter a JSON value", base: draft.base });
      } else {
        setDraft({ text, error: undefined, base: "" });
        form.setValue(meta.path, undefined);
      }
      return;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      setDraft({ text, error: undefined, base: JSON.stringify(parsed) });
      form.setValue(meta.path, parsed);
    } catch (problem) {
      setDraft({ text, error: `Invalid JSON: ${problem instanceof Error ? problem.message : String(problem)}`, base: draft.base });
    }
  };

  return (
    <Field
      label={meta.label}
      required={marked(meta)}
      annotation={chrome.annotation}
      description={chrome.description}
      error={draft.error}
      className={spanClass(form.columns, meta.ui, 2)}
    >
      <Textarea
        rows={Math.min(Math.max(draft.text.split("\n").length, 3), 12)}
        spellCheck={false}
        aria-label={meta.label}
        disabled={form.disabled}
        value={draft.text}
        onChange={(event) => edit(event.currentTarget.value)}
      />
    </Field>
  );
}

interface RowIds {
  ids: number[];
  next: number;
}

/** Grow or shrink the row ids to `length`, keeping the ids of the rows that stay. */
function syncIds(rows: RowIds, length: number): RowIds {
  if (rows.ids.length === length) return rows;
  const ids = rows.ids.slice(0, length);
  let next = rows.next;
  while (ids.length < length) ids.push(next++);
  return { ids, next };
}

/**
 * An array of strings as a list: one input per entry, add and remove.
 *
 * Each row has an id of its own, so removing the second of three keeps the focus and the
 * cursor of the others instead of re-keying them by position.
 */
export function StringListLeaf({ meta, minItems, maxItems }: { meta: FieldMeta; minItems?: number | undefined; maxItems?: number | undefined }) {
  const form = useForm();
  const value = getAtPath(form.value, meta.path);
  const chrome = useChrome(meta);
  const raw: unknown[] = Array.isArray(value) ? (value as unknown[]) : [];
  const [rows, setRows] = useState<RowIds>(() => syncIds({ ids: [], next: 0 }, raw.length));
  const synced = syncIds(rows, raw.length);
  if (synced !== rows) setRows(synced);

  const write = (list: unknown[]) => form.setValue(meta.path, list);
  const canRemove = minItems === undefined || raw.length > minItems;
  const canAdd = maxItems === undefined || raw.length < maxItems;

  return (
    <Field
      as="group"
      label={meta.label}
      required={marked(meta)}
      annotation={chrome.annotation}
      description={chrome.description}
      className={spanClass(form.columns, meta.ui, 2)}
    >
      <div className="flex flex-col gap-1.5">
        {raw.map((entry, index) => (
          <div key={synced.ids[index]} className="flex gap-1.5">
            <Input
              className="min-w-0 flex-1 font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-label={`${meta.label} ${index + 1}`}
              disabled={form.disabled}
              value={displayValue(entry)}
              onChange={(event) => {
                const copy = raw.slice();
                copy[index] = event.currentTarget.value;
                write(copy);
              }}
            />
            <Button
              variant="ghost"
              aria-label={`Remove ${meta.label} ${index + 1}`}
              disabled={form.disabled || !canRemove}
              onClick={() => {
                setRows({ ids: synced.ids.filter((_, i) => i !== index), next: synced.next });
                write(raw.filter((_, i) => i !== index));
              }}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          className="self-start"
          aria-label={`Add ${meta.label}`}
          disabled={form.disabled || !canAdd}
          onClick={() => {
            setRows({ ids: [...synced.ids, synced.next], next: synced.next + 1 });
            write([...raw, ""]);
          }}
        >
          Add
        </Button>
      </div>
    </Field>
  );
}
