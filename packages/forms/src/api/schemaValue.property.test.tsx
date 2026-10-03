/**
 * Property tests over generated schemas.
 *
 * No generator library is a dependency of this repo, so schemas come from a small seeded
 * grammar (a PRNG, not `Math.random`: a failure names its seed and reproduces). The
 * grammar covers what schemars emits for Rust configs — nested structs, `$ref` into
 * `$defs` at any depth, nullable forms, serde external and internal tags, newtype
 * variants, string lists, tuples — and a small independent validator says whether a value
 * is one the schema allows.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SchemaValueForm } from "../components/SchemaValueForm";
import dataset from "./__fixtures__/dataset_spec.json";
import detector from "./__fixtures__/detector_config.json";
import handeye from "./__fixtures__/rig_handeye_config.json";
import planar from "./__fixtures__/planar_intrinsics_config.json";
import rigExtrinsics from "./__fixtures__/rig_extrinsics_config.json";
import type { JsonSchema } from "./schemaNode";
import { defaultValueForSchema, fieldsAt, shapeOf } from "./schemaValue";
import { getAtPath, setAtPath } from "./valuePath";

afterEach(cleanup);

// ── a seeded generator ──────────────────────────────────────────────────────────────────

type Rng = () => number;

/** mulberry32: small, fast, and good enough to vary a grammar. */
function rngFor(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const below = (rng: Rng, n: number) => Math.floor(rng() * n);
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[below(rng, items.length)] as T;
const chance = (rng: Rng, p: number) => rng() < p;

function leaf(rng: Rng): JsonSchema {
  switch (below(rng, 8)) {
    case 0: {
      const minimum = pick(rng, [0, 1, 2, 5]);
      return chance(rng, 0.5)
        ? { type: "integer", format: "uint32", minimum, maximum: minimum + pick(rng, [3, 10, 100]), default: minimum }
        : { type: "integer", format: "uint", minimum };
    }
    case 1:
      return { type: "number", format: "double", exclusiveMinimum: pick(rng, [0, 1]), maximum: 10, "x-unit": pick(rng, ["px", "mm"]) };
    case 2:
      return { type: "number", format: "float", minimum: -5, maximum: -1 };
    case 3:
      return { type: "string" };
    case 4:
      return { type: "boolean", default: chance(rng, 0.5) };
    case 5:
      return { type: "string", enum: ["alpha", "beta", "gamma", "delta"].slice(0, 2 + below(rng, 3)) };
    case 6:
      return { oneOf: [{ const: "one", type: "string", title: "One" }, { const: "two", type: "string", description: "Second." }] };
    default:
      return { type: "integer", enum: [256, 512, 1024], default: 512 };
  }
}

interface Ctx {
  rng: Rng;
  defs: Record<string, JsonSchema>;
}

function node(ctx: Ctx, depth: number): JsonSchema {
  const { rng } = ctx;
  const out = build(ctx, depth);
  // Hide it behind a $ref, with a description beside it, a third of the time.
  if (chance(rng, 0.35)) {
    const name = `D${Object.keys(ctx.defs).length}`;
    ctx.defs[name] = out;
    return { $ref: `#/$defs/${name}`, description: "The field's own words." };
  }
  return out;
}

function nullable(rng: Rng, schema: JsonSchema): JsonSchema {
  if (typeof schema.type === "string" && !schema.enum && chance(rng, 0.5)) return { ...schema, type: [schema.type, "null"] };
  return { anyOf: [schema, { type: "null" }], default: null };
}

function build(ctx: Ctx, depth: number): JsonSchema {
  const { rng } = ctx;
  const choice = below(rng, depth >= 3 ? 4 : 14);
  switch (choice) {
    case 0:
    case 1:
    case 2:
    case 3:
      return leaf(rng);
    case 4:
    case 5:
    case 6:
      return object(ctx, depth);
    case 7:
      return nullable(rng, chance(rng, 0.5) ? leaf(rng) : object(ctx, depth));
    case 8:
      return {
        description: "A serde external enum.",
        oneOf: [
          { const: "Off", type: "string", description: "Nothing." },
          { type: "object", properties: { Fixed: { type: "integer", format: "uint32", minimum: 1 } }, required: ["Fixed"], additionalProperties: false },
          { type: "object", properties: { Tuned: object(ctx, depth + 1) }, required: ["Tuned"], additionalProperties: false },
        ],
      };
    case 9:
      return {
        oneOf: [
          { type: "object", properties: { kind: { const: "Plain", type: "string" } }, required: ["kind"] },
          { type: "object", properties: { kind: { const: "Rich", type: "string" }, size: leaf(rng) }, required: ["kind", "size"] },
        ],
      };
    case 10:
      return { type: "array", items: { type: "string" } };
    case 11:
      return { type: "array", items: leaf(rng).type === "string" ? { type: "number" } : { type: "integer", minimum: 0 }, minItems: 3, maxItems: 3 };
    case 12:
      return { type: "array", items: object(ctx, depth + 1), minItems: 2, maxItems: 2 };
    default:
      return chance(rng, 0.5)
        ? { type: "array", items: { type: "number" } }
        : { type: "object", additionalProperties: { type: "string" } };
  }
}

function object(ctx: Ctx, depth: number): JsonSchema {
  const { rng } = ctx;
  const properties: Record<string, JsonSchema> = {};
  const count = 1 + below(rng, 4);
  for (let i = 0; i < count; i++) properties[`p${i}`] = node(ctx, depth + 1);
  const required = Object.keys(properties).filter(() => chance(rng, 0.6));
  return { type: "object", properties, required, additionalProperties: false };
}

function generate(seed: number): JsonSchema {
  const ctx: Ctx = { rng: rngFor(seed), defs: {} };
  const root = object(ctx, 0);
  return { ...root, $defs: ctx.defs };
}

// ── an independent validator ────────────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isValid(schema: JsonSchema, value: unknown, root: JsonSchema): boolean {
  let s = schema;
  for (let hops = 0; s.$ref !== undefined && hops < 20; hops++) {
    const name = s.$ref.replace("#/$defs/", "");
    const rest: JsonSchema = { ...s };
    delete rest.$ref;
    s = { ...root.$defs?.[name], ...rest };
  }
  if (Object.hasOwn(s, "const")) return deepEqual(s.const, value);
  if (s.enum !== undefined) return s.enum.some((entry) => deepEqual(entry, value));
  const branches = s.anyOf ?? s.oneOf;
  if (branches !== undefined) return branches.some((branch) => isValid(branch, value, root));

  const types = s.type === undefined ? undefined : Array.isArray(s.type) ? s.type : [s.type];
  if (types !== undefined && !types.some((type) => isType(type, s, value, root))) return false;
  if (types === undefined && s.properties !== undefined) return isType("object", s, value, root);
  return true;
}

