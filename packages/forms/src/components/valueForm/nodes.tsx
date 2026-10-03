/**
 * The tree of a `SchemaValueForm`: a field dispatcher and the containers that nest it.
 *
 * A node is addressed by its dot path. It reads its value from the form, writes it back by
 * path, and renders whatever its schema's shape calls for: a control for a leaf, a
 * fieldset for an object, a variant selector for a union, a row for a tuple, a switch for
 * a nullable composite.
 */

import { Checkbox, Switch, byDensity, cn, useDensity } from "@vitavision/ui";
import { use, type ReactNode } from "react";

import { firstParagraph } from "../../api/firstParagraph";
import { labelFor, resolveSchema, type JsonSchema } from "../../api/schemaNode";
import {
  activeExternal,
  activeTagged,
  seedNotNull,
  seedVariant,
  shapeOf,
  type FieldInfo,
  type SchemaShape,
} from "../../api/schemaValue";
import { fieldUiAt } from "../../api/uiSchema";
import { getAtPath, joinPath } from "../../api/valuePath";
import { Grid, spanClass, useChrome, type FieldMeta } from "./chrome";
import { Chooser, BooleanLeaf, EnumLeaf, JsonLeaf, NumberLeaf, StringListLeaf, TextLeaf } from "./leaves";
import { DenseContext, useForm } from "./context";

type TaggedShape = Extract<SchemaShape, { kind: "tagged" }>;
type ExternalShape = Extract<SchemaShape, { kind: "external" }>;
type TupleShape = Extract<SchemaShape, { kind: "tuple" }>;

const BOOLEANS = [
  { value: true, label: "true" },
  { value: false, label: "false" },
];

/** Shapes that are a block of their own, so a nullable one gets a switch rather than an empty box. */
function isComposite(shape: SchemaShape): boolean {
  return (
    shape.kind === "object" ||
    shape.kind === "tagged" ||
    shape.kind === "external" ||
    shape.kind === "tuple" ||
    shape.kind === "string-list"
  );
}

/** `ui.widget` can change what an array or any value is edited as. */
function applyWidget(shape: SchemaShape, meta: FieldMeta, value: unknown): SchemaShape {
  const items = typeof meta.schema.items === "object" ? meta.schema.items : undefined;
  switch (meta.ui.widget) {
    case "json":
      return { kind: "json" };
    case "string-list":
      return meta.schema.type === "array" ? { kind: "string-list", item: items ?? { type: "string" } } : shape;
    case "tuple-row":
      return items !== undefined && Array.isArray(value)
        ? { kind: "tuple", items: (value as unknown[]).map(() => items) }
        : shape;
    default:
      return shape;
  }
}

/**
 * One field of the form, at a path.
 *
 * Honours the app's `hidden` and `renderField`, then renders the control or container its
 * schema's shape calls for. A nullable composite (an object that may be `null`) gets a
 * switch; a nullable leaf is an empty control.
 */
export function FieldNode({
  path,
  name,
  node,
  required,
  bare = false,
}: {
  path: string;
  /** The key (or index) the field has in its parent, for the default label. */
  name: string;
  /** The schema as written. */
  node: JsonSchema;
  required: boolean;
  /** Without the container's own chrome (legend, border): the root, and a switched-on nullable. */
  bare?: boolean;
}) {
  const form = useForm();
  const ui = fieldUiAt(form.ui, path);
  if (ui.hidden === true) return null;

  const { schema, nullable } = resolveSchema(node, form.schema);
  const value = getAtPath(form.value, path);
  const meta: FieldMeta = { path, label: ui.label ?? labelFor(name, node), required, node, schema, nullable, ui };
  const shape = applyWidget(shapeOf(schema, form.schema), meta, value);

  if (form.renderField !== undefined) {
    const custom = form.renderField({
      path,
      schema,
      value,
      onChange: (next) => form.setValue(path, next),
      disabled: form.disabled,
    });
    if (custom !== undefined) {
      return <div className={spanClass(form.columns, ui, isComposite(shape) ? 2 : 1)}>{custom}</div>;
    }
  }

  if (nullable && isComposite(shape)) return <NullableNode meta={meta} shape={shape} />;
  return <ShapeNode meta={meta} shape={shape} bare={bare} />;
}

