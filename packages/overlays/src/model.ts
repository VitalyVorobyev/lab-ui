/**
 * The input model: one detection run, independent of the library that produced it.
 *
 * Every detector in the vitavision family (calib-targets' chessboard, ChArUco, marker board and
 * PuzzleBoard, ringgrid, chess-corners) returns its own result shape. An app maps that shape to a
 * `TargetDetection` once, and the overlay never learns which library ran. Nothing here imports a
 * detector package: these are plain data types.
 *
 * Conventions, the same as `@vitavision/stage2d`:
 * - Positions are **image pixels, with the centre of pixel `i` at coordinate `i`** (the frame
 *   the WASM detectors report, `image_px_center`). The stage places them; do not add 0.5.
 * - `y` points down. Angles are **radians, clockwise on screen** (from +x towards +y).
 * - Lengths named `rx`, `ry` and `radius` are image pixels, so they scale with the image.
 *
 * Pure: no React, no DOM.
 */

/** An item's identity. Ids are unique within one detection, across corners, markers, circles and rings. */
export type TargetId = string | number;

/** What a detection is of. It chooses defaults, not what is drawn: whatever is present is drawn. */
export type TargetKind =
  | "chessboard"
  | "charuco"
  | "markerboard"
  | "puzzleboard"
  | "ringgrid"
  | "corners"
  | "circles";

/** Every `TargetKind`. */
export const TARGET_KINDS: readonly TargetKind[] = [
  "chessboard",
  "charuco",
  "markerboard",
  "puzzleboard",
  "ringgrid",
  "corners",
  "circles",
];

/** The kinds whose corners form a lattice, so their neighbours are joined by edges. */
const LATTICE_KINDS: ReadonlySet<TargetKind> = new Set(["chessboard", "charuco", "markerboard", "puzzleboard"]);

/**
 * Whether a detection of this kind draws lattice edges between corner neighbours.
 *
 * @param kind - The detection's kind.
 * @returns `true` for the four calibration boards, `false` for loose corners, circles and rings.
 */
export function isLatticeKind(kind: TargetKind): boolean {
  return LATTICE_KINDS.has(kind);
}

/** One detected corner or X-junction. */
export interface TargetCorner {
  /** Its identity. Callbacks report this id back. */
  id: TargetId;
  /** Horizontal position, image pixels. */
  x: number;
  /** Vertical position, image pixels. */
  y: number;
  /** Lattice index along the first board axis, an integer. Absent for a corner with no place on a board. */
  i?: number | undefined;
  /** Lattice index along the second board axis, an integer. */
  j?: number | undefined;
  /**
   * The detector's confidence. It is carried for the app (a list, a filter) and never drawn as a
   * colour: a score is not a verdict.
   */
  score?: number | undefined;
  /** Orientation of the first edge through the corner, radians. Axes are lines, so `angle` and `angle + π` are the same. */
  angle?: number | undefined;
  /** Orientation of the second edge through the corner, radians. Needs `angle`. */
  angle2?: number | undefined;
  /** Text beside it. Defaults to the lattice index `i,j` on a board, else the id. */
  label?: string | undefined;
}

/** One decoded fiducial marker (ArUco, AprilTag): a quad. */
export interface TargetMarker {
  /** Its identity. For an ArUco marker, usually its dictionary id. */
  id: TargetId;
  /**
   * The quad's corners in the marker's own order, `[x0, y0, x1, y1, x2, y2, x3, y3]`. Corner 0 is
   * ticked, so the order reads as the marker's orientation.
   */
  corners: readonly number[];
  /** Text drawn inside it. Defaults to the id. */
  label?: string | undefined;
}

/** The printed colour of a circle in a marker board. */
export type CirclePolarity = "white" | "black";

/** One detected circle of a marker board, matched or not to the board model. */
export interface TargetCircle {
  /** Its identity. */
  id: TargetId;
  /** Centre x, image pixels. */
  x: number;
  /** Centre y, image pixels. */
  y: number;
  /** Printed polarity. It is drawn as a shape (hollow ring, or ring with a centre dot), not as a colour. */
  polarity: CirclePolarity;
  /** The board cell it matched, first axis. */
  i?: number | undefined;
  /** The board cell it matched, second axis. */
  j?: number | undefined;
  /** Text beside it. Defaults to `(i, j)` when both are set. */
  label?: string | undefined;
}

/** A fitted ellipse. */
export interface TargetEllipse {
  /** Semi-axis along the rotated x axis, image pixels. */
  rx: number;
  /** Semi-axis along the rotated y axis, image pixels. */
  ry: number;
  /** Rotation of the `rx` axis, radians clockwise on screen. */
  angle: number;
}

/** One ring marker of a ring grid: two concentric fitted ellipses and a centre. */
export interface TargetRing {
  /** Its identity. */
  id: TargetId;
  /** Centre x, image pixels. */
  x: number;
  /** Centre y, image pixels. */
  y: number;
  /** The outer edge of the ring. */
  outer: TargetEllipse;
  /** The inner edge of the ring, when the detector fitted one. */
  inner?: TargetEllipse | undefined;
  /** Text beside the centre. Defaults to the id. */
  label?: string | undefined;
}

/**
 * One decoded bit of a PuzzleBoard, drawn as a dot on the edge between two corners.
 * `edgeBitsFromPuzzleboard` builds these from a PuzzleBoard result.
 */
export interface TargetEdgeBit {
  /** Its identity. Not reported by callbacks: edge bits are not picked. */
  id: TargetId;
  /** Midpoint x of the edge, image pixels. */
  x: number;
  /** Midpoint y of the edge, image pixels. */
  y: number;
  /** The dot's radius, image pixels: about a quarter of the edge. */
  radius: number;
  /** The decoded bit. 1 is a solid dot, 0 a dashed one. */
  bit: 0 | 1;
  /** Decode confidence in [0, 1]. It sets the dot's opacity. */
  confidence: number;
}

/** One detection run: what a detector found in one image. */
export interface TargetDetection {
  /** What was detected. */
  kind: TargetKind;
  /** Corners and X-junctions. */
  corners?: readonly TargetCorner[] | undefined;
  /** Decoded fiducial markers. */
  markers?: readonly TargetMarker[] | undefined;
  /** Marker-board circles. */
  circles?: readonly TargetCircle[] | undefined;
  /** Ring markers. */
  rings?: readonly TargetRing[] | undefined;
  /** PuzzleBoard edge bits. */
  edgeBits?: readonly TargetEdgeBit[] | undefined;
}

/** The part of a detection an item belongs to. */
export type TargetPart = "corner" | "marker" | "circle" | "ring";

/** Which item the pointer is on. */
export interface TargetHit {
  /** The item's id, as given in the detection. */
  id: TargetId;
  /** The collection it came from. */
  part: TargetPart;
}
