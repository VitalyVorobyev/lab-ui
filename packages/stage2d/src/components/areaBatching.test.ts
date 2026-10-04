import { describe, expect, it } from "vitest";

import { areaBatchKey, batchAreas, type AreaBatchOptions, type BatchableArea } from "./areaBatching";

const sq = (x: number): number[] => [x, 0, x + 1, 0, x + 1, 1, x, 1];
const OPTS: AreaBatchOptions = {
  role: "feature",
  stroke: undefined,
  paintOrder: "appearance",
  fillRule: "nonzero",
  selectionFill: "selection",
  selected: new Set(),
  isDimmed: () => false,
};
const run = (items: BatchableArea[], o: Partial<AreaBatchOptions> = {}) => batchAreas(items, { ...OPTS, ...o });

describe("areaBatchKey", () => {
  it("keeps the old key without a colour and appends colours with one", () => {
    expect(areaBatchKey(false, "feature", undefined, undefined)).toBe("0|feature");
    expect(areaBatchKey(true, "model", undefined, undefined)).toBe("1|model");
    expect(areaBatchKey(false, "feature", "#f00", undefined)).toBe("0|feature|#f00|");
    expect(areaBatchKey(false, "feature", "#f00", "#0f0")).toBe("0|feature|#f00|#0f0");
  });
});

describe("batchAreas", () => {
  const items: BatchableArea[] = [
    { id: 0, points: sq(0), stroke: "red" },
    { id: 1, points: sq(2), stroke: "blue" },
    { id: 2, points: sq(4), stroke: "red" },
    { id: 3, points: sq(6) },
  ];

  it("splits batches by colour, one batch per appearance", () => {
    const { normal } = run(items);
    expect(normal.map((b) => b.key)).toEqual(["0|feature|red|", "0|feature|blue|", "0|feature"]);
    expect(normal[0]!.indices).toEqual([0, 2]);
    expect(normal.every((b) => b.fills === null)).toBe(true);
  });

  it("applies the layer stroke to items that name none", () => {
    const { normal } = run(items, { stroke: "green" });
    expect(normal.map((b) => b.stroke)).toEqual(["red", "blue", "green"]);
  });

  it("yields consecutive runs in item order under paintOrder items", () => {
    const { normal } = run(items, { paintOrder: "items" });
    expect(normal.map((b) => b.id)).toEqual(["0|feature|red|#0", "0|feature|blue|#1", "0|feature|red|#2", "0|feature#3"]);
    expect(normal.map((b) => b.indices)).toEqual([[0], [1], [2], [3]]);
    const merged = run([items[0]!, { ...items[2]!, id: 9 }, items[1]!], { paintOrder: "items" });
    expect(merged.normal.map((b) => b.indices)).toEqual([[0, 1], [2]]);
  });

  it("gives every item its own fill path under evenodd, outlines still batched", () => {
    const { normal } = run(items, { fillRule: "evenodd" });
    expect(normal[0]!.fills).toHaveLength(2);
    expect(normal[0]!.d).toBe(normal[0]!.fills!.join(""));
  });

  it("moves selected items to the overlay, or keeps their fill under selectionFill item", () => {
    const selected = new Set([1]);
    const sel = run(items, { selected });
    expect(sel.picked!.indices).toEqual([1]);
    expect(sel.normal.map((b) => b.indices)).toEqual([[0, 2], [3]]);
    const keep = run(items, { selected, selectionFill: "item" });
    expect(keep.picked!.indices).toEqual([1]);
    expect(keep.picked!.fills).toBeNull();
    const blue = keep.normal.find((b) => b.stroke === "blue")!;
    expect(blue.indices).toEqual([1]);
    expect(blue.fills).toHaveLength(1);
    expect(blue.d).toBe("");
  });

  it("separates dimmed items", () => {
    const { normal } = run(items, { isDimmed: (id) => id === 3 });
    expect(normal.map((b) => b.key)).toContain("1|feature");
  });
});
