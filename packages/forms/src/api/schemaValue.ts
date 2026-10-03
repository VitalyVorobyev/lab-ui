/**
 * Reading a schema as the shape of a *value*: what a node is, which fields it has, and
 * what a fresh one looks like.
 *
 * `SchemaForm` asks "which control does this option deserve?". `SchemaValueForm` asks the
 * deeper question — "what can this value be, all the way down?" — and the answer has to
 * cover what Rust's serde does to enums:
 *
 * - a **plain enum** is `oneOf` of `{ const }`, or `enum`;
 * - an **externally tagged** enum is `"None"` for a unit variant and `{ "Huber": { … } }`
 *   (or `{ "Fixed": 2 }`, a newtype) for a variant that carries data;
 * - an **internally tagged** enum is an object whose `kind` (or any property that is a
 *   `const` in every variant) names the variant.
 *
 * Everything here is pure: the component only renders what these functions decide.
 */

import { getAtPath, splitPath } from "./valuePath";
import { resolveSchema, type JsonSchema } from "./schemaNode";

/** A primitive an enum can hold. */
export type EnumValue = string | number | boolean;

/** One value of a closed set. */
export interface EnumOption {
  /** The value as stored. */
  value: EnumValue;
  /** The label as shown: the variant's `title`, else the value. */
  label: string;
  /** The variant's own description (a `oneOf` entry's), if it has one. */
  description?: string | undefined;
}

/** One field of an object: its key, its schema as written, and whether it must be present. */
export interface FieldInfo {
  /** The property key. */
  key: string;
  /** The property's schema as written (a `$ref` is not followed). */
  schema: JsonSchema;
  /** Whether the object's `required` lists the key. */
  required: boolean;
}

/** A variant of an internally tagged enum. */
export interface TaggedVariant {
  /** The discriminator's value for this variant. */
  tag: string;
  /** The variant's `title`, else the tag. */
  label: string;
  /** The variant's description. */
  description?: string | undefined;
  /** The variant's object schema, resolved. */
  schema: JsonSchema;
  /** The variant's fields, without the discriminator. */
  fields: FieldInfo[];
}

/** A variant of an externally tagged enum. */
export interface ExternalVariant {
  /** The variant name: the string for a unit variant, the sole key for one with data. */
  tag: string;
  /** The variant's `title`, else the tag. */
  label: string;
  /** The variant's description. */
  description?: string | undefined;
  /** What the variant carries (a struct's fields, or a newtype's one value); none for a unit variant. */
  payload: JsonSchema | undefined;
}

/** What a schema node is, as far as a form is concerned. */
export type SchemaShape =
  /** A struct: its fields in schema order. */
  | { kind: "object"; fields: FieldInfo[] }
  | { kind: "string" }
  | { kind: "integer" }
  | { kind: "number" }
  | { kind: "boolean" }
  /** A closed set of primitives: `enum`, `const`, or `oneOf` of `{ const }`. */
  | { kind: "enum"; options: EnumOption[] }
  /** An enum whose variants are objects named by a shared `const` property. */
  | { kind: "tagged"; discriminator: string; variants: TaggedVariant[] }
  /** A serde externally tagged enum. */
  | { kind: "external"; variants: ExternalVariant[] }
  /** An array of plain strings. */
  | { kind: "string-list"; item: JsonSchema }
  /** A fixed-length array: `prefixItems`, or `minItems === maxItems` of numbers or objects. */
  | { kind: "tuple"; items: JsonSchema[] }
  /** Anything else: edited as JSON. */
  | { kind: "json" };

type TaggedShape = Extract<SchemaShape, { kind: "tagged" }>;
type ExternalShape = Extract<SchemaShape, { kind: "external" }>;

/** The longest fixed-length array shown as a row of cells rather than as JSON. */
const MAX_TUPLE = 32;
/** Discriminator names tried first; any other shared `const` property works too. */
const PREFERRED_DISCRIMINATORS = ["kind", "type", "tag", "variant"];
/** Recursion limit for seeding a value from a self-referential schema. */
const MAX_DEPTH = 8;

