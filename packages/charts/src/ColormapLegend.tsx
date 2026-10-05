/**
 * The scale of a colour map, shown beside the map: every chart or map shows its scale, with units.
 */

import { cn } from "@vitavision/ui";

import { colormapGradient, type ColormapName } from "./colormap";

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
  /** Formats the end values. Defaults to at most 3 significant figures, without trailing zeros. */
  format?: ((value: number) => string) | undefined;
  /** Merged onto the row with `cn`. */
  className?: string | undefined;
}

/**
 * A gradient bar with its end values and unit, read as one line: "Edge error 0 [bar] 2.5 px".
 * The bar is decorative; the label and the end values carry the meaning as text.
 */
export function ColormapLegend({
  map,
  domain,
  unit,
  label,
  format = (value) => String(Number(value.toPrecision(3))),
  className,
}: ColormapLegendProps) {
  const end = (value: number) => (unit ? `${format(value)} ${unit}` : format(value));
  return (
    <div className={cn("flex items-center gap-2 text-xs text-fg-muted", className)} data-colormap={map}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{end(domain[0])}</span>
      <span aria-hidden className="h-2 w-24 rounded-full" style={{ backgroundImage: colormapGradient(map) }} />
      <span className="font-mono tabular-nums">{end(domain[1])}</span>
    </div>
  );
}
