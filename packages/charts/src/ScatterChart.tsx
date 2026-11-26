/**
 * A scatter plot: points over two numeric axes, each optionally coloured by a third value.
 *
 * Points are drawn as a few batched paths (one per series, or one per colour step with
 * `colourBy`), never one element per point, and the pointer is resolved from the projected
 * positions, not from the DOM. A few thousand points stay cheap.
 */

import { useId, useMemo, useState, type ReactNode } from "react";

import { toneColor, type MeasureTone } from "@vitavision/ui";

import { ColormapLegend } from "./ColormapLegend";
import { colormapRgb, isDivergingColormap, type ColormapName } from "./colormap";
import { FLUID_DEFAULT_HEIGHT, Frame, Legend, areaFor, seriesColour, useFluidSize, type Variant } from "./Frame";
import { extent, linearScale, type Scale } from "./scale";
import { SCATTER_COLOUR_STEPS, colourDomain, colourStep, nearestProjected } from "./scatter";

/** One point of a {@link ScatterChart}. */
export interface ScatterPoint {
  /** Horizontal position, in x domain units. A non-finite value skips the point. */
  x: number;
  /** Vertical position, in y domain units. A non-finite value skips the point. */
  y: number;
  /** What `colourBy` colours it by. A point without one is drawn in the muted tone. */
  value?: number | undefined;
}

/** One group of points of a {@link ScatterChart}. */
export interface ScatterSeries {
  /** Legend text, and the React key — unique within one chart. */
  name: string;
  /** The points. Their index here is what hover and pick report. */
  points: readonly ScatterPoint[];
  /** Any CSS colour. Omitted: {@link seriesColour} of the series' index. Ignored with `colourBy`. */
  colour?: string | undefined;
}

/** Colour every point by its `value` through a map. */
export interface ScatterColourBy {
  /** The map. A diverging map centres on zero by default. */
  map: ColormapName;
  /** The values at the map's ends. Omitted: the extent of the points' values. */
  domain?: readonly [number, number] | undefined;
  /** Centre the domain on zero. Defaults to `true` for a diverging map, `false` otherwise. */
  symmetric?: boolean | undefined;
  /** What the colour encodes, written beside the scale. Required: a map is never shown unlabelled. */
  label: string;
  /** The values' unit, written after the scale's numbers. */
  unit?: string | undefined;
}

/** A rule across the plot at one x or y: a tolerance, a mean, an expected value. */
export interface ScatterReferenceLine {
  /** Which axis the value is on: `"y"` is a horizontal rule, `"x"` a vertical one. */
  axis: "x" | "y";
  /** Where, in that axis' domain units. A value outside the domain is not drawn. */
  value: number;
  /** Text at the rule's end. */
  label?: string | undefined;
  /** Its colour. Default `"muted"`. */
  tone?: MeasureTone | undefined;
}

/** A point of a {@link ScatterChart}, as hover and pick report it. */
export interface ScatterPick {
  /** The name of its series. */
  series: string;
  /** Its index in that series' `points`. */
  index: number;
  /** Its x. */
  x: number;
  /** Its y. */
  y: number;
  /** Its value, when it has one. */
  value?: number | undefined;
}