function isType(type: string, s: JsonSchema, value: unknown, root: JsonSchema): boolean {
  switch (type) {
    case "null":
      return value === null;
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
    case "integer":
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      if (type === "integer" && !Number.isInteger(value)) return false;
      if (s.minimum !== undefined && value < s.minimum) return false;
      if (s.maximum !== undefined && value > s.maximum) return false;
      if (s.exclusiveMinimum !== undefined && value <= s.exclusiveMinimum) return false;
      if (s.exclusiveMaximum !== undefined && value >= s.exclusiveMaximum) return false;
      return true;
    }
    case "array": {
      if (!Array.isArray(value)) return false;
      if (s.minItems !== undefined && value.length < s.minItems) return false;
      if (s.maxItems !== undefined && value.length > s.maxItems) return false;
      const items = typeof s.items === "object" ? s.items : undefined;
      return items === undefined || value.every((entry) => isValid(items, entry, root));
    }
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      const properties = s.properties ?? {};
      for (const key of s.required ?? []) if (!Object.hasOwn(record, key)) return false;
      for (const [key, entry] of Object.entries(record)) {
        const property = properties[key];
        if (property === undefined) {
          if (s.additionalProperties === false) return false;
        } else if (!isValid(property, entry, root)) {
          return false;
        }
      }
      return true;
    }
    default:
      return false;
  }
}

function leafPaths(value: unknown, path = ""): string[] {
  if (typeof value !== "object" || value === null) return [path];
  const entries = Object.entries(value);
  if (entries.length === 0) return [path];
  return entries.flatMap(([key, child]) => leafPaths(child, path === "" ? key : `${path}.${key}`));
}

const SEEDS = Array.from({ length: 300 }, (_, seed) => seed);

// ── properties ──────────────────────────────────────────────────────────────────────────

