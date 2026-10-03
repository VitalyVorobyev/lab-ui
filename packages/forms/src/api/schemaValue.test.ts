import { describe, expect, it } from "vitest";

import detector from "./__fixtures__/detector_config.json";
import planar from "./__fixtures__/planar_intrinsics_config.json";
import rigExtrinsics from "./__fixtures__/rig_extrinsics_config.json";
import type { JsonSchema } from "./schemaNode";
import {
  activeExternal,
  activeTagged,
  defaultValueForSchema,
  fieldAt,
  fieldsAt,
  seedNotNull,
  seedVariant,
  shapeOf,
  type SchemaShape,
} from "./schemaValue";

const DETECTOR = detector as unknown as JsonSchema;
const PLANAR = planar as unknown as JsonSchema;
const RIG = rigExtrinsics as unknown as JsonSchema;

function shapeAt(schema: JsonSchema, path: string): SchemaShape {
  const info = fieldAt(schema, path);
  if (info === undefined) throw new Error(`no field at ${path}`);
  return shapeOf(info.schema, schema);
}

function kindOf(schema: JsonSchema, path: string): string {
  return shapeAt(schema, path).kind;
}

describe("shapeOf", () => {
  it("reads primitives", () => {
    expect(shapeOf({ type: "string" }).kind).toBe("string");
    expect(shapeOf({ type: "integer" }).kind).toBe("integer");
    expect(shapeOf({ type: "number" }).kind).toBe("number");
    expect(shapeOf({ type: "boolean" }).kind).toBe("boolean");
  });

  it("reads enum, const and oneOf of const as one closed set", () => {
    expect(shapeOf({ type: "string", enum: ["a", "b"] })).toMatchObject({ kind: "enum", options: [{ value: "a" }, { value: "b" }] });
    expect(shapeOf({ const: "only" })).toMatchObject({ kind: "enum", options: [{ value: "only" }] });
    const plain = shapeAt(PLANAR, "distortion_model");
    expect(plain).toMatchObject({ kind: "enum" });
    expect(plain.kind === "enum" && plain.options.map((o) => o.value)).toEqual([
      "none",
      "brown_conrady5",
      "rational8",
      "thin_prism9",
      "division1",
    ]);
    expect(plain.kind === "enum" && plain.options[0]?.description).toBe("No distortion; no parameter block.");
  });

  it("reads numeric enums and refuses a non-primitive one", () => {
    expect(shapeOf({ enum: [256, 512] })).toMatchObject({ kind: "enum", options: [{ value: 256, label: "256" }, { value: 512 }] });
    expect(shapeOf({ enum: [{ a: 1 }] }).kind).toBe("json");
    expect(shapeOf({ const: { a: 1 } }).kind).toBe("json");
  });

  it("reads a serde externally tagged enum, unit and data variants", () => {
    const shape = shapeAt(PLANAR, "solver.robust_loss");
    expect(shape.kind).toBe("external");
    if (shape.kind !== "external") return;
    expect(shape.variants.map((v) => [v.tag, v.payload === undefined ? "unit" : "data"])).toEqual([
      ["None", "unit"],
      ["Huber", "data"],
      ["Cauchy", "data"],
      ["Arctan", "data"],
    ]);
  });

  it("reads newtype variants as external too", () => {
    const shape = shapeAt(DETECTOR, "threshold");
    expect(shape.kind).toBe("external");
    if (shape.kind !== "external") return;
    expect(shape.variants.map((v) => v.tag)).toEqual(["Auto", "Fixed", "Relative"]);
    expect(shape.variants[1]?.payload).toMatchObject({ type: "integer" });
  });

  it("reads an enum of unit variants spelled as {type: string, enum: [...]}", () => {
    const shape = shapeOf({
      oneOf: [{ type: "string", enum: ["A", "B"] }, { type: "object", properties: { C: { type: "integer" } }, required: ["C"] }],
    });
    expect(shape.kind === "external" && shape.variants.map((v) => v.tag)).toEqual(["A", "B", "C"]);
  });

  it("reads an internally tagged enum and finds the discriminator generically", () => {
    const kind = shapeAt(DETECTOR, "refiner");
    expect(kind).toMatchObject({ kind: "tagged", discriminator: "kind" });
    if (kind.kind !== "tagged") return;
    expect(kind.variants.map((v) => v.tag)).toEqual(["CenterOfMass", "Forstner", "SaddlePoint"]);
    expect(kind.variants[1]?.fields.map((f) => f.key)).toEqual(["radius", "min_eigenvalue"]);

    const custom = shapeOf({
      oneOf: [
        { type: "object", properties: { id: { type: "string" }, mode: { const: "x" } } },
        { type: "object", properties: { id: { type: "string" }, mode: { const: "y" } } },
      ],
    });
    expect(custom).toMatchObject({ kind: "tagged", discriminator: "mode" });
  });

  it("does not take two variants with the same tag for a tagged enum", () => {
    const same = shapeOf({
      oneOf: [
        { type: "object", properties: { kind: { const: "a" }, x: { type: "integer" } } },
        { type: "object", properties: { kind: { const: "a" }, y: { type: "integer" } } },
      ],
    });
    expect(same.kind).toBe("json");
  });

  it("reads objects, with required and order", () => {
    const shape = shapeAt(PLANAR, "solver");
    expect(shape.kind).toBe("object");
    expect(shape.kind === "object" && shape.fields.map((f) => [f.key, f.required])).toEqual([
      ["max_iters", true],
      ["robust_loss", true],
      ["verbosity", true],
    ]);
  });

  it("reads a closed empty object as an object, an open one as JSON", () => {
    expect(shapeOf({ type: "object", properties: {}, additionalProperties: false }).kind).toBe("object");
    expect(shapeOf({ type: "object", properties: {} }).kind).toBe("json");
    expect(shapeOf({ type: "object", additionalProperties: { type: "string" } }).kind).toBe("json");
  });

  it("reads arrays of strings as a list, fixed arrays of numbers or objects as a tuple, the rest as JSON", () => {
    expect(shapeOf({ type: "array", items: { type: "string" } }).kind).toBe("string-list");
    expect(kindOf(DETECTOR, "anchors")).toBe("tuple");
    expect(kindOf(DETECTOR, "roi")).toBe("tuple");
    expect(kindOf(DETECTOR, "channel_weights")).toBe("json");
    expect(kindOf(PLANAR, "fix_poses")).toBe("json");
    expect(shapeOf({ type: "array", prefixItems: [{ type: "string" }, { type: "number" }] })).toMatchObject({
      kind: "tuple",
      items: [{ type: "string" }, { type: "number" }],
    });
    expect(shapeOf({ type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 }).kind).toBe("string-list");
    expect(shapeOf({ type: "array", items: { type: "number" }, minItems: 99, maxItems: 99 }).kind).toBe("json");
    expect(shapeOf({ type: "array", items: { type: "boolean" }, minItems: 2, maxItems: 2 }).kind).toBe("json");
    expect(shapeOf({ type: "array" }).kind).toBe("json");
    expect(shapeOf({ type: "array", items: true }).kind).toBe("json");
  });

  it("reads a list of strings through a $ref", () => {
    const root: JsonSchema = { $defs: { Path: { type: "string" } }, type: "array", items: { $ref: "#/$defs/Path" } };
    expect(shapeOf(root).kind).toBe("string-list");
  });

  it("falls back to JSON for what it does not know", () => {
    expect(shapeOf({}).kind).toBe("json");
    expect(shapeOf({ type: ["string", "integer"] }).kind).toBe("json");
    expect(shapeOf({ oneOf: [{ type: "string" }, { type: "integer" }] }).kind).toBe("json");
    expect(shapeOf({ oneOf: [{ type: "object", properties: { a: { type: "integer" }, b: { type: "integer" } } }, { type: "string" }] }).kind).toBe("json");
    expect(shapeOf({ oneOf: [{ const: 1 }, { type: "object", properties: { A: { type: "integer" } } }] }).kind).toBe("json");
  });

  it("sees through nullable and $ref", () => {
    expect(kindOf(DETECTOR, "pyramid")).toBe("object");
    expect(kindOf(DETECTOR, "min_strength")).toBe("number");
    expect(kindOf(DETECTOR, "max_corners")).toBe("integer");
    expect(kindOf(DETECTOR, "label")).toBe("string");
    expect(kindOf(RIG, "sensor")).toBe("tagged");
  });
});

