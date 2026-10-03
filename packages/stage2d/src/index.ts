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
} from "./components/stage/ImageStage";

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
  strokeWidthFor,
  type DimensionGeometry,
  type Point,
} from "./components/measureGeometry";
