/**
 * The scale of a colour map, shown beside the map: every chart or map shows its scale, with units.
 */

import { cn } from "@vitavision/ui";

import { colormapGradient, symmetricDomain, type ColormapName } from "./colormap";
import { linearScale } from "./scale";

/** Props of `ColormapLegend`. */
export interface ColormapLegendProps {
  /** The map. */
  map: ColormapName;
  /** The values at the two ends, `[low, high]`. */
  domain: readonly [number, number];
  /** The values' unit, written after them (`px`, `%`). */
  unit?: string | undefined;
  /** What the colour encodes, written before the bar ("Validity", "Edge error"). */
  label: string;
  /** Formats the end and tick values. Defaults to at most 3 significant figures, without trailing zeros. */
  format?: ((value: number) => string) | undefined;
  /**
   * How the bar runs. `horizontal` (the default) is one line, low to high; `vertical` is a
   * column with the label above and the high end at the top, for the side of a map.
   */
  orientation?: "horizontal" | "vertical" | undefined;
  /**
   * Values to label along the bar: a list, or a rough count of round ones. Without it a
   * `horizontal` legend labels its two ends in line with the bar and a `vertical` one labels
   * its two ends (and zero, when `symmetric`). With it the values sit along the bar, at their
   * position on the map; values outside `domain` are left out. A count also labels the two ends.
   */
  ticks?: number | readonly number[] | undefined;
  /**
   * Centre the scale on zero for a diverging map: `domain` is widened to `[-m, m]` with `m`
   * its largest absolute end, so the middle colour is zero and the middle tick says so.
   */
  symmetric?: boolean | undefined;
  /** For `vertical`: the bar's length in CSS pixels. Defaults to 160. */
  length?: number | undefined;
  /** Merged onto the legend with `cn`. */
  className?: string | undefined;
}

const defaultFormat = (value: number) => String(Number(value.toPrecision(3)));

/** The tick values: a given list inside the domain, or round values, or the default for the layout. */
function tickValues(ticks: ColormapLegendProps["ticks"], domain: readonly [number, number], symmetric: boolean): number[] {
  const [low, high] = domain;
  const inside = (v: number) => Number.isFinite(v) && v >= Math.min(low, high) - 1e-12 && v <= Math.max(low, high) + 1e-12;
  if (typeof ticks === "number") {
    // Round values, and the two ends: a scale is read from its ends. A round value within 8 % of an end gives way to it.
    const span = Math.abs(high - low);
    const round = linearScale([low, high], 0, 1)
      .ticks(ticks)
      .map((tick) => tick.value)
      .filter((v) => inside(v) && Math.abs(v - low) > 0.08 * span && Math.abs(v - high) > 0.08 * span);
    return [low, ...round, high];
  }
  if (ticks !== undefined) return ticks.filter(inside);
  return symmetric ? [low, 0, high] : [low, high];
}

/**
 * A gradient bar with its values and unit.
 *
 * - **Horizontal**: one line, "Edge error 0 [bar] 2.5 px". With `ticks` or `symmetric` the values
 *   sit under the bar at their position instead.
 * - **Vertical**: the label above a column bar, the high end at the top, the values beside the
 *   bar at their position, and the unit after the label.
 *
 * The bar is decorative; the label and the values carry the meaning as text.
 */
export function ColormapLegend({
  map,
  domain,
  unit,
  label,
  format = defaultFormat,
  orientation = "horizontal",
  ticks,
  symmetric = false,
  length = 160,
  className,
}: ColormapLegendProps) {
  const [low, high] = symmetric ? symmetricDomain(domain) : domain;
  const span = high - low;
  const end = (value: number) => (unit ? `${format(value)} ${unit}` : format(value));
  const fraction = (value: number) => (span === 0 ? 0 : (value - low) / span);

  if (orientation === "horizontal" && ticks === undefined && !symmetric) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-fg-muted", className)} data-colormap={map}>
        <span>{label}</span>
        <span className="font-mono tabular-nums">{end(low)}</span>
        <span aria-hidden className="h-2 w-24 rounded-full" style={{ backgroundImage: colormapGradient(map) }} />
        <span className="font-mono tabular-nums">{end(high)}</span>
      </div>
    );
  }

  const values = tickValues(ticks, [low, high], symmetric);

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-start gap-2 text-xs text-fg-muted", className)} data-colormap={map}>
        <span>{label}</span>
        {/* The values are positioned against the bar; `pb-4` leaves the row room for them. */}
        <div className="relative w-32 pb-4">
          <div aria-hidden className="mt-0.5 h-2 rounded-full" style={{ backgroundImage: colormapGradient(map) }} />
          {values.map((value) => (
            <span
              key={value}
              data-tick=""
              className="absolute top-3 -translate-x-1/2 font-mono text-[10px] tabular-nums"
              style={{ left: `${(fraction(value) * 100).toFixed(2)}%` }}
            >
              {format(value)}
            </span>
          ))}
        </div>
        {unit && <span className="text-fg-subtle">{unit}</span>}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex flex-col gap-1.5 text-xs text-fg-muted", className)} data-colormap={map} data-orientation="vertical">
      <span>
        {label}
        {unit && <span className="ml-1 text-fg-subtle">{unit}</span>}
      </span>
      {/* The values sit on the bar's right; the margin above and below keeps the end values inside the box. */}
      <div className="relative my-1.5 flex" style={{ height: length }}>
        <div aria-hidden className="w-2.5 rounded-full" style={{ backgroundImage: colormapGradient(map, "to top") }} />
        <div className="relative ml-1.5 min-w-8">
          {values.map((value) => (
            <span
              key={value}
              data-tick=""
              className="absolute left-0 translate-y-1/2 font-mono text-[10px] leading-none tabular-nums"
              style={{ bottom: `${(fraction(value) * 100).toFixed(2)}%` }}
            >
              {format(value)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