describe("fieldAt / fieldsAt", () => {
  it("returns the root for the empty path", () => {
    expect(fieldAt(PLANAR, "")).toMatchObject({ key: "", required: true });
    expect(fieldsAt(PLANAR, "").map((f) => f.key)).toEqual(["distortion_model", "fix_camera", "fix_poses", "init", "solver"]);
  });

  it("walks objects and reports required", () => {
    expect(fieldAt(PLANAR, "solver.max_iters")).toMatchObject({ key: "max_iters", required: true });
    expect(fieldAt(PLANAR, "distortion_model")?.required).toBe(false);
    expect(fieldAt(PLANAR, "fix_camera.distortion.k3")?.schema).toMatchObject({ type: "boolean" });
  });

  it("walks through unions without a value, by tag or by field", () => {
    expect(fieldAt(PLANAR, "solver.robust_loss.Huber.scale")?.schema).toMatchObject({ type: "number" });
    expect(fieldAt(DETECTOR, "threshold.Fixed")?.schema).toMatchObject({ type: "integer" });
    expect(fieldAt(DETECTOR, "refiner.min_eigenvalue")).toBeDefined();
    expect(fieldAt(RIG, "sensor.init_tilt_x")).toBeDefined();
  });

  it("walks tuples and lists by index", () => {
    expect(fieldAt(DETECTOR, "anchors.2.y")?.schema).toMatchObject({ type: "number" });
    expect(fieldAt(DETECTOR, "roi.3")?.schema).toMatchObject({ type: "integer" });
    expect(fieldAt({ type: "array", items: { type: "string" } }, "1")?.schema).toMatchObject({ type: "string" });
  });

  it("answers undefined where the path leaves the schema", () => {
    expect(fieldAt(PLANAR, "solver.nope")).toBeUndefined();
    expect(fieldAt(PLANAR, "distortion_model.x")).toBeUndefined();
    expect(fieldAt(DETECTOR, "anchors.9")).toBeUndefined();
    expect(fieldAt(DETECTOR, "threshold.Auto")).toBeUndefined();
    expect(fieldAt({ type: "array", items: { type: "string" } }, "x")).toBeUndefined();
    expect(fieldsAt(PLANAR, "solver.nope")).toEqual([]);
  });

  it("lists the fields the form would show", () => {
    expect(fieldsAt(PLANAR, "solver").map((f) => f.key)).toEqual(["max_iters", "robust_loss", "verbosity"]);
    expect(fieldsAt(PLANAR, "distortion_model")).toEqual([]);
  });

  it("lists the active variant's fields, without the discriminator", () => {
    const value = { refiner: { kind: "Forstner", radius: 4, min_eigenvalue: null } };
    expect(fieldsAt(DETECTOR, "refiner", DETECTOR, value).map((f) => f.key)).toEqual(["radius", "min_eigenvalue"]);
    expect(fieldsAt(DETECTOR, "refiner").map((f) => f.key)).toEqual(["radius"]);
    expect(fieldsAt(DETECTOR, "refiner", DETECTOR, { refiner: { kind: "SaddlePoint" } }).map((f) => f.key)).toEqual(["max_iters"]);
  });

  it("lists the payload of an externally tagged variant", () => {
    expect(fieldsAt(PLANAR, "solver.robust_loss", PLANAR, { solver: { robust_loss: { Huber: { scale: 1 } } } }).map((f) => f.key)).toEqual(["Huber"]);
    expect(fieldsAt(PLANAR, "solver.robust_loss", PLANAR, { solver: { robust_loss: "None" } })).toEqual([]);
  });

  it("lists a tuple's positions and a list's entries", () => {
    expect(fieldsAt(DETECTOR, "roi").map((f) => f.key)).toEqual(["0", "1", "2", "3"]);
    const list: JsonSchema = { type: "array", items: { type: "string" } };
    expect(fieldsAt(list, "", list, ["a", "b"]).map((f) => f.key)).toEqual(["0", "1"]);
    expect(fieldsAt(list, "", list, undefined)).toEqual([]);
  });
});

