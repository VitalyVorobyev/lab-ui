/**
 * `@vitavision/lab-ui` — **deprecated**: the 0.x single package, kept as a re-export of the
 * packages it was split into so its consumers can migrate one import at a time.
 *
 * | Was                          | Now                     |
 * |------------------------------|-------------------------|
 * | tokens, theme, primitives    | `@vitavision/ui`        |
 * | `SchemaForm`, schema helpers | `@vitavision/forms`     |
 * | charts, scales               | `@vitavision/charts`    |
 * | `ImageStage`, measure, planes| `@vitavision/stage2d`   |
 *
 * The exported surface is identical to 0.5; see the README for the migration.
 */

export * from "@vitavision/ui";
export * from "@vitavision/forms";
export * from "@vitavision/charts";
// Keep this deprecated entry point fixed at its published 0.5 surface. New
// stage2d features are available from @vitavision/stage2d directly.
export {
  ImageStage, useStage, StageButton, StageReadout, StageToolbar,
  StageToolbarDivider, MAX_SCALE, MIN_SCALE_VS_FIT, PIXEL_CENTRE,
  clampView, fitScale, fitView, formatScale, frameRect, imageLengthFor,
  imageViewBox, initialView, insideImage, isFit, preserveCenter,
  scaleRange, steppedScale, toImage, toScreen, zoomAbout, FULL_TIER_ZOOM,
  MAX_ZOOM, MIN_ZOOM, RESET_VIEW, ZoomPanCanvas, contentUnder,
  nativeZoomFor, zoomAt, PlaneFormatError, decodePlane, fetchPlane,
  fractionOf, valueAt, valuesAt, MeasureOverlay, arcPath,
  arrowHeadPoints, caliperArrow, caliperCorners, crossSegments,
  dimensionGeometry, polygonPath, rotatePoint, strokeWidthFor,
} from "@vitavision/stage2d";
export type {
  ImageStageProps, StageContext, StageButtonProps, StageReadoutProps,
  StageToolbarDividerProps, StageToolbarProps, Box, ClampOptions, Rect,
  StageView, View, ZoomPanCanvasProps, ValuePlane, ArcPrimitive,
  CaliperPrimitive, CirclePrimitive, DimensionPrimitive,
  MeasureOverlayProps, MeasurePrimitive, PointPrimitive, SegmentPrimitive,
  DimensionGeometry, Point,
} from "@vitavision/stage2d";
