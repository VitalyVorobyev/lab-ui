import { describe, expect, it } from "vitest";

import { fieldUiAt } from "./uiSchema";

describe("fieldUiAt", () => {
  it("says nothing by default", () => {
    expect(fieldUiAt(undefined, "a")).toEqual({});
    expect(fieldUiAt({}, "a")).toEqual({});
    expect(fieldUiAt({ fields: {} }, "a")).toEqual({});
  });

  it("finds an exact path", () => {
    expect(fieldUiAt({ fields: { "solver.max_iters": { label: "Iterations" } } }, "solver.max_iters")).toEqual({
      label: "Iterations",
    });
  });

  it("matches an array index with *", () => {
    const ui = { fields: { "cameras.*.id": { label: "Camera" } } };
    expect(fieldUiAt(ui, "cameras.3.id")).toEqual({ label: "Camera" });
    expect(fieldUiAt(ui, "cameras.id")).toEqual({});
  });

  it("merges an exact entry over the wildcard", () => {
    const ui = { fields: { "a.*": { label: "Any", unit: "px" }, "a.0": { label: "First" } } };
    expect(fieldUiAt(ui, "a.0")).toEqual({ label: "First", unit: "px" });
    expect(fieldUiAt(ui, "a.1")).toEqual({ label: "Any", unit: "px" });
  });
});
