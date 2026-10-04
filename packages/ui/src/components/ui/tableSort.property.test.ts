/**
 * Property tests for the table order: laws that must hold for any rows, not just the handful
 * of examples in `tableSort.test.ts`.
 *
 * Inputs come from a seeded PRNG, so a failure reproduces exactly; the failing input is in
 * the assertion message. No property-testing library: the laws are simple enough that
 * shrinking would not pay for a new dependency.
 */

import { describe, expect, it } from "vitest";

import { sortRows, type SortDirection } from "./tableSort";

const RUNS = 300;

/** mulberry32 — small, fast, and good enough to spread test inputs. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function forAll(seed: number, property: (random: () => number, run: number) => void) {
  const random = prng(seed);
  for (let run = 0; run < RUNS; run += 1) property(random, run);
}

/** A row: its position in the input, and the value it sorts by. */
type Row = { id: number; value: number | null | undefined };

/**
 * Up to 40 rows whose values come from a small pool, so ties are common, with a share of
 * missing values. Integers keep the expected order easy to state.
 */
function anyRows(random: () => number): Row[] {
  const length = Math.floor(random() * 41);
  const pool = 1 + Math.floor(random() * 8);
  return Array.from({ length }, (_, id) => {
    const roll = random();
    const value = roll < 0.1 ? null : roll < 0.15 ? undefined : Math.floor(random() * pool) - 3;
    return { id, value };
  });
}

function anyDirection(random: () => number): SortDirection {
  return random() < 0.5 ? "ascending" : "descending";
}

const columns = [{ key: "value", sortValue: (row: Row) => row.value }];

function sorted(rows: Row[], direction: SortDirection): Row[] {
  return sortRows(rows, columns, { key: "value", direction });
}

const present = (row: Row): row is Row & { value: number } => row.value !== null && row.value !== undefined;

describe("sortRows (properties)", () => {
  it("returns every row exactly once", () => {
    forAll(1, (random) => {
      const rows = anyRows(random);
      const out = sorted(rows, anyDirection(random));
      expect(out.map((row) => row.id).sort((a, b) => a - b), JSON.stringify(rows)).toEqual(rows.map((row) => row.id));
    });
  });

  it("puts the rows with a value first, in order, and the missing ones after", () => {
    forAll(2, (random) => {
      const rows = anyRows(random);
      const direction = anyDirection(random);
      const out = sorted(rows, direction);
      const count = rows.filter(present).length;
      const head = out.slice(0, count);
      expect(head.every(present), JSON.stringify(rows)).toBe(true);
      expect(out.slice(count).some(present), JSON.stringify(rows)).toBe(false);
      for (let i = 1; i < head.length; i += 1) {
        const step = (head[i]!.value as number) - (head[i - 1]!.value as number);
        expect(direction === "ascending" ? step : -step, `${direction} ${JSON.stringify(rows)}`).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("is stable: rows that tie (and the missing ones) keep their input order, both ways", () => {
    forAll(3, (random) => {
      const rows = anyRows(random);
      const direction = anyDirection(random);
      const out = sorted(rows, direction);
      for (let i = 1; i < out.length; i += 1) {
        const before = out[i - 1]!;
        const after = out[i]!;
        const tie = present(before) && present(after) ? before.value === after.value : !present(before) && !present(after);
        if (tie) expect(after.id, `${direction} ${JSON.stringify(rows)}`).toBeGreaterThan(before.id);
      }
    });
  });

  it("descending is ascending with its runs of equal values reversed, each run in input order", () => {
    forAll(4, (random) => {
      const rows = anyRows(random);
      const runs = (out: Row[]) => {
        const groups = new Map<number, number[]>();
        for (const row of out.filter(present)) groups.set(row.value, [...(groups.get(row.value) ?? []), row.id]);
        return [...groups.entries()];
      };
      const ascending = runs(sorted(rows, "ascending"));
      const descending = runs(sorted(rows, "descending"));
      expect(descending, JSON.stringify(rows)).toEqual([...ascending].reverse());
    });
  });

  it("is idempotent", () => {
    forAll(5, (random) => {
      const rows = anyRows(random);
      const direction = anyDirection(random);
      const once = sorted(rows, direction);
      expect(sorted(once, direction), JSON.stringify(rows)).toEqual(once);
    });
  });

  it("orders by `compare` as by the `sortValue` it agrees with", () => {
    forAll(6, (random) => {
      // `compare` sees no missing values: give every row one.
      const rows = anyRows(random).map((row) => ({ ...row, value: row.value ?? 0 }));
      const direction = anyDirection(random);
      const compare = [{ key: "value", compare: (a: Row, b: Row) => (a.value ?? 0) - (b.value ?? 0) }];
      expect(sortRows(rows, compare, { key: "value", direction }), JSON.stringify(rows)).toEqual(sorted(rows, direction));
    });
  });

  it("orders labels with a number in them by that number", () => {
    forAll(7, (random) => {
      const numbers = Array.from({ length: 1 + Math.floor(random() * 20) }, () => Math.floor(random() * 5000));
      const rows = numbers.map((n) => ({ label: `frame ${n}` }));
      const out = sortRows(rows, [{ key: "label", sortValue: (row: { label: string }) => row.label }], {
        key: "label",
        direction: "ascending",
      });
      expect(out.map((row) => row.label), JSON.stringify(numbers)).toEqual(
        [...numbers].sort((a, b) => a - b).map((n) => `frame ${n}`),
      );
    });
  });
});
