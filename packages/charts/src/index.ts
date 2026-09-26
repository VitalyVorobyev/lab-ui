/**
 * `@vitavision/charts` — small SVG charts over one shared scale and frame.
 */

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
} from "./Frame";

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
} from "./scale";

export { LineChart, type LineChartProps, type Series } from "./LineChart";

export { StackedBars, type BarRow } from "./BarChart";

export { ScoreHistogram, type HistogramProps } from "./Histogram";

export {
  LineProfile,
  type EdgeMark,
  type LineProfileProps,
  type ProfileSeries,
} from "./LineProfile";
