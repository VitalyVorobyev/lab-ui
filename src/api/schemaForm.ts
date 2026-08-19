/**
 * Turning a JSON Schema into a form, and a form back into options.
 *
 * An options model — a plugin's config, an algorithm's parameters — is meant to *drive*
 * the UI form rather than have the form hardcoded and the schema's defaults merely hoped
 * to agree with it. That stops being survivable the moment an option is *required* and
 * nobody can type it.
 *
 * The logic lives here rather than in the component because it is where the decisions
 * are: what control a schema node deserves, what an empty box means, and when a value is
 * worth sending at all. Rendering is the easy half.
 *
 * Only the shapes pydantic (or an equivalent JSON Schema generator) actually emits are
 * handled. A node this does not recognise becomes a JSON textarea rather than
 * disappearing — a caller can always express what the model accepts, even where the form
 * has nothing prettier to offer.
 *
 * ## Two things worth reading before touching `kindOf`
 *
 * `enum` has to be tested *before* `type`: `Literal["small", "medium"]` emits `enum`
 * *alongside* `type: "string"`, and testing type first turns a closed set into a free text
 * box whose placeholder is the only hint of what is accepted. A `StrEnum` is worse —
 * pydantic emits it as `{"$ref": "#/$defs/ColorMode"}` with the default and description as
 * siblings, and `$ref` is not in the type at all, so it falls through every branch to a
 * JSON textarea unless `$defs` is resolved first.
 *
 * Numeric bounds are the same story: a field can carry `minimum`/`maximum` in the schema,
 * and a control that ignores them turns an out-of-range value into a backend rejection
 * reported nowhere near the field that caused it.
 */

/** The subset of JSON Schema that pydantic (or an equivalent generator) emits for an options model. */
export type SchemaNode = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  additionalProperties?: SchemaNode | boolean;
  /** A nested model's own fields. Recognised only so such a node is not mistaken for one
   * of the shapes above; it still renders as a JSON textarea. */
  properties?: Record<string, SchemaNode>;
  enum?: unknown[];
  $ref?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
};

export type OptionsSchema = {
  properties?: Record<string, SchemaNode>;
  required?: string[];
  /** Where an `Enum` or a nested model lands. Pydantic never inlines those. */
  $defs?: Record<string, SchemaNode>;
};

export type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "string-list"
  | "json"
  /** A closed set, few enough to show all at once. */
  | "choice-inline"
  /** A closed set, too many to show at once. */
  | "choice";

export type ChoiceOption = { value: string; label: string };

export type FieldSpec = {
  name: string;
  label: string;
  description: string | null;
  kind: FieldKind;
  required: boolean;
  /** Rendered into the empty control as a hint, never submitted on the caller's behalf. */
  placeholder: string;
  /** What applies when the field is left empty. Shown, not sent. */
  fallback: unknown;
  /** Behind a disclosure: there is already a working answer for this one. */
  advanced: boolean;
  /** The closed set, in schema order. Empty for every kind but the two choices. */
  options: ChoiceOption[];
  /** True when a choice's values are numbers, so the chosen one is sent as one. */
  numeric: boolean;
  /** Bounds the control can enforce. `"any"` step frees a float from the default of 1. */
  min?: number;
  max?: number;
  step?: number | "any";
  /** The bounds as a reader should see them, exclusive ones included. */
  range: string | null;
};

const DEFS_PREFIX = "#/$defs/";

/**
 * Follow a `$ref` into `$defs`.
 *
 * The merge order matters and is the opposite of the obvious one. Pydantic writes the
 * field's `default` and `description` *beside* the `$ref`, while the target carries the
 * enum's own `title` and sometimes its own docstring as a `description`. The field's
 * statement about itself wins; the type's is the fallback.
 */
function deref(node: SchemaNode, defs: Record<string, SchemaNode> | undefined): SchemaNode {
  if (node.$ref === undefined) return node;
  if (!node.$ref.startsWith(DEFS_PREFIX)) return node;

  const target = defs?.[node.$ref.slice(DEFS_PREFIX.length)];
  if (target === undefined) return node;

  const { $ref: _dropped, ...rest } = node;
  return { ...target, ...rest };
}

/**
 * Look through pydantic's `str | None` encoding to the type that carries the meaning.
 *
 * An optional string arrives as `anyOf: [{type: "string"}, {type: "null"}]`, and treating
 * that as an unrecognised node would give every nullable option a JSON textarea.
 */
function unwrap(node: SchemaNode): SchemaNode {
  if (!node.anyOf) return node;
  const meaningful = node.anyOf.filter((branch) => branch.type !== "null");
  return meaningful.length === 1 ? { ...node, ...meaningful[0] } : node;
}