function isPrimitive(value: unknown): value is EnumValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldsOf(schema: JsonSchema, omit?: string): FieldInfo[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {})
    .filter(([key]) => key !== omit)
    .map(([key, property]) => ({ key, schema: property, required: required.has(key) }));
}

/** The primitives a `const` / `enum` variant fixes, or `undefined` if it is not one. */
function constValues(variant: JsonSchema): EnumValue[] | undefined {
  if (variant.properties !== undefined) return undefined;
  if (Object.hasOwn(variant, "const")) return isPrimitive(variant.const) ? [variant.const] : undefined;
  if (Array.isArray(variant.enum) && variant.enum.length > 0 && variant.enum.every(isPrimitive)) {
    return variant.enum;
  }
  return undefined;
}

function constString(property: JsonSchema | undefined, root: JsonSchema): string | undefined {
  if (property === undefined) return undefined;
  const [value] = constValues(resolveSchema(property, root).schema) ?? [];
  return typeof value === "string" ? value : undefined;
}

function classifyTagged(variants: JsonSchema[], root: JsonSchema): TaggedShape | undefined {
  if (!variants.every((variant) => variant.properties !== undefined)) return undefined;
  const [first] = variants;
  const keys = Object.keys(first?.properties ?? {});
  const candidates = [
    ...PREFERRED_DISCRIMINATORS.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !PREFERRED_DISCRIMINATORS.includes(key)),
  ];

  for (const discriminator of candidates) {
    const tags = variants.map((variant) => constString(variant.properties?.[discriminator], root));
    if (!tags.every((tag): tag is string => tag !== undefined)) continue;
    if (new Set(tags).size !== tags.length) continue;
    return {
      kind: "tagged",
      discriminator,
      variants: variants.map((variant, index) => ({
        tag: tags[index] ?? "",
        label: variant.title ?? tags[index] ?? "",
        description: variant.description,
        schema: variant,
        fields: fieldsOf(variant, discriminator),
      })),
    };
  }
  return undefined;
}

function classifyExternal(variants: JsonSchema[]): ExternalShape | undefined {
  const out: ExternalVariant[] = [];
  for (const variant of variants) {
    const units = constValues(variant);
    if (units !== undefined) {
      if (!units.every((unit) => typeof unit === "string")) return undefined;
      for (const unit of units) {
        out.push({ tag: String(unit), label: variant.title ?? String(unit), description: variant.description, payload: undefined });
      }
      continue;
    }
    const keys = Object.keys(variant.properties ?? {});
    const [tag] = keys;
    const payload = tag === undefined ? undefined : variant.properties?.[tag];
    if (keys.length !== 1 || tag === undefined || payload === undefined || variant.additionalProperties === true) {
      return undefined;
    }
    out.push({ tag, label: variant.title ?? tag, description: variant.description, payload });
  }
  return new Set(out.map((variant) => variant.tag)).size === out.length ? { kind: "external", variants: out } : undefined;
}

function classifyUnion(branches: JsonSchema[], root: JsonSchema): SchemaShape {
  const variants = branches.map((branch) => resolveSchema(branch, root).schema);

  const options: EnumOption[] = [];
  for (const variant of variants) {
    for (const value of constValues(variant) ?? []) {
      options.push({ value, label: variant.title ?? String(value), description: variant.description });
    }
  }
  if (variants.every((variant) => constValues(variant) !== undefined)) return { kind: "enum", options };

  return classifyTagged(variants, root) ?? classifyExternal(variants) ?? { kind: "json" };
}

