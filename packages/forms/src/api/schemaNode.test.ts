import { describe, expect, it } from "vitest";

import { derefNode, labelFor, resolveRef, resolveSchema, stripNullable, type JsonSchema } from "./schemaNode";

const ROOT: JsonSchema = {
  $defs: {
    Mode: { type: "string", enum: ["a", "b"], title: "Mode", description: "The type's docstring." },
    "a/b": { type: "integer" },
    "sp ace": { type: "boolean" },
    Alias: { $ref: "#/$defs/Mode" },
  },
  definitions: { Old: { type: "number" } },
};

describe("resolveRef", () => {
  it("follows #/$defs and the draft-07 #/definitions", () => {
    expect(resolveRef("#/$defs/Mode", ROOT)).toBe(ROOT.$defs?.["Mode"]);
    expect(resolveRef("#/definitions/Old", ROOT)).toEqual({ type: "number" });
  });

  it("resolves # to the root and decodes JSON-pointer and URI escapes", () => {
    expect(resolveRef("#", ROOT)).toBe(ROOT);
    expect(resolveRef("#/$defs/a~1b", ROOT)).toEqual({ type: "integer" });
    expect(resolveRef("#/$defs/sp%20ace", ROOT)).toEqual({ type: "boolean" });
  });

  it("takes a malformed escape literally rather than throwing", () => {
    expect(resolveRef("#/$defs/100%", ROOT)).toBeUndefined();
  });

  it("returns undefined for what it cannot reach", () => {
    expect(resolveRef("https://example.com/s.json", ROOT)).toBeUndefined();
    expect(resolveRef("#/$defs/Missing", ROOT)).toBeUndefined();
    expect(resolveRef("#/$defs/Mode/type", ROOT)).toBeUndefined();
    expect(resolveRef("#/$defs/Mode/type/length", ROOT)).toBeUndefined();
  });

  it("does not walk the prototype chain", () => {
    expect(resolveRef("#/$defs/__proto__", ROOT)).toBeUndefined();
    expect(resolveRef("#/$defs/constructor", ROOT)).toBeUndefined();
  });
});

describe("derefNode", () => {
  it("lets what the field says about itself win over the type's", () => {
    const merged = derefNode({ $ref: "#/$defs/Mode", default: "b", description: "Mine." }, ROOT);
    expect(merged).toMatchObject({ type: "string", enum: ["a", "b"], default: "b", description: "Mine.", title: "Mode" });
    expect(merged.$ref).toBeUndefined();
  });

  it("returns the node itself when there is nothing to follow", () => {
    const plain: JsonSchema = { type: "string" };
    expect(derefNode(plain, ROOT)).toBe(plain);
    const dangling: JsonSchema = { $ref: "#/$defs/Nope" };
    expect(derefNode(dangling, ROOT)).toBe(dangling);
  });
});

describe("stripNullable", () => {
  it("reads type: [T, null]", () => {
    expect(stripNullable({ type: ["integer", "null"], minimum: 0 })).toEqual({
      schema: { type: "integer", minimum: 0 },
      nullable: true,
    });
  });

  it("keeps several remaining types as an array", () => {
    expect(stripNullable({ type: ["string", "integer", "null"] }).schema.type).toEqual(["string", "integer"]);
  });

  it("leaves a type that is only null alone", () => {
    expect(stripNullable({ type: ["null"] })).toEqual({ schema: { type: ["null"] }, nullable: false });
  });

  it("reads an enum that lists null", () => {
    expect(stripNullable({ enum: ["a", null] })).toEqual({ schema: { enum: ["a"] }, nullable: true });
  });

  it("merges anyOf [X, null] and lets the node's siblings win", () => {
    const result = stripNullable({
      anyOf: [{ $ref: "#/$defs/Mode", description: "branch" }, { type: "null" }],
      description: "node",
      default: null,
    });
    expect(result.nullable).toBe(true);
    expect(result.schema).toEqual({ $ref: "#/$defs/Mode", description: "node", default: null });
  });

  it("reads oneOf and a const-null branch the same way", () => {
    expect(stripNullable({ oneOf: [{ type: "string" }, { const: null }] })).toEqual({
      schema: { type: "string" },
      nullable: true,
    });
  });

  it("keeps several non-null branches", () => {
    const result = stripNullable({ anyOf: [{ type: "string" }, { type: "integer" }, { type: "null" }] });
    expect(result.nullable).toBe(true);
    expect(result.schema.anyOf).toEqual([{ type: "string" }, { type: "integer" }]);
  });

  it("ignores a union of nothing but null, and returns an unchanged node as the same object", () => {
    const onlyNull: JsonSchema = { anyOf: [{ type: "null" }] };
    expect(stripNullable(onlyNull)).toEqual({ schema: onlyNull, nullable: false });
    const plain: JsonSchema = { type: "string" };
    expect(stripNullable(plain).schema).toBe(plain);
  });
});

describe("resolveSchema", () => {
  it("looks through a $ref hidden inside anyOf: [{$ref}, null]", () => {
    const { schema, nullable } = resolveSchema(
      { anyOf: [{ $ref: "#/$defs/Mode" }, { type: "null" }], default: null, description: "Mine." },
      ROOT,
    );
    expect(nullable).toBe(true);
    expect(schema).toMatchObject({ type: "string", enum: ["a", "b"], default: null, description: "Mine." });
  });

  it("follows a chain of refs", () => {
    expect(resolveSchema({ $ref: "#/$defs/Alias" }, ROOT).schema).toMatchObject({ enum: ["a", "b"] });
  });

  it("unwraps the one-entry allOf older schemars wrapped a $ref in", () => {
    const { schema } = resolveSchema({ allOf: [{ $ref: "#/$defs/Mode" }], default: "a" }, ROOT);
    expect(schema).toMatchObject({ enum: ["a", "b"], default: "a" });
    expect(schema.allOf).toBeUndefined();
  });

  it("leaves a many-entry allOf alone", () => {
    const node: JsonSchema = { allOf: [{ type: "string" }, { minLength: 1 } as JsonSchema] };
    expect(resolveSchema(node).schema).toBe(node);
  });

  it("stops on a $ref cycle instead of looping", () => {
    const cyclic: JsonSchema = { $defs: { A: { $ref: "#/$defs/B" }, B: { $ref: "#/$defs/A" } } };
    expect(() => resolveSchema({ $ref: "#/$defs/A" }, cyclic)).not.toThrow();
  });

  it("takes the node as its own root by default", () => {
    const self: JsonSchema = { $defs: { X: { type: "integer" } }, properties: { x: { $ref: "#/$defs/X" } } };
    expect(resolveSchema(self.properties?.["x"] as JsonSchema, self).schema.type).toBe("integer");
    expect(resolveSchema({ type: "string" }).nullable).toBe(false);
  });
});

describe("labelFor", () => {
  it("humanises the key, and keeps a title only when a human chose it", () => {
    expect(labelFor("normal_dirs", {})).toBe("Normal dirs");
    expect(labelFor("normal_dirs", { title: "Normal Dirs" })).toBe("Normal dirs");
    expect(labelFor("roi", { title: "Region of interest" })).toBe("Region of interest");
  });
});
