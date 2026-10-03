/* eslint-disable storybook/default-exports -- not a story: the data the stories render. It is named `*.stories.*` so it ships in no package and counts for no coverage. */

/**
 * Synthetic detections for the stories and their tests: boards seen under a perspective, ring
 * grids with fitted ellipses, and a dense field of directed corners. Deterministic (no
 * randomness except a seeded generator), and shaped like what the detectors return, so the
 * stories exercise what an app will pass.
 */

import { edgeBitsFromPuzzleboard, type PuzzleboardAlignment, type PuzzleboardEdge } from "./puzzleboard";
import type { TargetCircle, TargetCorner, TargetDetection, TargetMarker, TargetRing } from "./model";

/** Image size of the board stories. */
export const BOARD_IMAGE = { width: 640, height: 440 } as const;

/** A board-plane position `(u, v)`, in cells, as seen in the image: a projective map, with its local axes. */
export interface Projected {
  x: number;
  y: number;
  /** Direction of the board's +u axis in the image, radians. */
  angleU: number;
  /** Direction of the board's +v axis in the image, radians. */
  angleV: number;
  /** The local 2×2 Jacobian `[[dx/du, dx/dv], [dy/du, dy/dv]]`, image pixels per cell. */
  jacobian: readonly [number, number, number, number];
}

/** The homography used by every board story: a board turned and tilted away from the camera. */
export function project(u: number, v: number): Projected {
  const at = (s: number, t: number) => {
    const w = 1 + 0.0095 * s + 0.0072 * t;
    return { x: (50 * s + 11 * t + 70) / w, y: (-6 * s + 52 * t + 66) / w };
  };
  const p = at(u, v);
  const h = 1e-4;
  const du = at(u + h, v);
  const dv = at(u, v + h);
  const jacobian = [(du.x - p.x) / h, (dv.x - p.x) / h, (du.y - p.y) / h, (dv.y - p.y) / h] as const;
  return {
    ...p,
    angleU: Math.atan2(jacobian[2], jacobian[0]),
    angleV: Math.atan2(jacobian[3], jacobian[1]),
    jacobian,
  };
}

/** The 9×6 inner corners of a chessboard, with lattice indices and the two edge directions. */
export function boardCorners(options: { cols?: number; rows?: number; directed?: boolean; offset?: [number, number] } = {}): TargetCorner[] {
  const { cols = 9, rows = 6, directed = false, offset = [1, 1] } = options;
  const corners: TargetCorner[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = project(i + offset[0], j + offset[1]);
      const corner: TargetCorner = { id: `c${i}-${j}`, x: p.x, y: p.y, i, j, score: 0.6 + 0.4 * ((i * 7 + j * 3) % 10) / 10 };
      if (directed) {
        corner.angle = p.angleU;
        corner.angle2 = p.angleV;
      }
      corners.push(corner);
    }
  }
  return corners;
}

/** A chessboard with every corner found except `missing` (`"i,j"` strings). */
export function chessboard(missing: readonly string[] = []): TargetDetection {
  return { kind: "chessboard", corners: boardCorners().filter((c) => !missing.includes(`${c.i},${c.j}`)) };
}

/** A ChArUco board: corners, and a marker in every other square, each rotated by its id. */
export function charuco(): TargetDetection {
  const markers: TargetMarker[] = [];
  let id = 0;
  for (let b = 0; b < 7; b++) {
    for (let a = 0; a < 10; a++) {
      if ((a + b) % 2 !== 0) continue;
      const quad = [
        project(a + 0.18, b + 0.18),
        project(a + 0.82, b + 0.18),
        project(a + 0.82, b + 0.82),
        project(a + 0.18, b + 0.82),
      ];
      // The detector reports the marker's own corner order: rotating it by `id` turns corner 0.
      const turn = id % 4;
      const ordered = [...quad.slice(turn), ...quad.slice(0, turn)];
      markers.push({ id, corners: ordered.flatMap((p) => [p.x, p.y]) });
      id++;
    }
  }
  return { kind: "charuco", corners: boardCorners(), markers };
}

/** A marker board: a chessboard with three circles in known cells, two white and one black. */
export function markerboard(): TargetDetection {
  const cells: { i: number; j: number; polarity: "white" | "black" }[] = [
    { i: 2, j: 1, polarity: "white" },
    { i: 5, j: 2, polarity: "black" },
    { i: 3, j: 4, polarity: "white" },
  ];
  const circles: TargetCircle[] = cells.map((cell, k) => {
    const p = project(cell.i + 1.5, cell.j + 1.5);
    return { id: `circle${k}`, x: p.x, y: p.y, polarity: cell.polarity, i: cell.i, j: cell.j };
  });
  return { kind: "markerboard", corners: boardCorners(), circles };
}

