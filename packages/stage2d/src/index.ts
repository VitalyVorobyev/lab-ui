/**
 * `@vitavision/stage2d` — the image viewer: one view transform over a stack of layers, the measurement
 * overlay drawn into it, and the value planes behind a rendered image.
 */

export {
  ImageStage,
  useStage,
  type ImageStageProps,
  type StageContext,
  type StageHandle,
  type StageViewChange,
} from "./components/stage/ImageStage";

export type { StageMouseButton } from "./components/stage/gesture";

export {
  STAGE_HIT_PRIORITY,
  type HitCandidate,
  type HitId,
  type StageHit,
  type StageHitOptions,
} from "./components/stage/hitTest";
export type { StagePointerEvent } from "./components/stage/hitContext";
export {
  useStageHitLayer,
  useStageHitTest,
  type StageHitLayerOptions,
  type StageHitTestApi,
} from "./components/stage/useStageHitTest";

export { ImageLayer, type ImageLayerProps, type ImageTier } from "./components/stage/ImageLayer";

export {
  StageSurface,
  useStageDrag,
  type StageDrag,
  type StagePress,
  type StageSurfaceProps,
} from "./components/stage/StageSurface";

export {
  StageButton,
  StageLayersMenu,
  StageReadout,
  StageToolbar,
  StageToolbarDivider,
  type StageButtonProps,
  type StageLayer,
  type StageLayersMenuProps,
  type StageReadoutProps,
  type StageToolbarDividerProps,
  type StageToolbarProps,
} from "./components/stage/StageToolbar";

export {
  MAX_SCALE,
  MIN_SCALE_VS_FIT,
  PIXEL_CENTRE,
  clampToImage,
  clampView,
  fitScale,
  fitView,
  formatScale,
  frameRect,
  imageLengthFor,
  imageViewBox,
  initialView,
  insideImage,
  isFit,
  preserveCenter,
  scaleRange,
  steppedScale,
  toImage,
  toScreen,
  zoomAbout,
  type Box,
  type ClampOptions,
  type FitOptions,
  type Rect,
  type StageView,
} from "./components/stage/view";

export {
  FULL_TIER_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  RESET_VIEW,
  ZoomPanCanvas,
  contentUnder,
  nativeZoomFor,
  zoomAt,
  type View,
  type ZoomPanCanvasProps,
} from "./components/ZoomPanCanvas";

export {
  PlaneFormatError,
  decodePlane,
  fetchPlane,
  fractionOf,
  valueAt,
  valuesAt,
  type ValuePlane,
} from "./api/mapValues";

export {
  MeasureOverlay,
  type ArcPrimitive,
  type CaliperPrimitive,
  type CirclePrimitive,
  type DimensionPrimitive,
  type MeasureOverlayProps,
  type MeasurePrimitive,
  type PointPrimitive,
  type PolylinePrimitive,
  type PrimitiveCommon,
  type SegmentPrimitive,
  type SegmentsPrimitive,
} from "./components/MeasureOverlay";

export {
  OVERLAY_ROLES,
  OVERLAY_STATE_OPACITY,
  OVERLAY_STATE_WIDTH,
  overlayRole,
  type OverlayRole,
  type OverlayState,
} from "./components/overlayRole";
export { useScreenPx } from "./components/stage/useScreenPx";

export { ContourEditor, nearestContourSegment, type ContourEditorProps } from "./components/ContourEditor";
export { RectRoiEditor, type RectRoiEditorProps } from "./components/RectRoiEditor";
export {
  PolylineSet,
  type PolylineSelectMode,
  type PolylineSetItem,
  type PolylineSetProps,
} from "./components/PolylineSet";
export {
  buildPolylineIndex,
  nearestPolyline,
  polylineBounds,
  polylinePath,
  polylinesInRect,
  type Polyline,
  type PolylineHit,
  type PolylineId,
  type PolylineIndex,
} from "./components/polylineIndex";
export {
  PointSet,
  type PointSetItem,
  type PointSetProps,
} from "./components/PointSet";
export {
  buildPointIndex,
  buildPointIndexFrom,
  nearestPoint,
  pointsInRect,
  thinPoints,
  type PointHit,
  type PointId,
  type PointIndex,
  type PointIndexOptions,
  type PointItem,
} from "./components/pointIndex";
export {
  AreaSet,
  type AreaSetItem,
  type AreaSetProps,
} from "./components/AreaSet";
export {
  areaCentre,
  areaPath,
  areasInRect,
  buildAreaIndex,
  nearestArea,
  pointInPolygon,
  type Area,
  type AreaHit,
  type AreaId,
  type AreaIndex,
} from "./components/areaIndex";
export {
  EllipseSet,
  type EllipseSetItem,
  type EllipseSetProps,
} from "./components/EllipseSet";
export {
  buildEllipseIndex,
  ellipseBounds,
  ellipsePath,
  ellipsesInRect,
  nearestEllipse,
  pointInEllipse,
  type Ellipse,
  type EllipseHit,
  type EllipseId,
  type EllipseIndex,
} from "./components/ellipseIndex";
export {
  GridLayer,
  type GridEdgeStyle,
  type GridLayerProps,
  type GridNode,
} from "./components/GridLayer";
export { latticeEdges, type LatticeAxis, type LatticeEdge, type LatticeNode } from "./components/gridEdges";
export {
  HeatmapLayer,
  type HeatmapLayerBaseProps,
  type HeatmapLayerProps,
  type HeatmapPlaneProps,
  type HeatmapRgbaProps,
} from "./components/HeatmapLayer";
export { planeRange, rasterizePlane, type Colormap, type ValueRange } from "./components/heatmapRaster";
export { ShapeEditor, type ShapeEditorProps } from "./components/ShapeEditor";
export {
  fromShapeFrame,
  moveShape,
  normalizeAngle,
  resizeShape,
  rotateShape,
  rotationHandlePoint,
  sameShape,
  shapeCorner,
  shapeFromCorner,
  shapeHandleCursor,
  shapeHandlePoint,
  toShapeFrame,
  type RotatedShape,
} from "./components/shapeEdit";
export {
  DraftShape,
  MarqueeRect,
  type DraftShapeProps,
  type DraftShapeSpec,
  type MarqueeRectProps,
} from "./components/DraftShape";
export {
  translatePoints,
  useShapeDrag,
  type ShapeDragHandlers,
  type ShapeDragOptions,
} from "./components/useShapeDrag";
export { MARKER_SHAPES, circlePath, type BuiltinMarkerKind, type MarkerShape } from "./components/markerShapes";
export {
  ROI_HANDLES,
  ROI_HANDLE_CURSOR,
  clampRect,
  moveRect,
  rectFromCorners,
  resizeRect,
  roiHandlePoint,
  sameRect,
  type RoiHandle,
} from "./components/roiEdit";
export { MaskEditor, paintMask, type MaskEditorProps } from "./components/MaskEditor";

export {
  arcPath,
  arrowHeadPoints,
  caliperArrow,
  caliperCorners,
  crossSegments,
  dimensionGeometry,
  polygonPath,
  rotatePoint,
  segmentsPath,
  strokeWidthFor,
  type DimensionGeometry,
  type Point,
} from "./components/measureGeometry";
