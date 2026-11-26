import { describe, expect, it } from "vitest";

import { columnGroups } from "./tableGroups";

describe("columnGroups", () => {
  it("is null when no column has a group, so no header row is drawn", () => {
    expect(columnGroups([{}, { group: "" }, { group: undefined }])).toBeNull();
    expect(columnGroups([])).toBeNull();
  });

  it("spans adjacent columns that share a label", () => {
    expect(columnGroups([{ group: "Run A" }, { group: "Run A" }, { group: "Run B" }, { group: "Run B" }, { group: "Run B" }])).toEqual([
      { label: "Run A", span: 2, start: 0 },
      { label: "Run B", span: 3, start: 2 },
    ]);
  });

  it("gives ungrouped columns an empty cell, one for a run of them", () => {
    expect(columnGroups([{}, {}, { group: "Run" }, {}])).toEqual([
      { label: null, span: 2, start: 0 },
      { label: "Run", span: 1, start: 2 },
      { label: null, span: 1, start: 3 },
    ]);
  });

  it("makes the same label separated by another column two groups", () => {
    const cells = columnGroups([{ group: "A" }, { group: "B" }, { group: "A" }])!;
    expect(cells.map((c) => c.label)).toEqual(["A", "B", "A"]);
  });

  it("covers every column exactly once", () => {
    const columns = [{ group: "A" }, {}, { group: "A" }, { group: "A" }, {}, {}];
    expect(columnGroups(columns)!.reduce((n, c) => n + c.span, 0)).toBe(columns.length);
  });
});