function classifyArray(schema: JsonSchema, root: JsonSchema): SchemaShape {
  if (schema.prefixItems !== undefined && schema.prefixItems.length > 0) {
    return { kind: "tuple", items: schema.prefixItems };
  }
  const items = typeof schema.items === "object" ? schema.items : undefined;
  if (items === undefined) return { kind: "json" };

  const item = resolveSchema(items, root).schema;
  const itemShape = classify(item, root);
  if (itemShape.kind === "string") return { kind: "string-list", item: items };

  const count = schema.minItems;
  const fixed = count !== undefined && count === schema.maxItems && count >= 1 && count <= MAX_TUPLE;
  if (fixed && (itemShape.kind === "number" || itemShape.kind === "integer" || itemShape.kind === "object")) {
    return { kind: "tuple", items: Array.from({ length: count }, () => items) };
  }
  return { kind: "json" };
}

function classify(schema: JsonSchema, root: JsonSchema): SchemaShape {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.every(isPrimitive)
      ? { kind: "enum", options: schema.enum.map((value) => ({ value, label: String(value) })) }
      : { kind: "json" };
  }
  if (Object.hasOwn(schema, "const")) {
    return isPrimitive(schema.const)
      ? { kind: "enum", options: [{ value: schema.const, label: String(schema.const) }] }
      : { kind: "json" };
  }

  const branches = schema.oneOf ?? schema.anyOf;
  if (branches !== undefined && branches.length > 0) return classifyUnion(branches, root);

  if (schema.properties !== undefined) {
    const fields = fieldsOf(schema);
    // `{}` closed is a unit struct; `{}` open is a map the form cannot enumerate.
    return fields.length > 0 || schema.additionalProperties === false ? { kind: "object", fields } : { kind: "json" };
  }

  switch (schema.type) {
    case "string":
      return { kind: "string" };
    case "integer":
      return { kind: "integer" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "array":
      return classifyArray(schema, root);
    default:
      return { kind: "json" };
  }
}

/**
 * What a schema node is.
 *
 * Looks through `$ref` and the "or null" encodings first (see `resolveSchema`), then
 * decides among the shapes of `SchemaShape`. A node it does not recognise is `json`, never
 * an error: a caller can always express what the model accepts.
 *
 * @param node - A schema node as written.
 * @param root - The document holding `$defs` (defaults to `node`).
 * @returns The shape.
 */
export function shapeOf(node: JsonSchema, root: JsonSchema = node): SchemaShape {
  return classify(resolveSchema(node, root).schema, root);
}

/**
 * The variant an internally tagged value is on.
 *
 * @param shape - A `tagged` shape.
 * @param value - The current value.
 * @returns The variant whose tag is in the value's discriminator, or `undefined` for a
 *   value that names none (absent, not an object, an unknown tag).
 */
export function activeTagged(shape: TaggedShape, value: unknown): TaggedVariant | undefined {
  const tag = isRecord(value) ? value[shape.discriminator] : undefined;
  return typeof tag === "string" ? shape.variants.find((variant) => variant.tag === tag) : undefined;
}

/**
 * The variant an externally tagged value is on.
 *
 * @param shape - An `external` shape.
 * @param value - The current value: the string of a unit variant, or an object with the
 *   variant's name as its key.
 * @returns The variant, or `undefined` for a value that names none.
 */
export function activeExternal(shape: ExternalShape, value: unknown): ExternalVariant | undefined {
  if (typeof value === "string") {
    return shape.variants.find((variant) => variant.payload === undefined && variant.tag === value);
  }
  if (!isRecord(value)) return undefined;
  return shape.variants.find((variant) => variant.payload !== undefined && Object.hasOwn(value, variant.tag));
}