/** Render a resolved shape. */
function ShapeNode({ meta, shape, bare }: { meta: FieldMeta; shape: SchemaShape; bare: boolean }) {
  switch (shape.kind) {
    case "integer":
    case "number":
      return <NumberLeaf meta={meta} />;
    case "string":
      return <TextLeaf meta={meta} />;
    case "boolean":
      return meta.nullable ? <EnumLeaf meta={meta} options={BOOLEANS} /> : <BooleanLeaf meta={meta} />;
    case "enum":
      return <EnumLeaf meta={meta} options={shape.options} />;
    case "string-list":
      return <StringListLeaf meta={meta} minItems={meta.schema.minItems} maxItems={meta.schema.maxItems} />;
    case "json":
      return <JsonLeaf meta={meta} />;
    case "object":
      return <ObjectNode meta={meta} fields={shape.fields} bare={bare} />;
    case "tagged":
    case "external":
      return <UnionNode meta={meta} shape={shape} bare={bare} />;
    case "tuple":
      return <TupleNode meta={meta} shape={shape} bare={bare} />;
  }
}

/** The fields of an object that are neither hidden by the app nor claimed by a group. */
function useVisible(path: string, fields: FieldInfo[]): FieldInfo[] {
  const form = useForm();
  return fields.filter((field) => {
    const child = joinPath(path, field.key);
    return !form.claimed.has(child) && fieldUiAt(form.ui, child).hidden !== true;
  });
}

/**
 * The fields of an object, each as a node, skipping hidden ones and ones a group has claimed.
 * Renders nothing when none is left.
 */
export function ObjectBody({ path, fields }: { path: string; fields: FieldInfo[] }) {
  const visible = useVisible(path, fields);
  if (visible.length === 0) return null;

  return (
    <Grid>
      {visible.map((field) => (
        <FieldNode key={field.key} path={joinPath(path, field.key)} name={field.key} node={field.schema} required={field.required} />
      ))}
    </Grid>
  );
}

/** The frame of a composite field: its label and hint over its content. `bare` drops the frame. */
function Frame({ meta, bare, children }: { meta: FieldMeta; bare: boolean; children: ReactNode }) {
  const form = useForm();
  const dense = use(DenseContext);
  const density = useDensity();
  const chrome = useChrome(meta);
  if (bare) return <div className="flex min-w-0 flex-col gap-3">{children}</div>;

  return (
    <fieldset
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-panel border border-line",
        byDensity(density, "p-3", "p-2"),
        !dense && spanClass(form.columns, meta.ui, 2),
      )}
    >
      <legend className="px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
          {meta.label}
          {chrome.hint}
        </span>
      </legend>
      {chrome.description !== undefined && <p className="text-xs leading-snug text-fg-muted">{chrome.description}</p>}
      {children}
    </fieldset>
  );
}

function ObjectNode({ meta, fields, bare }: { meta: FieldMeta; fields: FieldInfo[]; bare: boolean }) {
  if (useVisible(meta.path, fields).length === 0) return null;
  return (
    <Frame meta={meta} bare={bare}>
      <ObjectBody path={meta.path} fields={fields} />
    </Frame>
  );
}