/**
 * The node that says what this field *is*.
 *
 * Dereferenced on both sides of the unwrap because either can hold the `$ref`: a plain
 * `ColorMode` is a bare `$ref`, while an `Optional[ColorMode]` hides one inside `anyOf`.
 */
function resolve(node: SchemaNode, defs: Record<string, SchemaNode> | undefined): SchemaNode {
  return deref(unwrap(deref(node, defs)), defs);
}

function kindOf(resolved: SchemaNode): FieldKind {
  // Before `type`, always: a `Literal` carries both, and the closed set is the stronger
  // statement of the two.
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return resolved.enum.length <= 3 ? "choice-inline" : "choice";
  }
  if (resolved.type === "boolean") return "boolean";
  if (resolved.type === "integer" || resolved.type === "number") return "number";
  if (resolved.type === "string") return "text";
  if (resolved.type === "array" && unwrap(resolved.items ?? {}).type === "string") {
    return "string-list";
  }
  return "json";
}

/**
 * Which options a caller has to think about, and which already have an answer.
 *
 * The schema says this without anyone maintaining a second list: a field whose default is
 * *empty* — `[]`, `null`, `""`, or absent entirely — is one nothing can do anything useful
 * with until it is filled in. A field with a real default already works, and someone
 * filling in the form should not have to read past nine vocabulary options to answer the
 * question that actually needs an answer.
 */
function isAdvanced(node: SchemaNode): boolean {
  const fallback = node.default;
  if (fallback === undefined || fallback === null) return false;
  if (Array.isArray(fallback)) return fallback.length > 0;
  if (fallback === "") return false;
  if (typeof fallback === "object") return Object.keys(fallback).length > 0;
  return true;
}

/** Raw control state: what the operator chose, not what will be sent. */
export type RawValues = Record<string, string | boolean>;

/**
 * Humanise `normal_dirs` into `Normal dirs`.
 *
 * Pydantic emits a `title` for every field whether or not anyone wrote one, and its
 * generated form is Title Case — `Csv Path`, `Defect Type From Dir` — which reads like a
 * spreadsheet header rather than a form label. So a title is used only when it is *not*
 * the one pydantic would have generated, which is exactly when a human chose it.
 *
 * Read from the *unresolved* node on purpose. Dereferencing pulls in the enum class's own
 * title, so a resolved `color` field would be labelled "ColorMode".
 */
