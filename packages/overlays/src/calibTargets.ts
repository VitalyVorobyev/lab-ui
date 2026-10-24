/**
 * calib-targets results to `TargetDetection`: the one mapping from what the
 * `@vitavision/calib-targets` WASM detectors return to what `TargetOverlay` draws.
 *
 * The input types below are the minimal structure the mapping reads, written to be satisfied by
 * the package's own result types (`ChessboardDetection`, `CharucoDetection`,
 * `MarkerBoardDetection`, `PuzzleBoardDetection`, `Corner`, and the `diagnose_*` payloads), so this
 * package takes no dependency on it. Every field the mapping does not read is ignored, and every
 * field a newer calib-targets adds is optional here, so results with and without it both fit.
 *
 * Pure: no React, no DOM.
 */

import type { TargetCircle, TargetCorner, TargetDetection, TargetKind, TargetMarker } from "./model";
import { edgeBitsFromPuzzleboard, type PuzzleboardEdge } from "./puzzleboard";

/** An image point `[x, y]`, pixels with the centre of pixel `i` at `i` (calib-targets' `Point2`). */
export type CalibTargetsPoint = readonly [x: number, y: number];

/** A position covariance, image pixels squared (calib-targets' `position_covariance`). */
export interface CalibTargetsCovariance {
  /** Variance along x. */
  xx: number;
  /** Covariance of x and y. */
  xy: number;
  /** Variance along y. */
  yy: number;
}

/** An integer lattice coordinate (calib-targets' `Coord`): `u` along the first board axis, `v` the second. */
export interface CalibTargetsCoord {
  /** First axis, rightwards on the board. */
  u: number;
  /** Second axis, downwards on the board. */
  v: number;
}

/** A labelled board corner: what `ChessboardCorner`, `CharucoCorner`, `MarkerBoardCorner` and `PuzzleBoardCorner` share. */
export interface CalibTargetsLabeledCorner {
  /** Sub-pixel image position. */
  position: CalibTargetsPoint;
  /** Lattice label; `null` for a corner with no place on the board. */
  grid: CalibTargetsCoord | null;
  /** The detector's score, higher is better. */
  score: number;
  /** Position covariance, when the detector reports one. */
  position_covariance?: CalibTargetsCovariance | null | undefined;
}

/** One axis estimate of a raw corner (calib-targets' `AxisEstimate`). */
export interface CalibTargetsAxis {
  /** Direction of the axis, radians in the image frame (clockwise on screen). */
  angle: number;
}

/** A raw ChESS corner, as `detect_corners` returns it (calib-targets' `Corner`). */
export interface CalibTargetsCorner {
  /** Sub-pixel image position. */
  position: CalibTargetsPoint;
  /** The two grid axes through the corner. */
  axes: readonly [CalibTargetsAxis, CalibTargetsAxis];
  /** Corner response, higher is stronger. */
  strength: number;
  /** Position covariance, when the detector reports one. */
  position_covariance?: CalibTargetsCovariance | null | undefined;
}

/** A chessboard detection (`ChessboardDetection`). */
export interface CalibTargetsChessboardDetection {
  /** The labelled corners. */
  corners: readonly CalibTargetsLabeledCorner[];
}

/** A decoded ArUco marker of a ChArUco detection (`MarkerDetection`). */
export interface CalibTargetsMarker {
  /** The marker's dictionary id. */
  id: number;
  /** Its four corners in the image, in the marker's own order; `null` when they were not projected. */
  corners_img: readonly [CalibTargetsPoint, CalibTargetsPoint, CalibTargetsPoint, CalibTargetsPoint] | null;
}

/** A ChArUco detection (`CharucoDetection`). */
export interface CalibTargetsCharucoDetection {
  /** The labelled corners. */
  corners: readonly CalibTargetsLabeledCorner[];
  /** The markers consistent with the board alignment. */
  markers: readonly CalibTargetsMarker[];
}