/** Props for {@link ScatterChart}. */
export interface ScatterChartProps {
  /** The groups of points, drawn in order — a later series paints over an earlier one. */
  series: readonly ScatterSeries[];
  /** Accessible name of the chart (the SVG's `aria-label`). Required. */
  label: string;
  /** x-axis title. */
  xLabel?: string | undefined;
  /** y-axis title. */
  yLabel?: string | undefined;
  /** Fixed x domain. Omitted: the extent of every series' `x`, with 4 % on each side. */
  xDomain?: [number, number] | undefined;
  /** Fixed y domain. Omitted: the extent of every series' `y`, with 4 % on each side. */
  yDomain?: [number, number] | undefined;
  /** Colour points by their `value`, with a legend of the scale in the footer. */
  colourBy?: ScatterColourBy | undefined;
  /** Rules across the plot, drawn behind the points. */
  referenceLines?: readonly ScatterReferenceLine[] | undefined;
  /** Marker diameter in CSS pixels at the chart's own scale. Default 4. */
  markerSize?: number | undefined;
  /** Drawn behind the points, in plot pixels. A tolerance region or a fitted curve uses this. */
  underlay?: ((x: Scale, y: Scale) => ReactNode) | undefined;
  /** The point to draw as highlighted, from outside the chart (a hovered table row). */
  highlighted?: { series: string; index: number } | null | undefined;
  /**
   * Called with the point nearest the pointer (within 10 plot units), or `null` when none is.
   * Draws a ring on it and a readout of its numbers.
   */
  onHover?: ((point: ScatterPick | null) => void) | undefined;
  /** Called with the point under a click. Makes the plot area a pointer target. */
  onPick?: ((point: ScatterPick) => void) | undefined;
  /** Rendered under the legend, inside the `<figcaption>`. */
  footer?: ReactNode;
  /** Show the series legend row (without `colourBy`). Default `true`. */
  showLegend?: boolean | undefined;
  /** Where the chart is going (see {@link Variant}). Default `"panel"`. */
  variant?: Variant | undefined;
  /** Extra classes for the outer `<figure>`, merged with `cn`. */
  className?: string | undefined;
  /** For `variant="fluid"`: the chart's height in CSS pixels. Default 200. */
  height?: number | undefined;
}

/** How near the pointer must be to a point, in viewBox units, to pick it. */
const PICK_RADIUS = 10;
const MUTED = "var(--fg-subtle)";

const formatValue = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : String(Number(value.toPrecision(3))));

/**
 * A scatter plot over a shared frame — residuals against position, one run against another.
 *
 * @remarks
 * An SVG `role="img"` named by `label`, with the series legend (or, with `colourBy`, the colour
 * scale) as real text under it. Series are told apart by the legend's names, never by colour
 * alone. `referenceLines` mark a value on either axis; `onHover` rings the nearest point and
 * reads its numbers, `onPick` reports a click's point, and `highlighted` rings one chosen
 * elsewhere. Picking is by pointer, so the same points must be reachable from a table beside
 * the chart. A point with a non-finite coordinate is skipped.
 */
