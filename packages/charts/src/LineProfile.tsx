/**
 * A 1-D profile chart — intensity or value against arc length along a scan line or a
 * caliper axis.
 *
 * Built on the same `Frame` and `scale.ts` every other chart here uses, so a profile reads
 * as part of the same visual system as a training curve or a score histogram rather than a
 * one-off. The one thing a profile chart needs that a loss curve does not is a way to mark
 * *where along x a decision landed* — a detected edge, a caliper's chosen crossing — as a
 * vertical rule with its own label, independent of the series being plotted.
 */

import type { ReactNode } from "react";

import { Frame, Legend, areaFor, seriesColour } from "./Frame";
import type { Variant } from "./Frame";
import { extent, linePath, linearScale } from "./scale";
import { toneColor, type MeasureTone } from "@vitavision/ui";

/** One sampled profile of a {@link LineProfile}. */
export interface ProfileSeries {
  /** Legend text, and the React key — unique within one chart. */
  name: string;
  /** `x` is arc length along the scan line or caliper axis, in pixels. */
  points: { x: number; y: number }[];
  /** Any CSS colour. Omitted: {@link seriesColour} of the series' index. */
  colour?: string;
}

/** A detected edge or chosen crossing, drawn as a dashed vertical rule. */
export interface EdgeMark {
  /** Position along the same arc-length axis as `ProfileSeries.points[].x`. */
  position: number;
  /** Text drawn above the rule, in the rule's colour. Omitted: no text. */
  label?: string;
  /** The rule's colour, as a `@vitavision/ui` measurement tone. Default `"signal"`. */
  tone?: MeasureTone;
}

/** Props for {@link LineProfile}. */
export interface LineProfileProps {
  /** The profiles, drawn in order. */
  series: ProfileSeries[];
  /** Detected edge positions, drawn as vertical rules over the series. */
  edges?: EdgeMark[];
  /** Accessible name of the chart (the SVG's `aria-label`). Required. */
  label: string;
  /** x-axis title. Default `"arc length (px)"`. */
  xLabel?: string;
  /** y-axis title. Default `"value"`. */
  yLabel?: string;
  /** Fixed x domain. Omitted: the extent of every point's `x` and every edge's position. */
  xDomain?: [number, number];
  /** Fixed y domain. Omitted: the extent of every point's `y`. */
  yDomain?: [number, number];
  /** Rendered under the legend, inside the `<figcaption>`. */
  footer?: ReactNode;
  /** Show the legend row when there is more than one series. Default `true`. */
  showLegend?: boolean;
  /** Where the chart is going (see {@link Variant}). Default `"wide"`. */
  variant?: Variant;
  /** Extra classes for the outer `<figure>`, merged with `cn`. */
  className?: string | undefined;
}

/**
 * One or more series against arc length along a scan line or caliper axis, with detected
 * edges as labelled vertical rules.
 *
 * @remarks
 * An SVG `role="img"` named by `label`. The legend appears only for two or more series — a
 * single profile is named by the chart's label.
 */
export function LineProfile({
  series,
  edges = [],
  label,
  xLabel = "arc length (px)",
  yLabel = "value",
  xDomain,
  yDomain,
  footer,
  showLegend = true,
  variant = "wide",
  className,
}: LineProfileProps) {
  const allX = [...series.flatMap((entry) => entry.points.map((point) => point.x)), ...edges.map((edge) => edge.position)];
  const allY = series.flatMap((entry) => entry.points.map((point) => point.y));
  const plotArea = areaFor(variant);

  const xScale = linearScale(xDomain ?? extent(allX), plotArea.x0, plotArea.x1);
  const yScale = linearScale(yDomain ?? extent(allY), plotArea.y0, plotArea.y1);

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
          {showLegend && series.length > 1 && (
            <Legend
              items={coloured.map((entry) => ({ label: entry.name, colour: entry.colour }))}
            />
          )}
          {footer}
        </div>
      }
    >
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

      {edges.map((edge) => {
        const x = xScale.project(edge.position);
        const colour = toneColor(edge.tone, "signal");
        return (
          <g key={`${edge.position}-${edge.label ?? ""}-${edge.tone ?? ""}`}>
            <line
              x1={x}
              x2={x}
              y1={plotArea.y0}
              y2={plotArea.y1}
              stroke={colour}
              strokeWidth={1.25}
              strokeDasharray="3 2"
            />
            {edge.label && (
              <text x={x} y={plotArea.y1 - 3} textAnchor="middle" fontSize={9} fill={colour}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
    </Frame>
  );
}
