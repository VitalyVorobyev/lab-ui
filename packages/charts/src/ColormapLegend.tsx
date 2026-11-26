/**
 * The scale of a colour map, shown beside the map: every chart or map shows its scale, with units.
 */

import { cn } from "@vitavision/ui";

import { colormap, colormapGradient, symmetricDomain, type ColormapName } from "./colormap";
import { linearScale } from "./scale";

/** A value marked on a {@link ColormapLegend}: a threshold, a cursor value, a reference. */
export interface ColormapMarker {
  /** Where, in the legend's value units. A value outside the domain is left out. */
  value: number;
  /** The marker's text. Default: the value, formatted with the legend's `format` and `unit`. */
  label?: string | undefined;
}

/** Which end of a {@link ColormapLegend} the data runs past: `"high"` is `≥ max`, `"low"` is `≤ min`. */
export type ColormapClipped = "high" | "low" | "both";

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
  /**
   * Values to mark on the bar: a number, a `{ value, label? }`, or a list of either. Each is a
   * tick across the bar with its text beside it (above a horizontal bar, to the right of the
   * ticks on a vertical one): the label, or else the value with the unit. The text carries the
   * meaning; the tick is decorative. A value outside `domain` is left out.
   */
  marker?: number | ColormapMarker | readonly (number | ColormapMarker)[] | undefined;
  /**
   * The scale saturates: the data runs past the end of `domain`. The end gets a cap (a small
   * arrow in the end colour) and its value reads `≥ max` (`high`) or `≤ min` (`low`); `both`
   * does both ends. The end value is labelled even when `ticks` leaves it out.
   */
  clipped?: ColormapClipped | undefined;
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

/** `marker` as a list of `{ value, label }`, in domain, in the order given. */
function markerList(marker: ColormapLegendProps["marker"], low: number, high: number): ColormapMarker[] {
  if (marker === undefined) return [];
  const list =
    typeof marker === "number" || !Array.isArray(marker)
      ? [marker as number | ColormapMarker]
      : [...(marker as readonly (number | ColormapMarker)[])];
  const lo = Math.min(low, high) - 1e-12;
  const hi = Math.max(low, high) + 1e-12;
  return list
    .map((entry) => (typeof entry === "number" ? { value: entry } : entry))
    .filter((entry) => Number.isFinite(entry.value) && entry.value >= lo && entry.value <= hi);
}

/** The cap on a clipped end: an arrow in the map's end colour, pointing outward. */
function EndCap({ map, end, orientation }: { map: ColormapName; end: "low" | "high"; orientation: "horizontal" | "vertical" }) {
  const horizontal = orientation === "horizontal";
  const clip = horizontal
    ? end === "high"
      ? "polygon(0 0, 100% 50%, 0 100%)"
      : "polygon(100% 0, 0 50%, 100% 100%)"
    : end === "high"
      ? "polygon(50% 0, 100% 100%, 0 100%)"
      : "polygon(0 0, 100% 0, 50% 100%)";
  const place = horizontal
    ? end === "high"
      ? "left-full top-0.5 ml-px h-2 w-1.5"
      : "right-full top-0.5 mr-px h-2 w-1.5"
    : end === "high"
      ? "bottom-full left-0 mb-px h-1.5 w-2.5"
      : "top-full left-0 mt-px h-1.5 w-2.5";
  return (
    <span
      aria-hidden
      data-cap={end}
      className={`absolute ${place}`}
      style={{ backgroundColor: colormap(map, end === "high" ? 1 : 0), clipPath: clip }}
    />
  );
}

