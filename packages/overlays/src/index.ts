/**
 * `@vitavision/overlays` — calibration-target overlays on the `@vitavision/stage2d` stage.
 *
 * One component, `TargetOverlay`, draws a `TargetDetection` (a chessboard, ChArUco, marker
 * board, PuzzleBoard, ring grid or loose corners) through stage2d's batched layers, in the
 * overlay grammar's roles and glyphs. The input model, the lattice builders and the glyph path
 * generators are exported too, for an app that composes the layers itself.
 */

export { TargetOverlay, type TargetOverlayProps } from "./TargetOverlay";

export { EllipseSet, type EllipseSetItem, type EllipseSetProps } from "./EllipseSet";

export {
  TARGET_KINDS,
  isLatticeKind,
  type CirclePolarity,
  type TargetCircle,
  type TargetCorner,
  type TargetDetection,
  type TargetEdgeBit,
  type TargetEllipse,
  type TargetHit,
  type TargetId,
  type TargetKind,
  type TargetMarker,
  type TargetPart,
  type TargetRing,
} from "./model";

export {
  cornerGrid,
  gridEdges,
  gridKey,
  idByGrid,
  markerPolygons,
  type CornerGrid,
  type GridBounds,
  type GridCorner,
  type GridSegment,
  type MarkerPolygon,
} from "./lattice";

export {
  PUZZLEBOARD_PERIOD,
  edgeBitsFromPuzzleboard,
  type PuzzleboardAlignment,
  type PuzzleboardEdge,
} from "./puzzleboard";

export { TARGET_MARKERS, ellipsePath, packAxes, unpackAxes } from "./glyphs";

export {
  circlePoints,
  cornerNodes,
  edgeBitEllipses,
  markerAreas,
  ringCentres,
  ringEllipses,
} from "./layerItems";