/** A union: the variant selector, the variant's description, and the variant's fields. */
function UnionNode({ meta, shape, bare }: { meta: FieldMeta; shape: TaggedShape | ExternalShape; bare: boolean }) {
  const form = useForm();
  const value = getAtPath(form.value, meta.path);
  const active = shape.kind === "tagged" ? activeTagged(shape, value) : activeExternal(shape, value);
  const options = shape.variants.map((variant) => ({
    value: variant.tag,
    label: meta.ui.enumLabels?.[variant.tag] ?? variant.label,
  }));
  const explained = meta.ui.descriptionAs === "none" ? "" : firstParagraph(active?.description);

  let body: ReactNode = null;
  if (shape.kind === "tagged") {
    const variant = activeTagged(shape, value);
    if (variant !== undefined) body = <ObjectBody path={meta.path} fields={variant.fields} />;
  } else {
    const variant = activeExternal(shape, value);
    if (variant?.payload !== undefined) {
      const inner = joinPath(meta.path, variant.tag);
      const payload = shapeOf(variant.payload, form.schema);
      body =
        payload.kind === "object" ? (
          <ObjectBody path={inner} fields={payload.fields} />
        ) : (
          <Grid>
            <FieldNode path={inner} name={variant.tag} node={variant.payload} required />
          </Grid>
        );
    }
  }

  return (
    <Frame meta={meta} bare={bare}>
      <Chooser
        label={meta.label}
        options={options}
        value={active?.tag ?? ""}
        widget={meta.ui.widget}
        disabled={form.disabled}
        onChoose={(tag) => {
          const next = seedVariant(shape, tag, form.schema);
          if (next !== undefined) form.setValue(meta.path, next);
        }}
      />
      {explained !== "" && <p className="text-xs leading-snug text-fg-muted">{explained}</p>}
      {body}
    </Frame>
  );
}

/**
 * A fixed-length array as a compact row: one cell per position (a row of numbers), or one
 * row per position when the positions are objects (a list of points).
 */
function TupleNode({ meta, shape, bare }: { meta: FieldMeta; shape: TupleShape; bare: boolean }) {
  const form = useForm();
  const cells = shape.items.map((item, index) => {
    const name = String(index);
    return { name, item, resolved: shapeOf(item, form.schema), path: joinPath(meta.path, name) };
  });
  const rows = cells.some((cell) => cell.resolved.kind === "object");

  return (
    <Frame meta={meta} bare={bare}>
      <DenseContext value>
        {rows ? (
          <div className="flex flex-col gap-2">
            {cells.map((cell) => (
              <div key={cell.name} role="group" aria-label={`${meta.label} ${cell.name}`} className="flex items-start gap-2">
                <span className="w-4 shrink-0 pt-1.5 font-mono text-xs text-fg-subtle" aria-hidden>
                  {cell.name}
                </span>
                <div className="min-w-0 flex-1">
                  {cell.resolved.kind === "object" ? (
                    <ObjectBody path={cell.path} fields={cell.resolved.fields} />
                  ) : (
                    <Grid>
                      <FieldNode path={cell.path} name={cell.name} node={cell.item} required />
                    </Grid>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Grid>
            {cells.map((cell) => (
              <FieldNode key={cell.name} path={cell.path} name={cell.name} node={cell.item} required />
            ))}
          </Grid>
        )}
      </DenseContext>
    </Frame>
  );
}

/**
 * A composite that may be `null`: a switch for "set / unset", and the content only while set.
 * Switching it on seeds the content from the schema's defaults.
 */
function NullableNode({ meta, shape }: { meta: FieldMeta; shape: SchemaShape }) {
  const form = useForm();
  const chrome = useChrome(meta);
  const value = getAtPath(form.value, meta.path);
  const set = value !== null && value !== undefined;
  const props = {
    checked: set,
    label: meta.label,
    description: chrome.description,
    disabled: form.disabled,
    onCheckedChange: (next: boolean) => form.setValue(meta.path, next ? seedNotNull(meta.node, form.schema) : null),
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", spanClass(form.columns, meta.ui, 2))}>
      <div className="flex items-start gap-1.5">
        {meta.ui.widget === "checkbox" ? <Checkbox {...props} /> : <Switch {...props} />}
        {chrome.hint !== null && <span className="mt-0.5">{chrome.hint}</span>}
      </div>
      {set && (
        <div className="min-w-0 border-l border-line pl-3">
          <ShapeNode meta={meta} shape={shape} bare />
        </div>
      )}
    </div>
  );
}
