/**
 * The plot frame every chart here composes: axes, ticks, grid, labels.
 *
 * Charts are drawn into a fixed `viewBox` and scaled by CSS, so one component works at
 * any panel width without measuring the DOM. The consequence is that font sizes are in
 * viewBox units and therefore scale with the chart: the *same* 10-unit label renders at
 * 9 px in a half-width panel and at 21 px across a full-width one, which looks like two
 * different design systems on one screen.
 *
 * So the viewBox is chosen to roughly match the width the chart will actually be given.
 * `panel` is for the two-column grids, `wide` for a chart that spans a panel on its own.
 * That keeps the scale factor near 1 in both, and it is why callers pick a variant rather
 * than a pixel width — the variant says where the chart is going, not how big to draw it.
 */

import type { ReactNode } from "react";

import { cn } from "@vitavision/ui";

import type { Scale } from "./scale";

/**
 * Where a chart is going: `panel` (a 480×280 viewBox) for one column of a two-column grid,
 * `wide` (960×320) for a chart that spans a panel on its own.
 *
 * @remarks
 * Pick it by placement, not by pixel width — it keeps the chart's text at the same rendered
 * size as its neighbours'.
 */
export type Variant = "panel" | "wide";

const GEOMETRY = {
  panel: { width: 480, height: 280 },
  wide: { width: 960, height: 320 },
} as const;

const MARGIN = { left: 56, right: 12, top: 12, bottom: 34 } as const;

/**
 * The drawable rectangle for one variant, in that variant's viewBox units.
 *
 * @param variant - Which viewBox the chart is drawn in.
 * @returns The plot area's edges — `x0`/`x1` left to right, `y0` the bottom and `y1` the top
 *   (SVG y grows downwards) — and the whole viewBox's `width`/`height`. Build scales over
 *   `[x0, x1]` and `[y0, y1]`.
 */
export function areaFor(variant: Variant) {
  const { width, height } = GEOMETRY[variant];
  return {
    x0: MARGIN.left,
    x1: width - MARGIN.right,
    y0: height - MARGIN.bottom,
    y1: MARGIN.top,
    width,
    height,
  };
}

/** The default geometry, for callers that do not care which variant they are in. */
export const plotArea = areaFor("panel");

/** Held at the two ends of the neutral ramp, matching the design system's chrome colours. */
const AXIS = "currentColor";

/** Props for {@link Frame}. */
export interface FrameProps {
  /** The horizontal scale, built over this variant's `x0`…`x1` (see {@link areaFor}). */
  xScale: Scale;
  /** The vertical scale, built over this variant's `y0`…`y1` (see {@link areaFor}). */
  yScale: Scale;
  /** Axis title under the x axis. Omitted: no title. */
  xLabel?: string | undefined;
  /** Axis title beside the y axis, rotated. Omitted: no title. */
  yLabel?: string | undefined;
  /** Rough number of x ticks to ask the scale for. Default 5. */
  xTicks?: number;
  /** Rough number of y ticks to ask the scale for. Default 4. */
  yTicks?: number;
  /** Drawn inside the plot area, above the grid and below nothing. */
  children?: ReactNode;
  /** Accessible name — every chart must have one; it is what the tests query on. */
  label: string;
  /** Rendered under the plot: a legend, a caption, a truncation note. */
  footer?: ReactNode;
  /** Where this chart is going, so its text renders at the same size as its neighbours. */
  variant?: Variant;
  /** Extra classes for the outer `<figure>`, merged with `cn`. */
  className?: string | undefined;
}

/**
 * The plot shell every chart here composes: grid, ticks, axes, axis titles, a footer.
 *
 * @remarks
 * Renders a `<figure>` holding an SVG with `role="img"` named by `label`, and the `footer`
 * as its `<figcaption>`. `children` are drawn in viewBox units over the grid.
 */