export function ScatterChart({
  series,
  label,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  colourBy,
  referenceLines,
  markerSize = 4,
  underlay,
  highlighted,
  onHover,
  onPick,
  footer,
  showLegend = true,
  variant = "panel",
  className,
  height = FLUID_DEFAULT_HEIGHT,
}: ScatterChartProps) {
  const clipId = useId();
  const [fluidRef, fluidSize] = useFluidSize(height);
  const size = variant === "fluid" ? fluidSize : undefined;
  const area = areaFor(variant, size);

  const allX: number[] = [];
  const allY: number[] = [];
  for (const entry of series) {
    for (const p of entry.points) {
      allX.push(p.x);
      allY.push(p.y);
    }
  }
  const xScale = linearScale(xDomain ?? paddedExtent(allX), area.x0, area.x1);
  const yScale = linearScale(yDomain ?? paddedExtent(allY), area.y0, area.y1);

  const symmetric = colourBy ? (colourBy.symmetric ?? isDivergingColormap(colourBy.map)) : false;
  const domain = useMemo(
    () =>
      colourBy
        ? colourDomain(
            series.flatMap((s) => s.points.map((p) => p.value ?? Number.NaN)),
            symmetric,
            colourBy.domain,
          )
        : null,
    [series, colourBy, symmetric],
  );

  // Projected positions, once per data or geometry change: they are what drawing and picking read.
  const projected = useMemo(() => {
    const xy: number[] = [];
    const owner: { series: number; index: number }[] = [];
    series.forEach((entry, s) => {
      entry.points.forEach((p, index) => {
        const px = xScale.project(p.x);
        const py = yScale.project(p.y);
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(px) || !Number.isFinite(py)) return;
        xy.push(px, py);
        owner.push({ series: s, index });
      });
    });
    return { xy, owner };
    // The scales are rebuilt every render from their domains and the area; these are what they depend on.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [series, xScale.domain[0], xScale.domain[1], yScale.domain[0], yScale.domain[1], area.x0, area.x1, area.y0, area.y1]);

  // One batched path per (series, colour step).
  const batches = useMemo(() => {
    const out: { key: string; d: string; colour: string }[] = [];
    let cursor = 0;
    series.forEach((entry, s) => {
      const parts = new Map<number, string>();
      while (cursor < projected.owner.length && projected.owner[cursor]!.series === s) {
        const point = entry.points[projected.owner[cursor]!.index]!;
        const step = colourBy && domain ? colourStep(point.value ?? Number.NaN, domain) : 0;
        parts.set(step, `${parts.get(step) ?? ""}M${projected.xy[2 * cursor]!.toFixed(2)} ${projected.xy[2 * cursor + 1]!.toFixed(2)}h0`);
        cursor++;
      }
      for (const [step, d] of parts) {
        let colour: string;
        if (!colourBy) colour = entry.colour ?? seriesColour(s);
        else if (step < 0) colour = MUTED;
        else {
          const [r, g, b] = colormapRgb(colourBy.map, (step + 0.5) / SCATTER_COLOUR_STEPS);
          colour = `rgb(${r} ${g} ${b})`;
        }
        out.push({ key: `${s}|${step}`, d, colour });
      }
    });
    return out;
  }, [series, projected, colourBy, domain]);

  const [hover, setHover] = useState<ScatterPick | null>(null);
  const pickAt = (event: { clientX: number; clientY: number; currentTarget: SVGRectElement }): ScatterPick | null => {
    const svg = event.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    let x = event.clientX;
    let y = event.clientY;
    if (svg && ctm) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(ctm.inverse());
      x = local.x;
      y = local.y;
    }
    const found = nearestProjected(projected.xy, x, y, PICK_RADIUS);
    return found < 0 ? null : pointOf(found);
  };
  const pointOf = (k: number): ScatterPick => {
    const { series: s, index } = projected.owner[k]!;
    const entry = series[s]!;
    const point = entry.points[index]!;
    return { series: entry.name, index, x: point.x, y: point.y, value: point.value };
  };

  const ringed = hover ?? (highlighted ? findPick(series, highlighted) : null);
  const ringAt = ringed ? { cx: xScale.project(ringed.x), cy: yScale.project(ringed.y) } : null;
  const interactive = onHover !== undefined || onPick !== undefined;
  const radius = markerSize / 2;

  return (
    <Frame
      xScale={xScale}
      yScale={yScale}
      xLabel={xLabel}
      yLabel={yLabel}
      label={label}
      variant={variant}
      className={className}
      size={size}
      figureRef={variant === "fluid" ? fluidRef : undefined}
      footer={
        <div className="flex flex-col gap-1">
          {colourBy && domain ? (
            <ColormapLegend
              map={colourBy.map}
              domain={domain}
              label={colourBy.label}
              unit={colourBy.unit}
              symmetric={symmetric}
              format={formatValue}
            />
          ) : (
            showLegend && <Legend items={series.map((entry, s) => ({ label: entry.name, colour: entry.colour ?? seriesColour(s) }))} />
          )}
          {footer}
        </div>
      }
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={area.x0} y={area.y1} width={area.x1 - area.x0} height={area.y0 - area.y1} />
        </clipPath>
      </defs>
      {underlay?.(xScale, yScale)}
      {referenceLines && referenceLines.length > 0 && <ReferenceLines lines={referenceLines} xScale={xScale} yScale={yScale} area={area} />}
      <g clipPath={`url(#${clipId})`} data-points="" fill="none" strokeLinecap="round">
        {batches.map((batch) => (
          <path key={batch.key} d={batch.d} stroke="var(--surface)" strokeWidth={markerSize + 1.5} opacity={0.7} />
        ))}
        {batches.map((batch) => (
          <path key={`p|${batch.key}`} data-batch={batch.key} d={batch.d} stroke={batch.colour} strokeWidth={markerSize} />
        ))}
      </g>
      {ringAt && (
        <g data-highlight="" pointerEvents="none">
          <circle {...ringAt} r={radius + 3} fill="none" stroke="var(--surface)" strokeWidth={3.5} />
          <circle {...ringAt} r={radius + 3} fill="none" stroke="var(--signal)" strokeWidth={1.75} />
        </g>
      )}
      {hover && (
        <text
          data-readout=""
          x={xScale.project(hover.x) > (area.x0 + area.x1) / 2 ? area.x1 - 4 : area.x0 + 4}
          y={area.y1 + 10}
          textAnchor={xScale.project(hover.x) > (area.x0 + area.x1) / 2 ? "end" : "start"}
          fontSize={10}
          fill="currentColor"
        >
          {[`${formatValue(hover.x)}, ${formatValue(hover.y)}`, hover.value !== undefined ? formatValue(hover.value) : null]
            .filter((part) => part !== null)
            .join(" · ")}
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
            const next = pickAt(event);
            setHover(next);
            onHover?.(next);
          }}
          onPointerLeave={() => {
            setHover(null);
            onHover?.(null);
          }}
          onClick={(event) => {
            const picked = pickAt(event);
            if (picked) onPick?.(picked);
          }}
        />
      )}
    </Frame>
  );
}

