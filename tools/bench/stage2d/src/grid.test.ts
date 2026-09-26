import { describe, expect, it } from "bun:test";

import { buildGrid, nearest } from "./grid";
import { prng } from "./scene";

/** The index must agree with a brute-force scan — it is the hit-test two candidates share. */
describe("grid index", () => {
  const rand = prng(1);
  const points = new Float32Array(4000);
  for (let i = 0; i < points.length; i++) points[i] = rand() * 1000;
  const grid = buildGrid(points, 1000, 1000, 37);

  function brute(x: number, y: number, r: number): number {
    let best = -1;
    let bestD = r * r;
    for (let i = 0; i < points.length / 2; i++) {
      const d = (points[2 * i]! - x) ** 2 + (points[2 * i + 1]! - y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  it("matches brute force", () => {
    for (let k = 0; k < 500; k++) {
      const x = rand() * 1100 - 50;
      const y = rand() * 1100 - 50;
      const r = rand() * 40;
      expect(nearest(grid, x, y, r)).toBe(brute(x, y, r));
    }
  });
});
