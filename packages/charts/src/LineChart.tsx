/**
 * Multi-series line chart — training curves, or any series plotted over a shared axis.
 *
 * A series with no points draws nothing but still claims its legend entry, so a term that
 * has not reported yet is visibly pending rather than silently absent. A series with one
 * point draws a dot: at the start of a run that is genuinely all there is, and an empty
 * chart would read as "nothing is happening".
 */

import type { ReactNode } from "react";

import { Frame, Legend, areaFor, seriesColour } from "./Frame";
import type { Variant } from "./Frame";
import type { Scale } from "./scale";
import { extent, linePath, linearScale, logScale } from "./scale";

/** One line of a {@link LineChart}. */
export interface Series {
  /** Legend text, and the React key — unique within one chart. */
  name: string;
  /**
   * Points in draw order. A non-finite coordinate lifts the pen rather than bridging the
   * gap; a single point draws a dot; no points draws nothing but keeps the legend entry.
   */
  points: { x: number; y: number }[];
  /** Any CSS colour. Omitted: {@link seriesColour} of the series' index. */
  colour?: string;
}

/** Props for {@link LineChart}. */
export interface LineChartProps {
  /** The lines, drawn in order — a later series paints over an earlier one. */
  series: Series[];
  /** Accessible name of the chart (the SVG's `aria-label`). Required. */
  label: string;
  /** x-axis title. */
  xLabel?: string;
  /** y-axis title. */
  yLabel?: string;
  /** Losses span decades; a linear axis flattens two of the three onto the floor. */
  logY?: boolean;
  /** Fixed domains, for charts whose axes are known — ROC and PR are both `[0, 1]`. */
  xDomain?: [number, number];
  /** Fixed y domain. Omitted: the extent of every series' `y`. */
  yDomain?: [number, number];
  /** Drawn behind the series, in plot pixels. A chance diagonal or a tolerance band uses this. */
  underlay?: (x: Scale, y: Scale) => ReactNode;
  /** Rendered under the legend, inside the `<figcaption>`. */
  footer?: ReactNode;
  /** Show the legend row. Default `true`. */
  showLegend?: boolean;
  /** Where the chart is going (see {@link Variant}). Default `"panel"`. */
  variant?: Variant;
  /** Extra classes for the outer `<figure>`, merged with `cn`. */
  className?: string | undefined;
}

/**
 * A multi-series line chart over a shared x axis — training curves, ROC and PR curves.
 *
 * @remarks
 * An SVG `role="img"` named by `label`, with the legend as real text under it. Series are
 * told apart by the legend's names, never by colour alone.
 */
export function LineChart({
  series,
  label,
  xLabel,
  yLabel,
  logY = false,
  xDomain,
  yDomain,
  underlay,
  footer,
  showLegend = true,
  variant = "panel",
  className,
}: LineChartProps) {
  const allX = series.flatMap((entry) => entry.points.map((point) => point.x));
  const allY = series.flatMap((entry) => entry.points.map((point) => point.y));
  const plotArea = areaFor(variant);

  const xScale = linearScale(xDomain ?? extent(allX), plotArea.x0, plotArea.x1);
  const makeY = logY ? logScale : linearScale;
  const yScale = makeY(yDomain ?? extent(allY), plotArea.y0, plotArea.y1);

  const coloured = series.map((entry, index) => ({
    ...entry,
    colour: entry.colour ?? seriesColour(index),
  }));

  return (
    <Frame
      xScale={xScale}
      yScale={yScale}
      xLabel={xLabel}
      yLabel={yLabel}
      label={label}
      variant={variant}
      className={className}
      footer={
        <div className="flex flex-col gap-1">
          {showLegend && (
            <Legend
              items={coloured.map((entry) => ({ label: entry.name, colour: entry.colour }))}
            />
          )}
          {footer}
        </div>
      }
    >
      {underlay?.(xScale, yScale)}
      {coloured.map((entry) =>
        entry.points.length === 1 ? (
          <circle
            key={entry.name}
            cx={xScale.project(entry.points[0]?.x ?? 0)}
            cy={yScale.project(entry.points[0]?.y ?? 0)}
            r={2.5}
            fill={entry.colour}
          />
        ) : (
          <path
            key={entry.name}
            d={linePath(entry.points, xScale, yScale)}
            fill="none"
            stroke={entry.colour}
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </Frame>
  );
}
