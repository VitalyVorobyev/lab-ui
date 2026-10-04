/**
 * A single-series histogram: one distribution, from raw values or from counts already binned.
 *
 * Raw values are binned here; counts are for the caller that cannot hand over its samples —
 * a 20 MP image's luminance is 256 numbers, not 20 million. Either way the bars are one
 * `<path>`, and the bin under `cursor` is a second one in the selection colour.
 */

import type { ReactNode } from "react";

import { barsPath, binAt, binValues, cleanCounts, tallest } from "./bars";
import { FLUID_DEFAULT_HEIGHT, Frame, areaFor, seriesColour, useFluidSize, type Variant } from "./Frame";
import { Bands, Markers, PlotInteraction, type InteractionProps } from "./interaction";
import { linearScale, logScale } from "./scale";

/** Props every {@link Histogram} takes, whichever way its data is given. */
export interface HistogramOptions extends InteractionProps {
  /** Accessible name of the chart (the SVG's `aria-label`). Required. */
  label: string;
  /** x-axis title. */
  xLabel?: string | undefined;
  /** y-axis title. */
  yLabel?: string | undefined;
  /** Unit of x, appended to the x-axis title in parentheses: `luminance (DN)`. */
  unit?: string | undefined;
  /** Counts span decades in a long-tailed distribution; a log axis keeps the tail visible. */
  logY?: boolean | undefined;
  /** Where the chart is going (see {@link Variant}). Default `"panel"`. */
  variant?: Variant | undefined;
  /** For `variant="fluid"`: the chart's height in CSS pixels. Default 200. */
  height?: number | undefined;
  /** Rendered under the plot, inside the `<figcaption>`. */
  footer?: ReactNode;
  /** Extra classes for the outer `<figure>`, merged with `cn`. */
  className?: string | undefined;
}

/** A histogram given as raw samples, binned by the chart. */
export interface HistogramValues {
  /** The samples. Non-finite values, and values outside `domain`, are ignored. */
  values: ArrayLike<number>;
  /** Number of equal-width bins. Default 32. */
  bins?: number | undefined;
  /** The x range the bins span. Omitted: the extent of `values`. */
  domain?: [number, number] | undefined;
  /** Not accepted with `values` — pass one or the other. */
  counts?: undefined;
}

/** A histogram given as counts per bin, already binned by the caller. */
export interface HistogramCounts {
  /** One count per bin, left to right; the bins are equal-width and fill `domain`. */
  counts: ArrayLike<number>;
  /** The x range the bins span. Required: without samples there is no extent to fall back on. */
  domain: [number, number];
  /** Not accepted with `counts` — pass one or the other. */
  values?: undefined;
}

/**
 * Props for {@link Histogram}: {@link HistogramOptions} plus data as either
 * {@link HistogramValues} or {@link HistogramCounts}, never both.
 */
export type HistogramProps = HistogramOptions & (HistogramValues | HistogramCounts);

/**
 * One distribution as a bar chart over equal-width bins.
 *
 * @remarks
 * An SVG `role="img"` named by `label`. `markers` tick the x axis (a threshold), `bands`
 * shade x ranges, `onHover` adds a crosshair and the x under it, `onPick` reports the x of a
 * click, and `cursor` draws the bin containing an x chosen elsewhere in the selection
 * colour (`--signal`) — no highlight when it lies outside the domain. Empty data draws an
 * empty frame. For two classes sharing a threshold use {@link ScoreHistogram}.
 */
export function Histogram(props: HistogramProps) {
  const {
    label,
    xLabel,
    yLabel,
    unit,
    logY = false,
    variant = "panel",
    height = FLUID_DEFAULT_HEIGHT,
    footer,
    className,
    bands,
    markers,
    cursor,
    onHover,
    onPick,
  } = props;

  const { counts, domain } =
    props.counts !== undefined
      ? cleanCounts(props.counts, props.domain)
      : binValues(props.values, props.bins, props.domain);

  const [fluidRef, fluidSize] = useFluidSize(height);
  const size = variant === "fluid" ? fluidSize : undefined;
  const plotArea = areaFor(variant, size);

  const xScale = linearScale(domain, plotArea.x0, plotArea.x1);
  const top = tallest(counts);
  // Half a count of floor, so a bin of one is a visible bar on the log axis.
  const yScale = logY ? logScale([0.5, top], plotArea.y0, plotArea.y1) : linearScale([0, top], plotArea.y0, plotArea.y1);

  const highlighted = binAt(counts.length, domain, cursor);
  const hasHighlight = highlighted !== null && (counts[highlighted] ?? 0) > 0;
  const xTitle = [xLabel, unit ? `(${unit})` : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <Frame
      xScale={xScale}
      yScale={yScale}
      xLabel={xTitle}
      yLabel={yLabel}
      label={label}
      variant={variant}
      className={className}
      size={size}
      figureRef={variant === "fluid" ? fluidRef : undefined}
      footer={footer}
    >
      {bands && bands.length > 0 && <Bands bands={bands} xScale={xScale} area={plotArea} />}
      <path
        data-bars=""
        d={barsPath(counts, yScale, plotArea, { skip: hasHighlight ? highlighted : null })}
        fill={seriesColour(0)}
        opacity={0.8}
      />
      {hasHighlight && (
        <path
          data-cursor-bin={highlighted}
          d={barsPath(counts, yScale, plotArea, { only: highlighted })}
          fill="var(--signal)"
        />
      )}
      {markers && markers.length > 0 && <Markers markers={markers} xScale={xScale} area={plotArea} />}
      {(onHover || onPick) && (
        <PlotInteraction
          xScale={xScale}
          yScale={yScale}
          area={plotArea}
          series={[]}
          onHover={onHover}
          onPick={onPick}
        />
      )}
    </Frame>
  );
}
