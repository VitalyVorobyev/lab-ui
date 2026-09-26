/**
 * `@vitavision/stage2d` — the image viewer: one view transform over a stack of layers, the measurement
 * overlay drawn into it, and the value planes behind a rendered image.
 */

export {
  ImageStage,
  useStage,
  type ImageStageProps,
  type StageContext,
} from "./components/stage/ImageStage";

export {
  StageButton,
  StageReadout,
  StageToolbar,
  StageToolbarDivider,
  type StageButtonProps,
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
  type SegmentPrimitive,
} from "./components/MeasureOverlay";

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