/** A checkerboard marker board detection (`MarkerBoardDetection`). */
export interface CalibTargetsMarkerBoardDetection {
  /** The labelled corners. */
  corners: readonly CalibTargetsLabeledCorner[];
}

/** A scored circle hypothesis of a marker board (`CircleCandidate`). */
export interface CalibTargetsCircleCandidate {
  /** Centre of the circle in the image. */
  center_img: CalibTargetsPoint;
}

/** A board circle paired with a detected one (`CircleMatch`). */
export interface CalibTargetsCircleMatch {
  /** The circle the board layout expects: its cell and printed polarity. */
  expected: { cell: { i: number; j: number }; polarity: "white" | "black" };
  /** Index into `circle_candidates` of the circle that matched it, or `null` for none. */
  matched_index: number | null;
}

/** The part of `diagnose_marker_board`'s `diagnostics` the overlay draws (`MarkerBoardDiagnostics`). */
export interface CalibTargetsMarkerBoardDiagnostics {
  /** The circle hypotheses. */
  circle_candidates: readonly CalibTargetsCircleCandidate[];
  /** The board's circles and the candidates they matched. */
  circle_matches: readonly CalibTargetsCircleMatch[];
}

/** A grid alignment (`GridAlignment`): `master = matrix · local + translation`. */
export interface CalibTargetsAlignment {
  /** Row-major integer matrix, applied to local `(u, v)` before the translation. */
  matrix: readonly [readonly [number, number], readonly [number, number]];
  /** Integer translation, grid units. */
  translation: readonly [number, number];
}

/** A PuzzleBoard detection (`PuzzleBoardDetection`); its corners carry master labels. */
export interface CalibTargetsPuzzleBoardDetection {
  /** The labelled corners, `grid` in the master frame. */
  corners: readonly CalibTargetsLabeledCorner[];
  /** The map from the decoder's local frame to the master frame. */
  alignment: CalibTargetsAlignment;
}

/** One observed edge bit, in the decoder's local frame (`PuzzleBoardObservedEdge`). */
export interface CalibTargetsObservedEdge {
  /** Row of the edge's first corner. */
  row: number;
  /** Column of the edge's first corner. */
  col: number;
  /** Which neighbour the edge runs to. */
  orientation: "horizontal" | "vertical";
  /** The observed bit, 0 or 1. */
  bit: number;
  /** Per-bit confidence, [0, 1]. */
  confidence: number;
}

/** The part of `diagnose_puzzleboard`'s `diagnostics` the overlay draws (`PuzzleBoardDiagnostics`). */
export interface CalibTargetsPuzzleBoardDiagnostics {
  /** Every sampled edge, before alignment. */
  observed_edges: readonly CalibTargetsObservedEdge[];
}

/** A PuzzlePole detection: a PuzzleBoard wrapped round a cylinder; `grid` is (axial, around). */
export interface CalibTargetsPuzzlePoleDetection {
  /** The labelled corners. */
  corners: readonly CalibTargetsLabeledCorner[];
}

/**
 * One calib-targets result, tagged with the detector that produced it.
 *
 * A board detector returns `null` (or, from `diagnose_*`, `undefined`) when it finds nothing;
 * pass that through as `detection` and the result is an empty detection of the same kind.
 * `diagnostics` is the `diagnostics` of the matching `diagnose_*` call: it carries what the plain
 * result does not (the marker-board circles, the PuzzleBoard edge bits). Convert a `diagnose_*`
 * payload to plain objects first if your binding returns `Map`s.
 */
