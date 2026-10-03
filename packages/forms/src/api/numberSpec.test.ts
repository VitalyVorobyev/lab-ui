import { describe, expect, it } from "vitest";

import { checkNumber, numberSpec, rangeText } from "./numberSpec";

describe("numberSpec", () => {
  it("reads the schema's bounds, step and unit", () => {
    expect(numberSpec({ type: "number", minimum: 0, maximum: 1, multipleOf: 0.25, "x-unit": "mm" })).toEqual({
      integer: false,
      min: 0,
      max: 1,
      exclusiveMin: undefined,
      exclusiveMax: undefined,
      step: 0.25,
      unit: "mm",
    });
  });

  it("steps an integer by one and frees a float", () => {
    expect(numberSpec({ type: "integer" }).step).toBe(1);
    expect(numberSpec({ type: "number" }).step).toBe("any");
  });

  it("reads a uint format as 'at least 0'", () => {
    expect(numberSpec({ type: "integer", format: "uint32" }).min).toBe(0);
    expect(numberSpec({ type: "integer", format: "uint", minimum: 2 }).min).toBe(2);
    expect(numberSpec({ type: "integer", format: "int32" }).min).toBeUndefined();
  });

  it("lets the app's bounds replace the schema's, exclusive ones included", () => {
    const spec = numberSpec(
      { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 9, "x-unit": "px" },
      { min: 1, max: 5, step: 0.5, unit: "mm" },
    );
    expect(spec).toMatchObject({ min: 1, max: 5, step: 0.5, unit: "mm" });
    expect(spec.exclusiveMin).toBeUndefined();
    expect(spec.exclusiveMax).toBeUndefined();
  });
});

describe("checkNumber", () => {
  const integer = numberSpec({ type: "integer", minimum: 2, maximum: 10 });
  const open = numberSpec({ type: "number", exclusiveMinimum: 0, exclusiveMaximum: 1 });

  it("accepts what is inside", () => {
    expect(checkNumber(integer, 2)).toBeUndefined();
    expect(checkNumber(integer, 10)).toBeUndefined();
    expect(checkNumber(open, 0.5)).toBeUndefined();
  });

  it("rejects a fraction in an integer field, never rounding it", () => {
    expect(checkNumber(integer, 2.5)).toBe("Must be a whole number");
    expect(checkNumber(integer, 2.0)).toBeUndefined();
  });

  it("names the bound that was broken", () => {
    expect(checkNumber(integer, 1)).toBe("Must be ≥ 2");
    expect(checkNumber(integer, 11)).toBe("Must be ≤ 10");
    expect(checkNumber(open, 0)).toBe("Must be > 0");
    expect(checkNumber(open, 1)).toBe("Must be < 1");
    expect(checkNumber(open, Number.NaN)).toBe("Enter a number");
  });
});

describe("rangeText", () => {
  it("states the bounds as a reader sees them", () => {
    expect(rangeText(numberSpec({ type: "integer", minimum: 2, maximum: 64 }))).toBe("≥ 2, ≤ 64");
    expect(rangeText(numberSpec({ type: "number", exclusiveMinimum: 0, exclusiveMaximum: 1 }))).toBe("> 0, < 1");
    expect(rangeText(numberSpec({ type: "number" }))).toBeNull();
  });
});