/** The alignment of the PuzzleBoard story: the local frame is turned a quarter and shifted, wrapping the period. */
export const PUZZLE_ALIGNMENT: PuzzleboardAlignment = { transform: { a: 0, b: 1, c: -1, d: 0 }, translation: [100, 3] };

/** A PuzzleBoard decode: corners labelled with master indices, and the observed edges with bits. */
export function puzzleboard(): TargetDetection {
  const cols = 9;
  const rows = 6;
  const { a, b, c, d } = PUZZLE_ALIGNMENT.transform;
  const [tx, ty] = PUZZLE_ALIGNMENT.translation;
  const wrap = (n: number) => ((n % 501) + 501) % 501;
  const corners: TargetCorner[] = [];
  for (let lj = 0; lj < rows; lj++) {
    for (let li = 0; li < cols; li++) {
      const p = project(li + 1, lj + 1);
      corners.push({ id: `p${li}-${lj}`, x: p.x, y: p.y, i: wrap(a * li + b * lj + tx), j: wrap(c * li + d * lj + ty) });
    }
  }
  const edges: PuzzleboardEdge[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hash = (col * 31 + row * 17 + col * row * 5) % 23;
      if (col + 1 < cols) edges.push({ row, col, orientation: "horizontal", bit: hash % 2 === 0 ? 1 : 0, confidence: 0.2 + 0.8 * (hash / 22) });
      if (row + 1 < rows) edges.push({ row, col, orientation: "vertical", bit: hash % 3 === 0 ? 1 : 0, confidence: 0.2 + 0.8 * (((hash * 7) % 23) / 22) });
    }
  }
  return { kind: "puzzleboard", corners, edgeBits: edgeBitsFromPuzzleboard(edges, corners, PUZZLE_ALIGNMENT) };
}

/** The ellipse a circle of `radius` cells at board position `(u, v)` projects to, from the local Jacobian. */
function circleAsEllipse(u: number, v: number, radius: number): { rx: number; ry: number; angle: number } {
  const [m00, m01, m10, m11] = project(u, v).jacobian;
  // Singular values of the 2×2 matrix J; the ellipse is the circle mapped by J, and its long axis lies along the left singular vector.
  const e = (m00 + m11) / 2;
  const f = (m00 - m11) / 2;
  const g = (m10 + m01) / 2;
  const h = (m10 - m01) / 2;
  const q = Math.hypot(e, h);
  const r = Math.hypot(f, g);
  const a1 = Math.atan2(g, f);
  const a2 = Math.atan2(h, e);
  return { rx: (q + r) * radius, ry: Math.abs(q - r) * radius, angle: (a2 + a1) / 2 };
}

/** A ring grid: 7×4 rings, each with an outer and an inner fitted ellipse. */
export function ringgrid(): TargetDetection {
  const rings: TargetRing[] = [];
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 7; i++) {
      const u = 1.2 + 1.35 * i + (j % 2 === 0 ? 0 : 0.675);
      const v = 1.2 + 1.35 * j;
      const p = project(u, v);
      const id = j * 7 + i;
      rings.push({
        id,
        x: p.x,
        y: p.y,
        outer: circleAsEllipse(u, v, 0.5),
        inner: circleAsEllipse(u, v, 0.28),
        label: id.toString(16).toUpperCase().padStart(2, "0"),
      });
    }
  }
  return { kind: "ringgrid", rings };
}

/** Image size of the dense story. */
export const FIELD_IMAGE = { width: 1600, height: 800 } as const;

/** mulberry32, so the field is the same on every run. */
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

/** `count` loose corners on a jittered grid, each with two edge directions that vary smoothly across the image. */
export function directedField(count = 5000): TargetDetection {
  const random = prng(7);
  const cols = Math.round(Math.sqrt(count * 2));
  const rows = Math.ceil(count / cols);
  const corners: TargetCorner[] = [];
  for (let k = 0; k < count; k++) {
    const x = ((k % cols) + 0.5 + (random() - 0.5) * 0.6) * (FIELD_IMAGE.width / cols);
    const y = (Math.floor(k / cols) + 0.5 + (random() - 0.5) * 0.6) * (FIELD_IMAGE.height / rows);
    const angle = 0.6 * Math.sin(x / 260) + 0.4 * Math.cos(y / 180);
    corners.push({ id: k, x, y, angle, angle2: angle + Math.PI / 2 + 0.25 * Math.sin(y / 90) });
  }
  return { kind: "corners", corners };
}