export type CalibTargetsResult =
  | {
      /** Raw ChESS corners, from `detect_corners`. */
      kind: "corners";
      /** The corners. */
      corners: readonly CalibTargetsCorner[];
    }
  | {
      /** A chessboard, from `detect_chessboard`. */
      kind: "chessboard";
      /** The detection, or `null` when none was found. */
      detection: CalibTargetsChessboardDetection | null | undefined;
    }
  | {
      /** A ChArUco board, from `detect_charuco` or `diagnose_charuco`. */
      kind: "charuco";
      /** The detection, or `null` when none was found. */
      detection: CalibTargetsCharucoDetection | null | undefined;
    }
  | {
      /** A checkerboard marker board, from `detect_marker_board` or `diagnose_marker_board`. */
      kind: "markerboard";
      /** The detection, or `null` when none was found. */
      detection: CalibTargetsMarkerBoardDetection | null | undefined;
      /** `diagnose_marker_board`'s diagnostics, for the matched circles. */
      diagnostics?: CalibTargetsMarkerBoardDiagnostics | null | undefined;
    }
  | {
      /** A PuzzleBoard, from `detect_puzzleboard` or `diagnose_puzzleboard`. */
      kind: "puzzleboard";
      /** The detection, or `null` when none was found. */
      detection: CalibTargetsPuzzleBoardDetection | null | undefined;
      /** `diagnose_puzzleboard`'s diagnostics, for the edge bits. */
      diagnostics?: CalibTargetsPuzzleBoardDiagnostics | null | undefined;
    }
  | {
      /** A PuzzlePole. Drawn as a PuzzleBoard lattice, without edge bits. */
      kind: "puzzlepole";
      /** The detection, or `null` when none was found. */
      detection: CalibTargetsPuzzlePoleDetection | null | undefined;
    };

/** The overlay kind of each calib-targets result kind. */
const OVERLAY_KIND: Readonly<Record<CalibTargetsResult["kind"], TargetKind>> = {
  corners: "corners",
  chessboard: "chessboard",
  charuco: "charuco",
  markerboard: "markerboard",
  puzzleboard: "puzzleboard",
  puzzlepole: "puzzleboard",
};

/** A covariance as `TargetCorner.cov`, or `undefined` when there is none or it is not finite. */
function covOf(cov: CalibTargetsCovariance | null | undefined): TargetCorner["cov"] {
  if (!cov) return undefined;
  const { xx, xy, yy } = cov;
  return Number.isFinite(xx + xy + yy) ? [xx, xy, yy] : undefined;
}

/** A labelled corner as a `TargetCorner`, id `corner-<index>`; `(u, v)` becomes `(i, j)`. */
function labeledCorner(corner: CalibTargetsLabeledCorner, index: number): TargetCorner {
  const out: TargetCorner = { id: `corner-${index}`, x: corner.position[0], y: corner.position[1], score: corner.score };
  if (corner.grid) {
    out.i = corner.grid.u;
    out.j = corner.grid.v;
  }
  const cov = covOf(corner.position_covariance);
  if (cov) out.cov = cov;
  return out;
}

/** A raw corner as a `TargetCorner` with both axis directions, id `corner-<index>`, labelled with its index. */
function rawCorner(corner: CalibTargetsCorner, index: number): TargetCorner {
  const out: TargetCorner = {
    id: `corner-${index}`,
    x: corner.position[0],
    y: corner.position[1],
    score: corner.strength,
    angle: corner.axes[0].angle,
    angle2: corner.axes[1].angle,
    label: String(index),
  };
  const cov = covOf(corner.position_covariance);
  if (cov) out.cov = cov;
  return out;
}

/** The markers with a projected quad, id `marker-<index>`, labelled with the dictionary id. */
function markersOf(markers: readonly CalibTargetsMarker[]): TargetMarker[] {
  const out: TargetMarker[] = [];
  markers.forEach((marker, index) => {
    if (!marker.corners_img) return;
    out.push({ id: `marker-${index}`, corners: marker.corners_img.flatMap(([x, y]) => [x, y]), label: String(marker.id) });
  });
  return out;
}

/**
 * The matched circles of a marker board, id `circle-<index>` (index into `circle_matches`): at
 * the matched candidate's centre, with the board's cell and printed polarity. An unmatched board
 * circle is not drawn, nor is a candidate no board circle matched.
 */
