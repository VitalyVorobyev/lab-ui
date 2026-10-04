/**
 * The decision threshold of a histogram: a dashed rule across the plot at one x.
 */

import type { PlotArea } from "./interaction";
import type { Scale } from "./scale";

/** A dashed vertical rule at `value`; nothing when it is missing or not finite. */
export function ThresholdRule({ value, xScale, area }: { value: number | undefined; xScale: Scale; area: PlotArea }) {
  if (value === undefined || !Number.isFinite(value)) return null;
  const x = xScale.project(value);
  return (
    <line
      data-threshold=""
      x1={x}
      x2={x}
      y1={area.y0}
      y2={area.y1}
      stroke="currentColor"
      strokeWidth={1.25}
      strokeDasharray="3 2"
    />
  );
}