describe("active variants", () => {
  const tagged = shapeAt(DETECTOR, "refiner");
  const external = shapeAt(DETECTOR, "threshold");

  it("finds the tagged variant a value is on", () => {
    if (tagged.kind !== "tagged") throw new Error();
    expect(activeTagged(tagged, { kind: "Forstner" })?.tag).toBe("Forstner");
    expect(activeTagged(tagged, { kind: "Nope" })).toBeUndefined();
    expect(activeTagged(tagged, "Forstner")).toBeUndefined();
    expect(activeTagged(tagged, undefined)).toBeUndefined();
  });

  it("finds the external variant a value is on", () => {
    if (external.kind !== "external") throw new Error();
    expect(activeExternal(external, "Auto")?.tag).toBe("Auto");
    expect(activeExternal(external, { Fixed: 3 })?.tag).toBe("Fixed");
    expect(activeExternal(external, "Fixed")).toBeUndefined();
    expect(activeExternal(external, { Other: 1 })).toBeUndefined();
    expect(activeExternal(external, 3)).toBeUndefined();
  });
});

describe("defaultValueForSchema", () => {
  it("prefers the default, and a default beside a $ref wins over the target's", () => {
    expect(defaultValueForSchema({ type: "integer", default: 7 })).toBe(7);
    const root: JsonSchema = { $defs: { M: { enum: ["a", "b"], default: "a" } } };
    expect(defaultValueForSchema({ $ref: "#/$defs/M", default: "b" }, root)).toBe("b");
    expect(defaultValueForSchema({ $ref: "#/$defs/M" }, root)).toBe("a");
  });

  it("seeds primitives from their type", () => {
    expect(defaultValueForSchema({ type: "string" })).toBe("");
    expect(defaultValueForSchema({ type: "boolean" })).toBe(false);
    expect(defaultValueForSchema({ type: "integer" })).toBe(0);
    expect(defaultValueForSchema({ type: "array", items: { type: "string" } })).toEqual([]);
  });

  it("seeds a number with the nearest legal value to zero", () => {
    expect(defaultValueForSchema({ type: "integer", minimum: 3 })).toBe(3);
    expect(defaultValueForSchema({ type: "integer", format: "uint" })).toBe(0);
    expect(defaultValueForSchema({ type: "number", exclusiveMinimum: 0 })).toBe(1);
    expect(defaultValueForSchema({ type: "number", exclusiveMinimum: 0, exclusiveMaximum: 1 })).toBe(0.5);
    expect(defaultValueForSchema({ type: "integer", exclusiveMinimum: 0 })).toBe(1);
    expect(defaultValueForSchema({ type: "number", maximum: -2 })).toBe(-2);
    expect(defaultValueForSchema({ type: "number", minimum: 1.5 })).toBe(1.5);
    expect(defaultValueForSchema({ type: "integer", minimum: 0.5 })).toBe(1);
  });

  it("seeds the first value of a closed set, the first variant of a union", () => {
    expect(defaultValueForSchema({ enum: ["x", "y"] })).toBe("x");
    expect(defaultValueForSchema(DETECTOR.properties?.["upscale"] as JsonSchema, DETECTOR)).toBe("None");
    expect(defaultValueForSchema({ oneOf: [{ type: "string" }, { type: "integer" }] })).toBe("");
    expect(defaultValueForSchema({ oneOf: [{ type: "object", properties: { a: { type: "integer" } }, required: ["a"] }, { type: "string" }] })).toEqual({
      a: 0,
    });
  });

  it("seeds an object with its required fields and the fields that have a default", () => {
    const value = defaultValueForSchema(PLANAR) as Record<string, unknown>;
    expect(Object.keys(value).sort()).toEqual(["distortion_model", "fix_camera", "fix_poses", "init", "solver"].sort());
    expect(value["solver"]).toEqual({ max_iters: 0, robust_loss: "None", verbosity: 0 });
  });

  it("seeds a nullable as null, and a required nullable too", () => {
    expect(defaultValueForSchema({ type: ["integer", "null"] })).toBeNull();
    const value = defaultValueForSchema(DETECTOR) as Record<string, unknown>;
    expect(value["pyramid"]).toBeNull();
    expect(value["min_strength"]).toBeNull();
  });

  it("seeds tagged unions with their tag in place, and external ones as the first variant", () => {
    expect(defaultValueForSchema(DETECTOR)).toMatchObject({ refiner: { kind: "CenterOfMass", radius: 3 }, threshold: "Auto" });
    const noDefault = shapeAt(RIG, "sensor");
    expect(noDefault.kind).toBe("tagged");
    const huber: JsonSchema = {
      oneOf: [{ type: "object", properties: { Huber: { type: "object", properties: { scale: { type: "number" } }, required: ["scale"] } }, required: ["Huber"] }],
    };
    expect(defaultValueForSchema(huber)).toEqual({ Huber: { scale: 0 } });
  });

  it("seeds a tuple position by position and a JSON array as empty", () => {
    expect(defaultValueForSchema({ type: "array", prefixItems: [{ type: "string" }, { type: "boolean" }] })).toEqual(["", false]);
    expect(defaultValueForSchema({ type: "array", items: { type: "number" } })).toEqual([]);
    expect(defaultValueForSchema({ type: "object", additionalProperties: { type: "string" } })).toEqual({});
    expect(defaultValueForSchema({})).toBeNull();
    expect(defaultValueForSchema({ type: ["string", "integer"] })).toBeNull();
  });

  it("stops on a self-referential schema", () => {
    const tree: JsonSchema = {
      $defs: { Node: { type: "object", properties: { next: { $ref: "#/$defs/Node" } }, required: ["next"] } },
      $ref: "#/$defs/Node",
    };
    expect(() => defaultValueForSchema(tree)).not.toThrow();
  });
});