/**
 * A gradient bar with its values and unit.
 *
 * - **Horizontal**: one line, "Edge error 0 [bar] 2.5 px". With `ticks` or `symmetric` the values
 *   sit under the bar at their position instead.
 * - **Vertical**: the label above a column bar, the high end at the top, the values beside the
 *   bar at their position, and the unit after the label.
 *
 * `marker` ticks values on the bar (a threshold, the value under a cursor) and `clipped` says
 * the scale saturates at an end, with a cap and `≥` / `≤` on its value.
 *
 * The bar is decorative; the label, the values and the markers' text carry the meaning.
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
  marker,
  clipped,
  length = 160,
  className,
}: ColormapLegendProps) {
  const [low, high] = symmetric ? symmetricDomain(domain) : domain;
  const span = high - low;
  const end = (value: number) => (unit ? `${format(value)} ${unit}` : format(value));
  const fraction = (value: number) => (span === 0 ? 0 : (value - low) / span);
  const markers = markerList(marker, low, high);
  const capLow = clipped === "low" || clipped === "both";
  const capHigh = clipped === "high" || clipped === "both";
  // `≤ min` / `≥ max` on the clipped end's text. Where `low` and `high` coincide the high end wins.
  const text = (value: number, isLow: boolean, isHigh: boolean) =>
    `${isHigh && capHigh ? "≥ " : isLow && capLow ? "≤ " : ""}${format(value)}`;
  const markerText = (entry: ColormapMarker) => entry.label ?? end(entry.value);

  if (orientation === "horizontal" && ticks === undefined && !symmetric && markers.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-fg-muted", className)} data-colormap={map}>
        <span>{label}</span>
        <span className="font-mono tabular-nums">{capLow ? `≤ ${end(low)}` : end(low)}</span>
        <span aria-hidden className="relative h-2 w-24 rounded-full" style={{ backgroundImage: colormapGradient(map) }}>
          {capLow && <EndCap map={map} end="low" orientation="horizontal" />}
          {capHigh && <EndCap map={map} end="high" orientation="horizontal" />}
        </span>
        <span className="font-mono tabular-nums">{capHigh ? `≥ ${end(high)}` : end(high)}</span>
      </div>
    );
  }

  const values = tickValues(ticks, [low, high], symmetric);
  // A clipped end is always labelled, even when a given `ticks` list leaves it out.
  if (capLow && !values.includes(low)) values.unshift(low);
  if (capHigh && !values.includes(high)) values.push(high);
  const tickText = (value: number) => text(value, value === low, value === high);

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-start gap-2 text-xs text-fg-muted", className)} data-colormap={map}>
        <span className={markers.length > 0 ? "pt-4" : undefined}>{label}</span>
        {/* The values are positioned against the bar; `pb-4` leaves the row room for them, `pt-4` the markers' text. */}
        <div className={cn("relative w-32 pb-4", markers.length > 0 && "pt-4", (capLow || capHigh) && "mx-2")}>
          <div className="relative mt-0.5 h-2">
            <div aria-hidden className="absolute inset-0 rounded-full" style={{ backgroundImage: colormapGradient(map) }} />
            {capLow && <EndCap map={map} end="low" orientation="horizontal" />}
            {capHigh && <EndCap map={map} end="high" orientation="horizontal" />}
            {markers.map((entry, index) => (
              <span
                key={`m-${index}`}
                aria-hidden
                data-marker-tick=""
                className="absolute -top-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-fg ring-1 ring-surface"
                style={{ left: `${(fraction(entry.value) * 100).toFixed(2)}%` }}
              />
            ))}
          </div>
          {markers.map((entry, index) => (
            <span
              key={`mt-${index}`}
              data-marker=""
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] leading-none tabular-nums text-fg"
              style={{ left: `${(fraction(entry.value) * 100).toFixed(2)}%` }}
            >
              {markerText(entry)}
            </span>
          ))}
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              data-tick=""
              className={cn("absolute -translate-x-1/2 font-mono text-[10px] tabular-nums", markers.length > 0 ? "top-7" : "top-3")}
              style={{ left: `${(fraction(value) * 100).toFixed(2)}%` }}
            >
              {tickText(value)}
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
        <div className="relative w-2.5">
          <div aria-hidden className="absolute inset-0 rounded-full" style={{ backgroundImage: colormapGradient(map, "to top") }} />
          {capLow && <EndCap map={map} end="low" orientation="vertical" />}
          {capHigh && <EndCap map={map} end="high" orientation="vertical" />}
          {markers.map((entry, index) => (
            <span
              key={`m-${index}`}
              aria-hidden
              data-marker-tick=""
              className="absolute -left-0.5 -right-0.5 h-0.5 translate-y-1/2 rounded-full bg-fg ring-1 ring-surface"
              style={{ bottom: `${(fraction(entry.value) * 100).toFixed(2)}%` }}
            />
          ))}
        </div>
        <div className="relative ml-1.5 min-w-8">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              data-tick=""
              className="absolute left-0 translate-y-1/2 whitespace-nowrap font-mono text-[10px] leading-none tabular-nums"
              style={{ bottom: `${(fraction(value) * 100).toFixed(2)}%` }}
            >
              {tickText(value)}
            </span>
          ))}
        </div>
        {markers.length > 0 && (
          <div className="relative ml-1.5 min-w-8">
            {markers.map((entry, index) => (
              <span
                key={`mt-${index}`}
                data-marker=""
                className="absolute left-0 translate-y-1/2 whitespace-nowrap font-mono text-[10px] leading-none tabular-nums text-fg"
                style={{ bottom: `${(fraction(entry.value) * 100).toFixed(2)}%` }}
              >
                {markerText(entry)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
