/**
 * A uniform-grid spatial index over the point markers: the hit-test the DOM and Canvas2D
 * candidates share. Konva is measured with its own hit canvas instead, because that is
 * what an app built on Konva gets.
 */

export interface GridIndex {
  cell: number;
  cols: number;
  rows: number;
  /** CSR layout: the points of cell `c` are `items[starts[c] .. starts[c + 1]]`. */
  starts: Uint32Array;
  items: Uint32Array;
  points: Float32Array;
}

export function buildGrid(points: Float32Array, width: number, height: number, cell = 64): GridIndex {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const count = points.length / 2;
  const cellOf = new Uint32Array(count);
  const starts = new Uint32Array(cols * rows + 1);
  for (let i = 0; i < count; i++) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(points[2 * i]! / cell)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(points[2 * i + 1]! / cell)));
    const c = cy * cols + cx;
    cellOf[i] = c;
    starts[c + 1]!++;
  }
  for (let c = 0; c < cols * rows; c++) starts[c + 1]! += starts[c]!;
  const fill = starts.slice(0, cols * rows);
  const items = new Uint32Array(count);
  for (let i = 0; i < count; i++) items[fill[cellOf[i]!]!++] = i;
  return { cell, cols, rows, starts, items, points };
}

/**
 * The nearest point to `(x, y)` within `radius` (all in image pixels), or `-1`.
 * Scans only the cells the search circle overlaps.
 */
export function nearest(grid: GridIndex, x: number, y: number, radius: number): number {
  const { cell, cols, rows, starts, items, points } = grid;
  const x0 = Math.max(0, Math.floor((x - radius) / cell));
  const x1 = Math.min(cols - 1, Math.floor((x + radius) / cell));
  const y0 = Math.max(0, Math.floor((y - radius) / cell));
  const y1 = Math.min(rows - 1, Math.floor((y + radius) / cell));
  let best = -1;
  let bestD = radius * radius;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const c = cy * cols + cx;
      for (let k = starts[c]!; k < starts[c + 1]!; k++) {
        const i = items[k]!;
        const dx = points[2 * i]! - x;
        const dy = points[2 * i + 1]! - y;
        const d = dx * dx + dy * dy;
        if (d <= bestD) {
          bestD = d;
          best = i;
        }
      }
    }
  }
  return best;
}