function seedOf(schema: JsonSchema, root: JsonSchema, depth: number, notNull: boolean): unknown {
  const { schema: s, nullable } = resolveSchema(schema, root);
  if (s.default !== undefined && !(notNull && s.default === null)) return s.default;
  if (nullable && !notNull) return null;
  if (depth > MAX_DEPTH) return null;

  const shape = classify(s, root);
  switch (shape.kind) {
    case "enum":
      return shape.options[0]?.value ?? null;
    case "string":
      return "";
    case "boolean":
      return false;
    case "integer":
    case "number":
      return seedNumber(s, shape.kind === "integer");
    case "object": {
      const out: Record<string, unknown> = {};
      for (const field of shape.fields) {
        const hasDefault = resolveSchema(field.schema, root).schema.default !== undefined;
        if (field.required || hasDefault) out[field.key] = seedOf(field.schema, root, depth + 1, false);
      }
      return out;
    }
    case "tagged": {
      const [variant] = shape.variants;
      return variant === undefined ? null : seedTagged(shape, variant, root, depth);
    }
    case "external": {
      const [variant] = shape.variants;
      return variant === undefined ? null : seedExternal(variant, root, depth);
    }
    case "tuple":
      return shape.items.map((item) => seedOf(item, root, depth + 1, false));
    case "string-list":
      return [];
    case "json": {
      const [first] = s.oneOf ?? s.anyOf ?? [];
      if (first !== undefined) return seedOf(first, root, depth + 1, false);
      if (s.type === "array") return [];
      return s.type === "object" ? {} : null;
    }
  }
}

function seedNumber(schema: JsonSchema, integer: boolean): number {
  const lower = schema.minimum ?? (schema.format?.startsWith("uint") === true ? 0 : undefined);
  const exclusiveLower = schema.exclusiveMinimum;
  const upper = schema.maximum ?? schema.exclusiveMaximum;

  let value = 0;
  if (lower !== undefined && value < lower) value = lower;
  if (exclusiveLower !== undefined && value <= exclusiveLower) {
    value = integer ? exclusiveLower + 1 : upper !== undefined ? (exclusiveLower + upper) / 2 : exclusiveLower + 1;
  }
  if (upper !== undefined && value > upper) value = lower ?? upper;
  return integer ? Math.ceil(value) : value;
}

function seedTagged(shape: TaggedShape, variant: TaggedVariant, root: JsonSchema, depth: number): unknown {
  const body = seedOf(variant.schema, root, depth + 1, false);
  return { ...(isRecord(body) ? body : {}), [shape.discriminator]: variant.tag };
}

function seedExternal(variant: ExternalVariant, root: JsonSchema, depth: number): unknown {
  return variant.payload === undefined ? variant.tag : { [variant.tag]: seedOf(variant.payload, root, depth + 1, false) };
}

/**
 * A fresh value for a schema.
 *
 * Takes the `default` when there is one (a `default` written beside a `$ref` wins over the
 * target's), `null` for a nullable node, and otherwise builds the value from the shape:
 * an object gets its required fields and the fields that have a default, an enum its first
 * value, a union its first variant, a number the nearest legal value to 0, a string `""`.
 * The result is JSON, and for a schema this package can read, valid against it.
 *
 * @param schema - A schema node.
 * @param root - The document holding `$defs` (defaults to `schema`).
 * @returns The seed value.
 */
export function defaultValueForSchema(schema: JsonSchema, root: JsonSchema = schema): unknown {
  return seedOf(schema, root, 0, false);
}

/**
 * The seed for a node that is switched on from `null`: its default, unless that default is
 * itself `null`, in which case the value the shape implies.
 *
 * @param schema - A schema node.
 * @param root - The document holding `$defs`.
 * @returns A value that is not `null` (for a node that can hold anything else).
 */
export function seedNotNull(schema: JsonSchema, root: JsonSchema): unknown {
  return seedOf(schema, root, 0, true);
}

/**
 * The value for a union after the user picks a variant: the variant's own seed, with its
 * tag in place.
 *
 * @param shape - A `tagged` or `external` shape.
 * @param tag - The chosen variant's tag.
 * @param root - The document holding `$defs`.
 * @returns The new value, or `undefined` if the shape has no such variant.
 */
export function seedVariant(shape: TaggedShape | ExternalShape, tag: string, root: JsonSchema): unknown {
  if (shape.kind === "tagged") {
    const variant = shape.variants.find((candidate) => candidate.tag === tag);
    return variant === undefined ? undefined : seedTagged(shape, variant, root, 0);
  }
  const variant = shape.variants.find((candidate) => candidate.tag === tag);
  return variant === undefined ? undefined : seedExternal(variant, root, 0);
}