describe("the harness", () => {
  it("rejects what a schema forbids, so a pass means something", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { n: { type: "integer", minimum: 2 }, s: { type: ["string", "null"] } },
      required: ["n"],
      additionalProperties: false,
    };
    expect(isValid(schema, { n: 2, s: null }, schema)).toBe(true);
    expect(isValid(schema, { n: 1 }, schema)).toBe(false);
    expect(isValid(schema, { n: 2.5 }, schema)).toBe(false);
    expect(isValid(schema, { s: "x" }, schema)).toBe(false);
    expect(isValid(schema, { n: 2, extra: 1 }, schema)).toBe(false);
    expect(isValid(schema, [], schema)).toBe(false);
  });

  it("generates every shape the form has to handle", () => {
    const all = SEEDS.map((seed) => JSON.stringify(generate(seed))).join("\n");
    for (const needle of ['"$ref"', '"anyOf"', '["integer","null"]', '"Fixed"', '"kind"', '"minItems"', '"enum"', '"oneOf"', '"x-unit"', '"additionalProperties":{"type":"string"}']) {
      expect(all, needle).toContain(needle);
    }
  });
});

describe("defaultValueForSchema", () => {
  it("seeds a value the schema allows, as plain JSON, deterministically", () => {
    for (const seed of SEEDS) {
      const schema = generate(seed);
      const value = defaultValueForSchema(schema);
      const context = `seed ${seed}: ${JSON.stringify(schema)}\n→ ${JSON.stringify(value)}`;
      expect(isValid(schema, value, schema), context).toBe(true);
      expect(JSON.parse(JSON.stringify(value)), context).toEqual(value);
      expect(defaultValueForSchema(schema), context).toEqual(value);
    }
  });

  it("never adds a key to a closed object", () => {
    for (const seed of SEEDS) {
      const schema = generate(seed);
      const value = defaultValueForSchema(schema) as Record<string, unknown>;
      const known = new Set(Object.keys(schema.properties ?? {}));
      expect(Object.keys(value).every((key) => known.has(key)), `seed ${seed}`).toBe(true);
    }
  });

  it("seeds a valid value for every calibration-rs schema and the detector fixture", () => {
    for (const fixture of [planar, rigExtrinsics, handeye, dataset, detector]) {
      const schema = fixture as unknown as JsonSchema;
      const value = defaultValueForSchema(schema);
      // The fixtures use oneOf with `additionalProperties: false` on variants, which the
      // small validator reads the same way; `required` is what matters most here.
      expect(isValid(schema, value, schema), JSON.stringify(schema.title)).toBe(true);
    }
  });
});

describe("shapeOf and fieldsAt", () => {
  it("read every generated schema without throwing, and list the root's fields in schema order", () => {
    for (const seed of SEEDS) {
      const schema = generate(seed);
      expect(shapeOf(schema, schema).kind, `seed ${seed}`).toBe("object");
      expect(fieldsAt(schema, "").map((field) => field.key), `seed ${seed}`).toEqual(Object.keys(schema.properties ?? {}));
      for (const field of fieldsAt(schema, "")) expect(() => shapeOf(field.schema, schema)).not.toThrow();
    }
  });
});

describe("getAtPath and setAtPath", () => {
  it("round-trip: setting what is there is the identity, and a set reads back", () => {
    for (const seed of SEEDS) {
      const schema = generate(seed);
      const value = defaultValueForSchema(schema);
      const snapshot = JSON.stringify(value);
      for (const path of leafPaths(value)) {
        const here = getAtPath(value, path);
        expect(setAtPath(value, path, here), `seed ${seed} ${path}`).toBe(value);

        const marker = { marker: seed };
        const next = setAtPath(value, path, marker);
        expect(getAtPath(next, path), `seed ${seed} ${path}`).toBe(marker);
        // Only that path differs.
        for (const other of leafPaths(value)) {
          if (other === path || other.startsWith(`${path}.`) || path.startsWith(`${other}.`)) continue;
          expect(getAtPath(next, other)).toEqual(getAtPath(value, other));
        }
      }
      expect(JSON.stringify(value), `seed ${seed}: mutated its input`).toBe(snapshot);
    }
  });
});

describe("SchemaValueForm", () => {
  // Each render is a full form; under coverage instrumentation on a CI runner 80 of them
  // take about 9 s, so this test gets its own budget rather than fewer seeds.
  it("renders the default value of generated schemas and reports nothing", { timeout: 30_000 }, () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const schema = generate(seed);
      const value = defaultValueForSchema(schema);
      const spy = vi.fn();
      const { container, unmount } = render(<SchemaValueForm schema={schema} value={value} onValueChange={spy} />);
      expect(spy, `seed ${seed}`).not.toHaveBeenCalled();
      expect(container.firstElementChild, `seed ${seed}`).not.toBeNull();
      unmount();
    }
  });
});