function circlesOf(diagnostics: CalibTargetsMarkerBoardDiagnostics): TargetCircle[] {
  const out: TargetCircle[] = [];
  diagnostics.circle_matches.forEach((match, index) => {
    const candidate = match.matched_index === null ? undefined : diagnostics.circle_candidates[match.matched_index];
    if (!candidate) return;
    out.push({
      id: `circle-${index}`,
      x: candidate.center_img[0],
      y: candidate.center_img[1],
      polarity: match.expected.polarity,
      i: match.expected.cell.i,
      j: match.expected.cell.j,
    });
  });
  return out;
}

/** The observed edges as `edgeBitsFromPuzzleboard` takes them: a nonzero bit is 1. */
function edgesOf(edges: readonly CalibTargetsObservedEdge[]): PuzzleboardEdge[] {
  return edges.map((edge) => ({
    row: edge.row,
    col: edge.col,
    orientation: edge.orientation,
    bit: edge.bit === 0 ? 0 : 1,
    confidence: edge.confidence,
  }));
}

/**
 * The `TargetDetection` of a calib-targets result.
 *
 * - **Kinds.** `chessboard`, `charuco`, `markerboard`, `puzzleboard` and raw `corners` map to the
 *   overlay kind of the same name; a `puzzlepole` is drawn as a `puzzleboard` lattice.
 * - **Corners.** Positions pass through unchanged (calib-targets reports the centre of pixel `i`
 *   at `i`, as the overlay expects). A labelled corner's grid `(u, v)` becomes `(i, j)`, so a
 *   board draws its lattice and labels corners `i,j`. A raw corner draws its two axes (`angle`,
 *   `angle2`) and is labelled with its index; its `strength` is the `score`.
 * - **Covariance.** A corner's `position_covariance`, when present and finite, becomes `cov`;
 *   `TargetOverlay` draws it with `uncertainty`.
 * - **Markers** (ChArUco) are the quads of `corners_img`, labelled with the dictionary id; a
 *   marker without a projected quad is left out.
 * - **Circles** (marker board, from `diagnostics`) are the board circles a candidate matched,
 *   at the candidate's centre with the board's cell and polarity.
 * - **Edge bits** (PuzzleBoard, from `diagnostics`) are the observed edges placed through the
 *   alignment with `edgeBitsFromPuzzleboard`.
 *
 * Ids are `corner-<n>`, `marker-<n>` and `circle-<n>`, where `n` is the index into the result's
 * `corners`, `markers` or `circle_matches`, so a hover or a press maps straight back to it.
 *
 * @param result - The result, tagged with its kind.
 * @returns The detection for `TargetOverlay`. Parts with no items are left out.
 */
export function fromCalibTargets(result: CalibTargetsResult): TargetDetection {
  const detection: TargetDetection = { kind: OVERLAY_KIND[result.kind] };

  if (result.kind === "corners") {
    if (result.corners.length > 0) detection.corners = result.corners.map(rawCorner);
    return detection;
  }
  if (!result.detection) return detection;

  const corners = result.detection.corners.map(labeledCorner);
  if (corners.length > 0) detection.corners = corners;

  switch (result.kind) {
    case "charuco": {
      const markers = markersOf(result.detection.markers);
      if (markers.length > 0) detection.markers = markers;
      break;
    }
    case "markerboard": {
      const circles = result.diagnostics ? circlesOf(result.diagnostics) : [];
      if (circles.length > 0) detection.circles = circles;
      break;
    }
    case "puzzleboard": {
      if (!result.diagnostics) break;
      const { matrix, translation } = result.detection.alignment;
      const alignment = {
        transform: { a: matrix[0][0], b: matrix[0][1], c: matrix[1][0], d: matrix[1][1] },
        translation: [translation[0], translation[1]] as const,
      };
      const edgeBits = edgeBitsFromPuzzleboard(edgesOf(result.diagnostics.observed_edges), corners, alignment);
      if (edgeBits.length > 0) detection.edgeBits = edgeBits;
      break;
    }
    default:
      break;
  }
  return detection;
}