/** The fields of the shape for the value as it stands (the active variant, for a union). */
function childrenOf(shape: SchemaShape, value: unknown): FieldInfo[] {
  switch (shape.kind) {
    case "object":
      return shape.fields;
    case "tagged":
      return (activeTagged(shape, value) ?? shape.variants[0])?.fields ?? [];
    case "external": {
      const variant = activeExternal(shape, value);
      return variant?.payload === undefined ? [] : [{ key: variant.tag, schema: variant.payload, required: true }];
    }
    case "tuple":
      return shape.items.map((schema, index) => ({ key: String(index), schema, required: true }));
    case "string-list":
      return Array.isArray(value) ? value.map((_, index) => ({ key: String(index), schema: shape.item, required: true })) : [];
    default:
      return [];
  }
}

/** The child called `segment`, wherever it is — the active variant first, then any. */
function findChild(shape: SchemaShape, segment: string, value: unknown): FieldInfo | undefined {
  switch (shape.kind) {
    case "tagged": {
      const active = activeTagged(shape, value);
      const variants = active === undefined ? shape.variants : [active, ...shape.variants];
      for (const variant of variants) {
        const field = variant.fields.find((candidate) => candidate.key === segment);
        if (field !== undefined) return field;
      }
      return undefined;
    }
    case "external": {
      const variant = shape.variants.find((candidate) => candidate.payload !== undefined && candidate.tag === segment);
      return variant?.payload === undefined ? undefined : { key: segment, schema: variant.payload, required: true };
    }
    case "tuple": {
      const schema = shape.items[Number(segment)];
      return schema === undefined ? undefined : { key: segment, schema, required: true };
    }
    case "string-list":
      return /^\d+$/.test(segment) ? { key: segment, schema: shape.item, required: true } : undefined;
    default:
      return childrenOf(shape, value).find((candidate) => candidate.key === segment);
  }
}

/**
 * The field at a dot path.
 *
 * Walks the schema, not the value: a path through a union resolves in the variant the
 * `value` is on if it has the field, else in whichever variant does, so a `UiSchema` path
 * can name a field that is not showing right now.
 *
 * @param schema - The root schema.
 * @param path - Dot path from the root (`solver.robust_loss.Huber.scale`); `""` is the root.
 * @param root - The document holding `$defs` (defaults to `schema`).
 * @param value - The current value, to choose between a union's variants.
 * @returns The field (its schema as written, and whether it is required), or `undefined`
 *   where the path leaves the schema.
 */
export function fieldAt(
  schema: JsonSchema,
  path: string,
  root: JsonSchema = schema,
  value?: unknown,
): FieldInfo | undefined {
  let info: FieldInfo = { key: "", schema, required: true };
  let current = value;
  for (const segment of splitPath(path)) {
    const next = findChild(shapeOf(info.schema, root), segment, current);
    if (next === undefined) return undefined;
    info = next;
    current = getAtPath(current, segment);
  }
  return info;
}

/**
 * The fields that are editable at a path, as the form would list them: an object's fields
 * in schema order, the active variant's fields (without the discriminator) for an internally
 * tagged union, the variant's payload for an externally tagged one, a tuple's positions.
 *
 * @param schema - The root schema.
 * @param path - Dot path from the root; `""` for the root.
 * @param root - The document holding `$defs` (defaults to `schema`).
 * @param value - The current root value, to choose between a union's variants (the first
 *   variant when absent).
 * @returns The fields; empty for a leaf or a path outside the schema.
 */
export function fieldsAt(schema: JsonSchema, path: string, root: JsonSchema = schema, value?: unknown): FieldInfo[] {
  const info = fieldAt(schema, path, root, value);
  return info === undefined ? [] : childrenOf(shapeOf(info.schema, root), getAtPath(value, path));
}
