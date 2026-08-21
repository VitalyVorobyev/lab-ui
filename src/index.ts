/**
 * `@vitavision/lab-ui` — the shared instrument design system.
 *
 * Import components from here (or from their own module paths, which this barrel simply
 * re-exports); import `@vitavision/lab-ui/styles.css` once, at the consumer's own entry
 * point, alongside a Tailwind v4 `@source` pointed at this package's `dist` — see the
 * README for the exact wiring.
 */

// Tokens and theme.
export {
  DEFAULT_THEME_STORAGE_KEY,
  initTheme,
  readThemeChoice,
  resolveTheme,
  setThemeChoice,
  type ThemeChoice,
} from "./theme";

export { toneColor, type MeasureTone } from "./tone";
export { ThemeToggle } from "./components/ThemeToggle";

// The primitive set.
export * from "./components/ui";

// Layout and navigation.
export { Tabs, type TabItem } from "./components/Tabs";

// The schema-driven options form.
export { SchemaForm } from "./components/SchemaForm";
export {
  describeFields,
  initialValues,
  jsonErrors,
  missingRequired,
  outOfRange,
  overrideCount,
  toOptions,
  type ChoiceOption,
  type FieldKind,
  type FieldSpec,
  type OptionsSchema,
  type RawValues,
  type SchemaNode,
} from "./api/schemaForm";

// The image viewer: one transform over a stack of layers, laid out at the image's own size.
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
} from "./components/stage/StageToolbar";
export {
  MAX_SCALE,
  MIN_SCALE_VS_FIT,
  clampView,
  fitScale,
  fitView,
  formatScale,
  frameRect,
  imageLengthFor,
  initialView,
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

// The previous image viewer. Deprecated in favour of `ImageStage`; see its own doc comment.
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
} from "./components/ZoomPanCanvas";

// Value-plane decoding — the numbers behind a rendered image.
export {
  PlaneFormatError,
  decodePlane,
  fetchPlane,
  fractionOf,
  valueAt,
  valuesAt,
  type ValuePlane,
} from "./api/mapValues";

// Charts.
export {
  Frame,
  Legend,
  areaFor,
  plotArea,
  seriesColour,
  DEFECT_COLOUR,
  NORMAL_COLOUR,
  SERIES_COLOURS,
  type FrameProps,
  type Variant,
} from "./components/charts/Frame";
export {
  extent,
  formatTick,
  histogram,
  linePath,
  linearScale,
  logScale,
  niceStep,
  padDomain,
  type Scale,
  type Tick,
} from "./components/charts/scale";
export { LineChart, type LineChartProps, type Series } from "./components/charts/LineChart";
export { StackedBars, type BarRow } from "./components/charts/BarChart";
export { ScoreHistogram, type HistogramProps } from "./components/charts/Histogram";
export {
  LineProfile,
  type EdgeMark,
  type LineProfileProps,
  type ProfileSeries,
} from "./components/charts/LineProfile";

// The measurement overlay.
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
