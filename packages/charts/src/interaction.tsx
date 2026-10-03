/**
 * What `LineChart` and `LineProfile` share beyond the frame:
 * - x ranges and positions marked on the plot (`bands`, `markers`);
 * - a pointer that reads the plot back (hover readout, click to pick);
 * - a cursor the app can drive from elsewhere, e.g. the canvas a profile was sampled on.
 */

import { useState } from "react";

import { toneColor, type MeasureTone } from "@vitavision/ui";

import type { Scale } from "./scale";

/** An x range marked on the plot: a gap, a stretch out of tolerance, a region of interest. */
export interface Band {
  /** Start of the range, in x domain units. */
  from: number;
  /** End of the range. */
  to: number;
  /** Its colour. Default `"muted"`. */
  tone?: MeasureTone | undefined;
  /** Text at the top of the band. */
  label?: string | undefined;
}

/** A position marked on the x axis with a short tick: a station, a sample, a frame. */
export interface Marker {
  /** Where, in x domain units. */
  position: number;
  /** Its colour. Default `"muted"`. */
  tone?: MeasureTone | undefined;
  /** Shown as the tick's tooltip (`<title>`). */
  label?: string | undefined;
}

/** A series as the readout sees it. */
export interface ReadoutSeries {
  /** Its name. */
  name: string;
  /** Its points. */
  points: readonly { x: number; y: number }[];
  /** Its colour. */
  colour: string;
}

/** The props `LineChart` and `LineProfile` share for interaction and marking. */
export interface InteractionProps {
  /** x ranges drawn behind the series. */
  bands?: readonly Band[] | undefined;
  /** Positions ticked on the x axis. */
  markers?: readonly Marker[] | undefined;
  /** An x position drawn as a vertical rule, from outside the chart (e.g. a canvas hover). */
  cursor?: number | null | undefined;
  /** Called with the x under the pointer (in domain units, clamped to the domain), or `null` on leaving. */
  onHover?: ((x: number | null) => void) | undefined;
  /** Called with the x under a click. Makes the plot area a pointer target. */
  onPick?: ((x: number) => void) | undefined;
}

/** Plot-area edges in viewBox units, as `areaFor` returns them (`y0` is the bottom). */
export interface PlotArea {
  /** Left edge. */
  x0: number;
  /** Right edge. */
  x1: number;
  /** Bottom edge. */
  y0: number;
  /** Top edge. */
  y1: number;
}

/** The ranges behind the series. */
export function Bands({ bands, xScale, area }: { bands: readonly Band[]; xScale: Scale; area: PlotArea }) {
  return (
    <g data-bands="">
      {bands.map((band) => {
        const a = clamp(xScale.project(Math.min(band.from, band.to)), area.x0, area.x1);
        const b = clamp(xScale.project(Math.max(band.from, band.to)), area.x0, area.x1);
        const colour = toneColor(band.tone, "muted");
        return (
          <g key={`${band.from}-${band.to}-${band.label ?? ""}`}>
            <rect x={a} y={area.y1} width={Math.max(1, b - a)} height={area.y0 - area.y1} fill={colour} opacity={0.14} />
            {band.label && (
              <text x={(a + b) / 2} y={area.y1 + 10} textAnchor="middle" fontSize={9} fill={colour}>
                {band.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The ticks on the x axis. */
export function Markers({ markers, xScale, area }: { markers: readonly Marker[]; xScale: Scale; area: PlotArea }) {
  return (
    <g data-markers="">
      {markers.map((marker) => {
        const x = xScale.project(marker.position);
        if (x < area.x0 - 0.5 || x > area.x1 + 0.5) return null;
        return (
          <line
            key={`${marker.position}-${marker.label ?? ""}`}
            x1={x}
            x2={x}
            y1={area.y0}
            y2={area.y0 - 6}
            stroke={toneColor(marker.tone, "muted")}
            strokeWidth={1.5}
          >
            {marker.label && <title>{marker.label}</title>}
          </line>
        );
      })}
    </g>
  );
}

/**
 * The pointer layer over the plot area: a crosshair and a value readout while hovering, the
 * external `cursor` otherwise, and clicks as picks.
 */
export function PlotInteraction({
  xScale,
  yScale,
  area,
  series,
  cursor,
  onHover,
  onPick,
  format = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : value.toPrecision(3)),
}: {
  xScale: Scale;
  yScale: Scale;
  area: PlotArea;
  series: readonly ReadoutSeries[];
  cursor?: number | null | undefined;
  onHover?: ((x: number | null) => void) | undefined;
  onPick?: ((x: number) => void) | undefined;
  format?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = onHover !== undefined || onPick !== undefined;

  const xAt = (event: { clientX: number; clientY: number; currentTarget: SVGRectElement }): number => {
    const svg = event.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    let local = event.clientX;
    if (svg && ctm) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      local = point.matrixTransform(ctm.inverse()).x;
    }
    const [low, high] = xScale.domain;
    return clamp(xScale.invert(local), Math.min(low, high), Math.max(low, high));
  };

  const shown = hover ?? cursor ?? null;
  const x = shown === null ? null : xScale.project(shown);
  const readout =
    hover === null
      ? []
      : series.flatMap((entry) => {
          const y = seriesValueAt(entry.points, hover);
          return y === null ? [] : [{ name: entry.name, colour: entry.colour, y }];
        });

  return (
    <g data-interaction="">
      {x !== null && x >= area.x0 - 0.5 && x <= area.x1 + 0.5 && (
        <line
          data-crosshair=""
          x1={x}
          x2={x}
          y1={area.y0}
          y2={area.y1}
          stroke="currentColor"
          strokeWidth={1}
          opacity={hover === null ? 0.6 : 0.9}
        />
      )}
      {readout.map((entry) => (
        <circle
          key={entry.name}
          cx={x ?? 0}
          cy={yScale.project(entry.y)}
          r={3}
          fill={entry.colour}
          stroke="var(--surface)"
          strokeWidth={1}
        />
      ))}
      {hover !== null && x !== null && (
        <text
          data-readout=""
          x={x > (area.x0 + area.x1) / 2 ? x - 6 : x + 6}
          y={area.y1 + 10}
          textAnchor={x > (area.x0 + area.x1) / 2 ? "end" : "start"}
          fontSize={10}
          fill="currentColor"
        >
          {[format(hover), ...readout.map((entry) => `${entry.name} ${format(entry.y)}`)].join(" · ")}
        </text>
      )}
      {interactive && (
        <rect
          data-plot-target=""
          x={area.x0}
          y={area.y1}
          width={area.x1 - area.x0}
          height={area.y0 - area.y1}
          fill="transparent"
          style={{ cursor: onPick ? "pointer" : "crosshair" }}
          onPointerMove={(event) => {
            const value = xAt(event);
            setHover(value);
            onHover?.(value);
          }}
          onPointerLeave={() => {
            setHover(null);
            onHover?.(null);
          }}
          onClick={(event) => onPick?.(xAt(event))}
        />
      )}
    </g>
  );
}

/**
 * A series' value at `x`, linearly interpolated between the points either side, or `null`
 * outside its range or across a gap.
 *
 * @param points - The series, in ascending `x`.
 * @param x - Where.
 * @returns The interpolated value, or `null`.
 */
export function seriesValueAt(points: readonly { x: number; y: number }[], x: number): number | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0]!.x === x ? points[0]!.y : null;
  let lo = 0;
  let hi = points.length - 1;
  if (x < points[lo]!.x || x > points[hi]!.x) return null;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.x <= x) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi]!;
  if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) return null;
  if (b.x === a.x) return a.y;
  return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