/** The extent of the values with 4 % on each side, so a marker on an extreme is not cut by the axis or the frame. */
function paddedExtent(values: readonly number[]): [number, number] {
  const [low, high] = extent(values);
  const pad = (high - low) * 0.04;
  return [low - pad, high + pad];
}

/** The point a `highlighted` names, or `null` when it names none that exists and is finite. */
function findPick(series: readonly ScatterSeries[], at: { series: string; index: number }): ScatterPick | null {
  const entry = series.find((s) => s.name === at.series);
  const point = entry?.points[at.index];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { series: at.series, index: at.index, x: point.x, y: point.y, value: point.value };
}

/** Dashed rules across the plot, with their labels at the end. */
function ReferenceLines({
  lines,
  xScale,
  yScale,
  area,
}: {
  lines: readonly ScatterReferenceLine[];
  xScale: Scale;
  yScale: Scale;
  area: { x0: number; x1: number; y0: number; y1: number };
}) {
  return (
    <g data-reference-lines="">
      {lines.map((line) => {
        const horizontal = line.axis === "y";
        const scale = horizontal ? yScale : xScale;
        const at = scale.project(line.value);
        const [lo, hi] = horizontal ? [area.y1, area.y0] : [area.x0, area.x1];
        if (!Number.isFinite(at) || at < Math.min(lo, hi) - 0.5 || at > Math.max(lo, hi) + 0.5) return null;
        const colour = toneColor(line.tone, "muted");
        return (
          <g key={`${line.axis}|${line.value}|${line.label ?? ""}`} data-reference-line={line.axis}>
            <line
              x1={horizontal ? area.x0 : at}
              x2={horizontal ? area.x1 : at}
              y1={horizontal ? at : area.y0}
              y2={horizontal ? at : area.y1}
              stroke={colour}
              strokeWidth={1.25}
              strokeDasharray="3 2"
            />
            {line.label && (
              <text
                x={horizontal ? area.x1 - 3 : at + 3}
                y={horizontal ? at - 3 : area.y1 + 10}
                textAnchor={horizontal ? "end" : "start"}
                fontSize={9}
                fill={colour}
              >
                {line.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
