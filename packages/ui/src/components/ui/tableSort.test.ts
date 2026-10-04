import { describe, expect, it } from "vitest";

import { isSortable, nextSort, sortOrder, sortRows, type TableSort } from "./tableSort";

type Item = { name: string; value: number | string | null | undefined };

const byValue = { key: "value", sortValue: (item: Item) => item.value };
const byName = { key: "name", sortValue: (item: Item) => item.name };

function names(items: Item[]): string[] {
  return items.map((item) => item.name);
}

function item(name: string, value: Item["value"]): Item {
  return { name, value };
}

const asc = (key: string): TableSort => ({ key, direction: "ascending" });
const desc = (key: string): TableSort => ({ key, direction: "descending" });

describe("sortRows", () => {
  const numbers = [item("a", 3), item("b", -1), item("c", 10), item("d", 0)];

  it("orders numbers by value, both ways", () => {
    expect(names(sortRows(numbers, [byValue], asc("value")))).toEqual(["b", "d", "a", "c"]);
    expect(names(sortRows(numbers, [byValue], desc("value")))).toEqual(["c", "a", "d", "b"]);
  });

  it("compares numbers rather than subtracting them, so infinities sort and tie", () => {
    const rows = [item("+inf", Infinity), item("one", 1), item("-inf", -Infinity), item("+inf again", Infinity)];
    expect(names(sortRows(rows, [byValue], asc("value")))).toEqual(["-inf", "one", "+inf", "+inf again"]);
    expect(names(sortRows(rows, [byValue], desc("value")))).toEqual(["+inf", "+inf again", "one", "-inf"]);
  });

  it("puts null, undefined and NaN last in both directions, in their own order", () => {
    const rows = [item("none", null), item("two", 2), item("nan", NaN), item("one", 1), item("unset", undefined)];
    expect(names(sortRows(rows, [byValue], asc("value")))).toEqual(["one", "two", "none", "nan", "unset"]);
    expect(names(sortRows(rows, [byValue], desc("value")))).toEqual(["two", "one", "none", "nan", "unset"]);
  });

  it("reads digit runs in strings as numbers", () => {
    const rows = [item("frame 10", 0), item("frame 9", 0), item("frame 100", 0), item("frame 2", 0)];
    expect(names(sortRows(rows, [byName], asc("name")))).toEqual(["frame 2", "frame 9", "frame 10", "frame 100"]);
    expect(names(sortRows(rows, [byName], desc("name")))).toEqual(["frame 100", "frame 10", "frame 9", "frame 2"]);
  });

  it("puts every number before every string, and reverses that when descending", () => {
    const rows = [item("s", "b"), item("n", 2), item("t", "a"), item("m", 1)];
    expect(names(sortRows(rows, [byValue], asc("value")))).toEqual(["m", "n", "t", "s"]);
    expect(names(sortRows(rows, [byValue], desc("value")))).toEqual(["s", "t", "n", "m"]);
  });

  it("keeps equal rows in their own order in both directions", () => {
    const rows = [item("a", 1), item("b", 2), item("c", 1), item("d", 2)];
    expect(names(sortRows(rows, [byValue], asc("value")))).toEqual(["a", "c", "b", "d"]);
    expect(names(sortRows(rows, [byValue], desc("value")))).toEqual(["b", "d", "a", "c"]);
  });

  it("uses `compare` over `sortValue`, reversed for descending, ties in their own order", () => {
    // By the length of the name; the `sortValue` would order by value instead.
    const column = {
      key: "value",
      sortValue: (row: Item) => row.value,
      compare: (a: Item, b: Item) => a.name.length - b.name.length,
    };
    const rows = [item("ccc", 1), item("a", 2), item("bb", 3), item("dd", 4)];
    expect(names(sortRows(rows, [column], asc("value")))).toEqual(["a", "bb", "dd", "ccc"]);
    expect(names(sortRows(rows, [column], desc("value")))).toEqual(["ccc", "bb", "dd", "a"]);
  });

  it("calls `sortValue` once per row", () => {
    let calls = 0;
    const column = {
      key: "value",
      sortValue: (row: Item) => {
        calls += 1;
        return row.value;
      },
    };
    sortRows(numbers, [column], asc("value"));
    expect(calls).toBe(numbers.length);
  });

  it("leaves the order as given when there is nothing to sort by", () => {
    const given = names(numbers);
    expect(names(sortRows(numbers, [byValue], null))).toEqual(given);
    expect(names(sortRows(numbers, [byValue], undefined))).toEqual(given);
    // A key that names no column.
    expect(names(sortRows(numbers, [byValue], asc("missing")))).toEqual(given);
    // A column the reader may not sort by.
    expect(names(sortRows(numbers, [{ ...byValue, sortable: false }], asc("value")))).toEqual(given);
    // A column sortable by the app only, with nothing to compare by.
    expect(names(sortRows(numbers, [{ key: "value", sortable: true }], asc("value")))).toEqual(given);
  });

  it("returns a new array and leaves the rows alone", () => {
    const rows = [...numbers];
    const sorted = sortRows(rows, [byValue], asc("value"));
    expect(sorted).not.toBe(rows);
    expect(rows).toEqual(numbers);
    expect(sortRows(rows, [byValue], null)).not.toBe(rows);
  });

  it("finds the column by key among several", () => {
    const rows = [item("b", 1), item("a", 2)];
    expect(names(sortRows(rows, [byValue, byName], asc("name")))).toEqual(["a", "b"]);
    expect(names(sortRows(rows, [byValue, byName], asc("value")))).toEqual(["b", "a"]);
  });
});

describe("sortOrder", () => {
  it("is the display order as indices into the rows", () => {
    const rows = [item("a", 3), item("b", 1), item("c", 2)];
    expect(sortOrder(rows, [byValue], asc("value"))).toEqual([1, 2, 0]);
    expect(sortOrder(rows, [byValue], null)).toEqual([0, 1, 2]);
    expect(sortOrder([], [byValue], asc("value"))).toEqual([]);
  });
});

describe("isSortable", () => {
  it("defaults to whether the column says how to order", () => {
    expect(isSortable({})).toBe(false);
    expect(isSortable({ sortValue: () => 1 })).toBe(true);
    expect(isSortable({ compare: () => 0 })).toBe(true);
  });

  it("follows `sortable` when given", () => {
    expect(isSortable({ sortable: true })).toBe(true);
    expect(isSortable({ sortable: false, sortValue: () => 1 })).toBe(false);
  });
});

describe("nextSort", () => {
  it("goes first direction, the other, then none", () => {
    const column = { key: "x" };
    const first = nextSort(null, column);
    expect(first).toEqual(asc("x"));
    const second = nextSort(first, column);
    expect(second).toEqual(desc("x"));
    expect(nextSort(second, column)).toBeNull();
  });

  it("starts from `firstSort`", () => {
    const column = { key: "score", firstSort: "descending" as const };
    expect(nextSort(null, column)).toEqual(desc("score"));
    expect(nextSort(desc("score"), column)).toEqual(asc("score"));
    expect(nextSort(asc("score"), column)).toBeNull();
  });

  it("starts another column afresh, whatever the current sort's direction", () => {
    expect(nextSort(desc("x"), { key: "y" })).toEqual(asc("y"));
    expect(nextSort(asc("x"), { key: "y", firstSort: "descending" })).toEqual(desc("y"));
  });

  it("clears a sort set in the column's second direction", () => {
    // A `defaultSort` may start a column at the direction a click reaches second.
    expect(nextSort(desc("x"), { key: "x" })).toBeNull();
  });
});