function labelFor(name: string, node: SchemaNode): string {
  const words = name.split("_");
  const generated = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  if (node.title && node.title !== generated) return node.title;

  const spaced = words.join(" ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function placeholderFor(kind: FieldKind, fallback: unknown): string {
  if (kind === "string-list") {
    return Array.isArray(fallback) && fallback.length > 0 ? fallback.join(", ") : "a, b, c";
  }
  if (kind === "json") return "{}";
  if (fallback === null || fallback === undefined) return "";
  return String(fallback);
}

/** `rgb` reads better as `Rgb` in a picker, but `bilinear` must not become `Bi Linear`. */
function optionLabel(value: unknown): string {
  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function optionsFor(resolved: SchemaNode, kind: FieldKind): ChoiceOption[] {
  if (kind !== "choice" && kind !== "choice-inline") return [];
  return (resolved.enum ?? []).map((value) => ({
    value: String(value),
    label: optionLabel(value),
  }));
}

/** The bounds as prose, keeping the distinction the HTML control cannot express. */
function rangeOf(resolved: SchemaNode): string | null {
  const parts: string[] = [];
  if (resolved.minimum !== undefined) parts.push(`≥ ${resolved.minimum}`);
  else if (resolved.exclusiveMinimum !== undefined) parts.push(`> ${resolved.exclusiveMinimum}`);
  if (resolved.maximum !== undefined) parts.push(`≤ ${resolved.maximum}`);
  else if (resolved.exclusiveMaximum !== undefined) parts.push(`< ${resolved.exclusiveMaximum}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function stepOf(resolved: SchemaNode): number | "any" | undefined {
  if (resolved.multipleOf !== undefined) return resolved.multipleOf;
  if (resolved.type === "integer") return 1;
  // A number input steps by 1 unless told otherwise, which marks a learning rate of 0.0001
  // invalid and refuses to submit it.
  return "any";
}

export function describeFields(schema: OptionsSchema): FieldSpec[] {
  const required = new Set(schema.required ?? []);
  const defs = schema.$defs;

  return Object.entries(schema.properties ?? {}).map(([name, node]) => {
    const resolved = resolve(node, defs);
    const kind = kindOf(resolved);
    const numeric =
      (kind === "choice" || kind === "choice-inline") &&
      (resolved.type === "integer" || resolved.type === "number");

    return {
      name,
      // From the raw node: the resolved one carries the enum type's title, not the field's.
      label: labelFor(name, node),
      description: node.description ?? resolved.description ?? null,
      kind,
      required: required.has(name),
      fallback: resolved.default,
      placeholder: placeholderFor(kind, resolved.default),
      advanced: !required.has(name) && isAdvanced(resolved),
      options: optionsFor(resolved, kind),
      numeric,
      ...(kind === "number"
        ? {
            min: resolved.minimum ?? resolved.exclusiveMinimum,
            max: resolved.maximum ?? resolved.exclusiveMaximum,
            step: stepOf(resolved),
          }
        : {}),
      range: kind === "number" ? rangeOf(resolved) : null,
    };
  });
}

/**
 * The controls' starting state.
 *
 * Text, list and choice controls start **empty even when the schema has a default**, and
 * that is deliberate: a pre-filled box says "this is your value" when what is true is "this
 * is what happens if you say nothing". Pre-filling would also mean every run sent every
 * default back, so a later change to a default would silently not reach anyone who had
 * once opened the form. The default is shown as the placeholder instead — and for a
 * segmented control, as the segment already highlighted.
 *
 * Booleans are the exception — a checkbox has no empty state, so it starts at the
 * default and is always sent.
 */
export function initialValues(fields: FieldSpec[]): RawValues {
  const values: RawValues = {};
  for (const field of fields) {
    values[field.name] = field.kind === "boolean" ? field.fallback === true : "";
  }
  return values;
}

/**
 * Build the options object to send.
 *
 * An untouched control contributes **nothing**, so the receiving side's own default
 * applies and stays the single definition of it. That is what keeps a default from
 * existing twice, once here and once wherever it is enforced, with the two free to drift.
 */
export function toOptions(fields: FieldSpec[], values: RawValues): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.name];

    if (field.kind === "boolean") {
      // Always sent: a checkbox cannot express "unset", so leaving it out would make its
      // rendered state and the value in force disagree whenever the default is `true`.
      options[field.name] = raw === true;
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") continue;

    switch (field.kind) {
      case "string-list":
        options[field.name] = text
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        break;
      case "number": {
        const parsed = Number(text);
        if (Number.isFinite(parsed)) options[field.name] = parsed;
        break;
      }
      case "choice":
      case "choice-inline": {
        // `Literal[1, 2, 3]` is a closed set whose members are numbers; the control can
        // only hand back a string, so the schema's own type decides what is sent.
        if (!field.numeric) {
          options[field.name] = text;
          break;
        }
        const parsed = Number(text);
        if (Number.isFinite(parsed)) options[field.name] = parsed;
        break;
      }
      case "json":
        try {
          options[field.name] = JSON.parse(text);
        } catch {
          // Left out rather than sent as a string: the receiving side would reject it with
          // a less useful message than the one `jsonErrors` puts next to the field.
        }
        break;
      default:
        options[field.name] = text;
    }
  }

  return options;
}

/** How many options the operator has actually changed, for the tab that hides them. */
export function overrideCount(fields: FieldSpec[], values: RawValues): number {
  const initial = initialValues(fields);
  return fields.filter((field) => values[field.name] !== initial[field.name]).length;
}

/** Which JSON fields do not parse, so the form can say so before the run starts. */
export function jsonErrors(fields: FieldSpec[], values: RawValues): string[] {
  return fields
    .filter((field) => field.kind === "json")
    .filter((field) => {
      const raw = values[field.name];
      if (typeof raw !== "string" || raw.trim() === "") return false;
      try {
        JSON.parse(raw);
        return false;
      } catch {
        return true;
      }
    })
    .map((field) => field.label);
}

/** Required fields the operator has not filled in. Blocks the run. */
export function missingRequired(fields: FieldSpec[], values: RawValues): string[] {
  return fields
    .filter((field) => field.required)
    .filter((field) => {
      const raw = values[field.name];
      if (typeof raw === "boolean") return false;
      return (raw ?? "").trim() === "";
    })
    .map((field) => field.label);
}

/**
 * Fields whose typed value is outside the bounds the schema states.
 *
 * Native `min`/`max` stop the spinner and mark the input invalid, but nothing stops a
 * paste, so the check is repeated here where it can block the button.
 */
export function outOfRange(fields: FieldSpec[], values: RawValues): string[] {
  return fields
    .filter((field) => field.kind === "number")
    .filter((field) => {
      const raw = values[field.name];
      if (typeof raw !== "string" || raw.trim() === "") return false;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return true;
      if (field.min !== undefined && parsed < field.min) return true;
      if (field.max !== undefined && parsed > field.max) return true;
      return false;
    })
    .map((field) => field.label);
}
