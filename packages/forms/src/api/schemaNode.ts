/**
 * The schema-normalisation both forms stand on: follow a `$ref`, look through the
 * "or null" encodings, and name a field.
 *
 * `SchemaForm` (a flat "unset vs override" form) and `SchemaValueForm` (a full-value
 * editor) differ in what they do with a schema, not in how they read one. Every shape that
 * needs a decision — pydantic's `anyOf: [T, null]`, schemars' `type: ["T", "null"]`, a
 * `$ref` with the field's own `default` and `description` written beside it — is decided
 * here, once, so the two forms cannot drift into disagreeing about what a node *is*.
 */

/**
 * The subset of JSON Schema (draft 2020-12, as schemars and pydantic emit it) the forms
 * read. Keywords the forms do not read are simply absent: a real schema carries `$schema`,
 * `title` and `format` on the root and the form ignores what it does not know.
 *
 * A schema imported from a `.json` file is assignable as it is; a loosely typed one needs
 * a cast (`as unknown as JsonSchema`).
 */
export interface JsonSchema {
  /** A reference, normally into `$defs` (`#/$defs/Name`). */
  $ref?: string | undefined;
  /** Where a nested struct or an enum lands: schemars and pydantic never inline those. */
  $defs?: Record<string, JsonSchema> | undefined;
  /** The draft-07 spelling of `$defs`. */
  definitions?: Record<string, JsonSchema> | undefined;
  /** One type, or several (`["integer", "null"]` is a nullable integer). */
  type?: string | string[] | undefined;
  /** A human name. On a field it is a label; on a `$defs` entry it is a type name. */
  title?: string | undefined;
  /** Rustdoc or a docstring: Markdown, possibly several paragraphs. */
  description?: string | undefined;
  /** What applies when the field is absent. */
  default?: unknown;
  /** The one value allowed. */
  const?: unknown;
  /** The closed set of values allowed. */
  enum?: unknown[] | undefined;
  /** Rust integer and float widths: `uint`, `uint32`, `double`, … */
  format?: string | undefined;
  /** An object's fields, in schema order. */
  properties?: Record<string, JsonSchema> | undefined;
  /** The fields that must be present. */
  required?: string[] | undefined;
  /** `false` closes an object; a schema types a map's values. */
  additionalProperties?: JsonSchema | boolean | undefined;
  /** An array's element schema. */
  items?: JsonSchema | boolean | undefined;
  /** A tuple's per-position schemas. */
  prefixItems?: JsonSchema[] | undefined;
  /** The fewest elements. */
  minItems?: number | undefined;
  /** The most elements. */
  maxItems?: number | undefined;
  /** Exactly one of these (serde enums). */
  oneOf?: JsonSchema[] | undefined;
  /** At least one of these (`Option<T>` is `[T, null]`). */
  anyOf?: JsonSchema[] | undefined;
  /** All of these; the forms read only the one-entry form older schemars wrapped a `$ref` in. */
  allOf?: JsonSchema[] | undefined;
  /** Inclusive lower bound. */
  minimum?: number | undefined;
  /** Inclusive upper bound. */
  maximum?: number | undefined;
  /** Exclusive lower bound. */
  exclusiveMinimum?: number | undefined;
  /** Exclusive upper bound. */
  exclusiveMaximum?: number | undefined;
  /** The step a number moves in. */
  multipleOf?: number | undefined;
  /** The quantity's unit (`px`, `mm`): a vitavision extension, written by the Rust configs. */
  "x-unit"?: string | undefined;
  /** The schema's own answer to "does the caller have to think about this?" (`SchemaForm`). */
  "x-primary"?: boolean | undefined;
}

/** A node after its `$ref` and its "or null" encoding have been looked through. */
export interface ResolvedSchema<T extends JsonSchema = JsonSchema> {
  /** The node that says what the value *is*: no `$ref`, and no null branch left to see. */
  schema: T;
  /** True when `null` was an accepted value of the node as written. */
  nullable: boolean;
}

/** Enough hops for any real schema; a `$ref` cycle ends here instead of looping. */
const MAX_HOPS = 16;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Follow a JSON Pointer `$ref` (`#`, `#/$defs/Name`, `#/definitions/Name`) from the root.
 *
 * @param ref - The `$ref` string. Only same-document references (`#…`) resolve.
 * @param root - The document the pointer starts from.
 * @returns The schema it points at, or `undefined` for an external reference, a path that
 *   does not exist, or a target that is not a schema object.
 */
