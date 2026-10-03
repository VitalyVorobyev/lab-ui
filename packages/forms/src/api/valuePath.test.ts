import { describe, expect, it } from "vitest";

import { getAtPath, joinPath, setAtPath, splitPath } from "./valuePath";

const VALUE = { a: { b: [{ c: 1 }, { c: 2 }], d: null }, e: "x", extra: { keep: true } };

describe("paths", () => {
  it("splits and joins", () => {
    expect(splitPath("")).toEqual([]);
    expect(splitPath("a.b.0")).toEqual(["a", "b", "0"]);
    expect(joinPath("", "a")).toBe("a");
    expect(joinPath("a.b", "0")).toBe("a.b.0");
  });
});

describe("getAtPath", () => {
  it("reads through objects and arrays", () => {
    expect(getAtPath(VALUE, "")).toBe(VALUE);
    expect(getAtPath(VALUE, "a.b.1.c")).toBe(2);
    expect(getAtPath(VALUE, "a.d")).toBeNull();
  });

  it("answers undefined where the path leaves the value", () => {
    expect(getAtPath(VALUE, "a.x.y")).toBeUndefined();
    expect(getAtPath(VALUE, "a.b.9")).toBeUndefined();
    expect(getAtPath(VALUE, "a.b.length")).toBeUndefined();
    expect(getAtPath(VALUE, "e.length")).toBeUndefined();
    expect(getAtPath(VALUE, "toString")).toBeUndefined();
    expect(getAtPath(undefined, "a")).toBeUndefined();
  });
});

describe("setAtPath", () => {
  it("replaces a leaf and shares everything else", () => {
    const next = setAtPath(VALUE, "a.b.0.c", 5) as typeof VALUE;
    expect(getAtPath(next, "a.b.0.c")).toBe(5);
    expect(next).not.toBe(VALUE);
    expect(next.a.b[1]).toBe(VALUE.a.b[1]);
    expect(next.extra).toBe(VALUE.extra);
  });

  it("never mutates its input", () => {
    const before = JSON.stringify(VALUE);
    setAtPath(VALUE, "a.b.0.c", 5);
    setAtPath(VALUE, "a.d", { x: 1 });
    setAtPath(VALUE, "e", undefined);
    expect(JSON.stringify(VALUE)).toBe(before);
  });

  it("keeps keys the path does not mention, including unknown ones", () => {
    expect(setAtPath(VALUE, "e", "y")).toEqual({ ...VALUE, e: "y" });
  });

  it("returns the input itself when nothing changes", () => {
    expect(setAtPath(VALUE, "e", "x")).toBe(VALUE);
    expect(setAtPath(VALUE, "a.b.0.c", 1)).toBe(VALUE);
    expect(setAtPath(VALUE, "missing", undefined)).toBe(VALUE);
    expect(setAtPath(VALUE, "a.b.9", undefined)).toBe(VALUE);
  });

  it("removes a key, or an array element, for undefined", () => {
    expect(setAtPath(VALUE, "e", undefined)).toEqual({ a: VALUE.a, extra: VALUE.extra });
    expect(setAtPath(VALUE, "a.b.0", undefined)).toEqual({ ...VALUE, a: { ...VALUE.a, b: [{ c: 2 }] } });
  });

  it("creates the containers on the way", () => {
    expect(setAtPath(undefined, "a.b", 1)).toEqual({ a: { b: 1 } });
    expect(setAtPath({}, "list.0", "x")).toEqual({ list: ["x"] });
    expect(setAtPath(null, "a", 1)).toEqual({ a: 1 });
    expect(setAtPath({ a: 5 }, "a.b", 1)).toEqual({ a: { b: 1 } });
  });

  it("replaces the root for the empty path", () => {
    expect(setAtPath(VALUE, "", 3)).toBe(3);
  });

  it("refuses a key on an array rather than corrupting it", () => {
    const list = [1, 2];
    expect(setAtPath(list, "name", 1)).toBe(list);
  });

  it("writes an own property called __proto__ without touching the prototype", () => {
    const next = setAtPath({}, "__proto__.polluted", true) as Record<string, unknown>;
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(Object.hasOwn(next, "__proto__")).toBe(true);
  });
});
