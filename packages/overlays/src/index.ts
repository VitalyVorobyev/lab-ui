/**
 * `@vitavision/overlays` — calibration-target overlays on the `@vitavision/stage2d` stage.
 *
 * One component, `TargetOverlay`, draws a `TargetDetection` (a chessboard, ChArUco, marker
 * board, PuzzleBoard, ring grid or loose corners) through stage2d's batched layers, in the
 * overlay grammar's roles and glyphs. The input model, the lattice builders and the glyph path
 * generators are exported too, for an app that composes the layers itself. `fromCalibTargets`
 * maps a calib-targets result to the input model.
 */

export { TargetOverlay, type TargetOverlayProps } from "./TargetOverlay";

export { EllipseSet, ellipsePath, type EllipseSetItem, type EllipseSetProps } from "@vitavision/stage2d";

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

export { PUZZLEBOARD_PERIOD, edgeBitsFromPuzzleboard, type PuzzleboardAlignment, type PuzzleboardEdge } from "./puzzleboard";

export { TARGET_MARKERS } from "./glyphs";

export {
  circlePoints,
  cornerNodes,
  covarianceEllipse,
  edgeBitEllipses,
  markerAreas,
  ringCentres,
  ringEllipses,
  uncertaintyEllipses,
} from "./layerItems";

export {
  fromCalibTargets,
  type CalibTargetsAlignment,
  type CalibTargetsAxis,
  type CalibTargetsCharucoDetection,
  type CalibTargetsChessboardDetection,
  type CalibTargetsCircleCandidate,
  type CalibTargetsCircleMatch,
  type CalibTargetsCoord,
  type CalibTargetsCorner,
  type CalibTargetsCovariance,
  type CalibTargetsLabeledCorner,
  type CalibTargetsMarker,
  type CalibTargetsMarkerBoardDetection,
  type CalibTargetsMarkerBoardDiagnostics,
  type CalibTargetsObservedEdge,
  type CalibTargetsPoint,
  type CalibTargetsPuzzleBoardDetection,
  type CalibTargetsPuzzleBoardDiagnostics,
  type CalibTargetsPuzzlePoleDetection,
  type CalibTargetsResult,
} from "./calibTargets";