export function resolveRef(ref: string, root: JsonSchema): JsonSchema | undefined {
  if (ref === "#") return root;
  if (!ref.startsWith("#/")) return undefined;

  let current: unknown = root;
  for (const raw of ref.slice(2).split("/")) {
    let segment = raw;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      // A malformed escape is taken literally.
    }
    segment = segment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isObject(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return isObject(current) ? current : undefined;
}

/**
 * Follow one `$ref`, keeping what the field says about itself.
 *
 * The merge order matters and is the opposite of the obvious one. schemars and pydantic
 * write the field's `default` and `description` *beside* the `$ref`, while the target
 * carries the type's own `title` and docstring. The field's statement about itself wins;
 * the type's is the fallback.
 *
 * @param node - A node that may carry a `$ref`.
 * @param root - The document holding `$defs`.
 * @returns The node merged over its target, or `node` itself when there is nothing to
 *   follow (no `$ref`, or one that points at nothing).
 */
export function derefNode<T extends JsonSchema>(node: T, root: JsonSchema): T {
  if (node.$ref === undefined) return node;
  const target = resolveRef(node.$ref, root);
  if (target === undefined) return node;

  const rest: JsonSchema = { ...node };
  delete rest.$ref;
  // The merge of a schema over a schema is a schema of the same family as `node`.
  return { ...target, ...rest } as T;
}

function isNullSchema(branch: JsonSchema): boolean {
  return branch.type === "null" || (Object.hasOwn(branch, "const") && branch.const === null);
}

/**
 * Look through the "or null" encodings: `type: ["T", "null"]`, an `enum` that lists `null`,
 * and an `anyOf` / `oneOf` with a `{ type: "null" }` branch.
 *
 * An optional string arrives as `anyOf: [{type: "string"}, {type: "null"}]`; treating that
 * as an unrecognised node would give every nullable option a JSON textarea. When exactly
 * one branch is left it is merged into the node (the node's own siblings win); when several
 * are, they stay as the node's `anyOf` / `oneOf`.
 *
 * @param node - The node to look through.
 * @returns The node without its null alternative, and whether it had one.
 */
export function stripNullable<T extends JsonSchema>(node: T): ResolvedSchema<T> {
  let out: JsonSchema = node;
  let nullable = false;

  if (Array.isArray(out.type) && out.type.includes("null")) {
    const rest = out.type.filter((type) => type !== "null");
    const [only] = rest;
    if (only !== undefined) {
      out = { ...out, type: rest.length === 1 ? only : rest };
      nullable = true;
    }
  }

  if (out.enum?.includes(null) === true) {
    out = { ...out, enum: out.enum.filter((entry) => entry !== null) };
    nullable = true;
  }

  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = out[key];
    if (branches === undefined || !branches.some(isNullSchema)) continue;
    const remaining = branches.filter((branch) => !isNullSchema(branch));
    const [only] = remaining;
    if (only === undefined) continue;
    nullable = true;
    if (remaining.length === 1) {
      const rest: JsonSchema = { ...out };
      delete rest[key];
      out = { ...only, ...rest };
    } else {
      out = { ...out, [key]: remaining };
    }
  }

  // Unchanged stays identical, so a caller can tell whether anything happened.
  return { schema: (nullable ? out : node) as T, nullable };
}

/** `allOf: [X]` is how older schemars wrapped a `$ref` that needed siblings. */
function unwrapAllOf<T extends JsonSchema>(node: T): T {
  const [only] = node.allOf ?? [];
  if (only === undefined || node.allOf?.length !== 1) return node;
  const rest: JsonSchema = { ...node };
  delete rest.allOf;
  return { ...only, ...rest } as T;
}

/**
 * The node that says what a field *is*: `$ref` followed, `allOf: [X]` unwrapped and the
 * "or null" encoding looked through, repeatedly, because each can hide the next (a `$ref`
 * to an enum inside `anyOf: [{$ref}, null]`).
 *
 * @param node - A property or item schema as written.
 * @param root - The document holding `$defs` (defaults to `node`, for a root schema).
 * @returns The resolved node and whether `null` was among its accepted values. The field's
 *   own `default` and `description`, written beside a `$ref`, are kept.
 */
export function resolveSchema<T extends JsonSchema>(node: T, root: JsonSchema = node): ResolvedSchema<T> {
  let current = node;
  let nullable = false;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const followed = unwrapAllOf(derefNode(current, root));
    const stripped = stripNullable(followed);
    nullable ||= stripped.nullable;
    const done = stripped.schema === current;
    current = stripped.schema;
    if (done) break;
  }
  return { schema: current, nullable };
}

/**
 * Humanise `normal_dirs` into `Normal dirs`, and use a title only when a human chose it.
 *
 * pydantic emits a `title` for every field whether or not anyone wrote one, and its
 * generated form is Title Case — `Csv Path`, `Defect Type From Dir` — which reads like a
 * spreadsheet header rather than a form label. So a title is used only when it is *not*
 * the one pydantic would have generated, which is exactly when a human chose it.
 *
 * Read from the *unresolved* node on purpose. Dereferencing pulls in the type's own title,
 * so a resolved `color` field would be labelled "ColorMode".
 *
 * @param name - The property key.
 * @param node - The property's schema as written (not resolved).
 * @returns The label.
 */
export function labelFor(name: string, node: JsonSchema): string {
  const words = name.split("_");
  const generated = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  if (node.title && node.title !== generated) return node.title;

  const spaced = words.join(" ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