export function Frame({
  xScale,
  yScale,
  xLabel,
  yLabel,
  xTicks = 5,
  yTicks = 4,
  children,
  label,
  footer,
  variant = "panel",
  className,
}: FrameProps) {
  const horizontal = xScale.ticks(xTicks);
  const vertical = yScale.ticks(yTicks);
  const plotArea = areaFor(variant);
  const PLOT = GEOMETRY[variant];

  return (
    <figure className={cn("flex flex-col gap-1 text-fg-muted", className)}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
        className="w-full"
      >
        {vertical.map((tick) => {
          const y = yScale.project(tick.value);
          return (
            <g key={`y-${tick.value}`}>
              <line
                x1={plotArea.x0}
                x2={plotArea.x1}
                y1={y}
                y2={y}
                stroke={AXIS}
                strokeWidth={0.5}
                opacity={0.25}
              />
              <text x={plotArea.x0 - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill={AXIS}>
                {tick.label}
              </text>
            </g>
          );
        })}

        {horizontal.map((tick) => {
          const x = xScale.project(tick.value);
          return (
            <g key={`x-${tick.value}`}>
              <line
                x1={x}
                x2={x}
                y1={plotArea.y0}
                y2={plotArea.y1}
                stroke={AXIS}
                strokeWidth={0.5}
                opacity={0.15}
              />
              <text x={x} y={plotArea.y0 + 14} textAnchor="middle" fontSize={10} fill={AXIS}>
                {tick.label}
              </text>
            </g>
          );
        })}

        <line
          x1={plotArea.x0}
          x2={plotArea.x1}
          y1={plotArea.y0}
          y2={plotArea.y0}
          stroke={AXIS}
          strokeWidth={1}
          opacity={0.6}
        />
        <line
          x1={plotArea.x0}
          x2={plotArea.x0}
          y1={plotArea.y0}
          y2={plotArea.y1}
          stroke={AXIS}
          strokeWidth={1}
          opacity={0.6}
        />

        {children}

        {xLabel && (
          <text
            x={(plotArea.x0 + plotArea.x1) / 2}
            y={PLOT.height - 2}
            textAnchor="middle"
            fontSize={10}
            fill={AXIS}
          >
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text
            transform={`translate(10 ${(plotArea.y0 + plotArea.y1) / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill={AXIS}
          >
            {yLabel}
          </text>
        )}
      </svg>
      {footer && <figcaption className="text-xs">{footer}</figcaption>}
    </figure>
  );
}


/** One entry of a {@link Legend}. */
export interface LegendItem {
  /** The series name, rendered as text — it is what a screen reader announces. */
  label: string;
  /** Any CSS colour: a `var(--series-n)` from {@link seriesColour}, or a verdict token. */
  colour: string;
}

/** Props for {@link Legend}. */
export interface LegendProps {
  /** Entries, in the order the series were drawn. */
  items: LegendItem[];
  /** Extra classes for the `<ul>`, merged with `cn`. */
  className?: string | undefined;
}

/**
 * A legend row. Kept beside the frame rather than inside the SVG so the swatches are real
 * text and CSS rather than a second typography in viewBox units.
 *
 * @remarks
 * The swatches are `aria-hidden`; each series is identified by its name, never by colour
 * alone.
 */
export function Legend({ items, className }: LegendProps) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded"
            style={{ backgroundColor: item.colour }}
          />
          <span className="font-mono text-xs">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The shared categorical series palette, as CSS paint values: `var(--series-1)` …
 * `var(--series-6)`.
 *
 * @remarks
 * The colours themselves are tokens in `@vitavision/charts/styles.css`, defined for both
 * themes, so that stylesheet must be imported after `@vitavision/ui/styles.css`. The chrome
 * carries no saturation, which makes this the one place a chart is allowed to be loud.
 *
 * Each slot keeps its hue family across the themes — cyan, orange, violet, blue, pink, then
 * a neutral grey as the sixth — and only its lightness changes, so every colour holds 3:1
 * against the panel in both. The six stay distinguishable under simulated protanopia,
 * deuteranopia and tritanopia, and none of them is a verdict colour (`--normal`,
 * `--defect`, `--warn`): a series is never read as a verdict (PLAN §5).
 *
 * Before 0.6 these were fixed hex strings; the names are unchanged.
 */
export const SERIES_COLOURS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
] as const;

/**
 * The paint for outcomes judged normal — `var(--normal)`, the design system's verdict token.
 *
 * @remarks
 * Exported so a histogram and any caught/missed bars share one green rather than each
 * restating it: a green that means "normal" has to be one green. Before 0.6 this was a
 * fixed hex string.
 */
export const NORMAL_COLOUR = "var(--normal)";

/**
 * The paint for outcomes judged defective — `var(--defect)`, the design system's verdict
 * token.
 *
 * @remarks
 * The partner of {@link NORMAL_COLOUR}. Before 0.6 this was a fixed hex string.
 */
export const DEFECT_COLOUR = "var(--defect)";

/**
 * The series colour for the `index`-th series, cycling through {@link SERIES_COLOURS}.
 *
 * @param index - Zero-based series index. Negative or non-integer indices fall back to the
 *   neutral `var(--fg-muted)`.
 * @returns A CSS paint value, usable as an SVG `fill`/`stroke` or a CSS `color`.
 */
export function seriesColour(index: number): string {
  return SERIES_COLOURS[index % SERIES_COLOURS.length] ?? "var(--fg-muted)";
}