describe("seedNotNull", () => {
  it("switches a nullable on with the value its shape implies, not its null default", () => {
    const node = DETECTOR.properties?.["pyramid"] as JsonSchema;
    expect(defaultValueForSchema(node, DETECTOR)).toBeNull();
    expect(seedNotNull(node, DETECTOR)).toEqual({ levels: 3, scale: 0.5 });
    expect(seedNotNull(DETECTOR.properties?.["roi"] as JsonSchema, DETECTOR)).toEqual([0, 0, 0, 0]);
  });

  it("keeps a real default", () => {
    expect(seedNotNull({ type: ["integer", "null"], default: 4 }, {})).toBe(4);
  });
});

describe("seedVariant", () => {
  it("resets a tagged union to the variant's own seed", () => {
    const shape = shapeAt(DETECTOR, "refiner");
    if (shape.kind !== "tagged") throw new Error();
    expect(seedVariant(shape, "Forstner", DETECTOR)).toEqual({ kind: "Forstner", radius: 4, min_eigenvalue: null });
    expect(seedVariant(shape, "SaddlePoint", DETECTOR)).toEqual({ kind: "SaddlePoint", max_iters: 10 });
    expect(seedVariant(shape, "Nope", DETECTOR)).toBeUndefined();
  });

  it("seeds an external union's unit, newtype and struct variants", () => {
    const shape = shapeAt(DETECTOR, "threshold");
    if (shape.kind !== "external") throw new Error();
    expect(seedVariant(shape, "Auto", DETECTOR)).toBe("Auto");
    expect(seedVariant(shape, "Fixed", DETECTOR)).toEqual({ Fixed: 0 });
    expect(seedVariant(shape, "Relative", DETECTOR)).toEqual({ Relative: { fraction: 0, floor: 0 } });
    expect(seedVariant(shape, "Nope", DETECTOR)).toBeUndefined();
  });
});
