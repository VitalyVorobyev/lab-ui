/*
 * A number with its difference from another: a value in a table cell, the signed change from
 * a reference beside it, and a tint that says how much that change matters.
 *
 * It is generic on purpose. What the reference is (a default, a previous run, a design value),
 * and how a change is judged large (against a tolerance, a spread, the other rows), is the
 * caller's: it hands over `magnitude`, already normalised to `[0, 1]`, and the cell steps it
 * into four strengths. The tint is the accent or a neutral, never a verdict colour: a change
 * is not a pass or a fail.
 */

import { cn } from "./cn";

/** How strongly a `DeltaCell` is highlighted. */
export type DeltaStrength = "none" | "low" | "medium" | "high";

/**
 * The strength a normalised magnitude is shown at.
 *
 * @param magnitude - Where the change falls on the caller's scale, `0` (no change) to `1` (the
 *   largest worth showing). Clamped. `undefined`, `null` and `NaN` give `none`.
 * @returns `none` below 0.1, `low` below 0.4, `medium` below 0.7, else `high`.
 */
export function deltaStrength(magnitude: number | null | undefined): DeltaStrength {
  if (magnitude === null || magnitude === undefined || Number.isNaN(magnitude)) return "none";
  const m = Math.min(1, Math.max(0, magnitude));
  if (m < 0.1) return "none";
  if (m < 0.4) return "low";
  if (m < 0.7) return "medium";
  return "high";
}

const TINT = {
  signal: { none: "", low: "bg-signal/8", medium: "bg-signal/16", high: "bg-signal/26" },
  neutral: { none: "", low: "bg-fg/6", medium: "bg-fg/12", high: "bg-fg/20" },
} as const;

const defaultFormat = (value: number) => String(Number(value.toPrecision(4)));

/** Props of `DeltaCell`. */
export interface DeltaCellProps {
  /** The number. A missing or non-finite one shows an em dash. */
  value: number | null | undefined;
  /** Its signed difference from the reference, in the value's own units. Missing or non-finite shows no difference. */
  delta?: number | null | undefined;
  /**
   * How much the difference matters, normalised to `[0, 1]` by the caller: `0.25` is a quarter
   * of the largest difference worth showing. Steps into a tint (see `deltaStrength`); leave it
   * out for no tint.
   */
  magnitude?: number | null | undefined;
  /** The tint: the accent (`signal`, the default) or a neutral grey. Never a verdict colour. */
  tone?: "signal" | "neutral" | undefined;
  /** Formats the value. Defaults to at most 4 significant figures, without trailing zeros. */
  format?: ((value: number) => string) | undefined;
  /** Formats the difference's size, without its sign. Defaults to `format`. */
  deltaFormat?: ((delta: number) => string) | undefined;
  /** The unit, written after the value. */
  unit?: string | undefined;
  /** What the difference is from, for assistive technology: "from default". Defaults to "change". */
  deltaLabel?: string | undefined;
  /** Merged onto the cell with `cn`. */
  className?: string | undefined;
}

/**
 * A value with its signed difference and a strength tint, for a numeric `Table` cell.
 *
 * The difference is written with an explicit sign (`+0.012`, `−0.4`; a zero has none) in muted
 * text beside the value, and is announced as "change +0.012" or with `deltaLabel`. The tint
 * carries `data-strength` (`none`, `low`, `medium`, `high`); it is never the only cue, since the
 * difference is also text. Right-aligned and in mono when it sits in a `numeric` column.
 */
export function DeltaCell({
  value,
  delta,
  magnitude,
  tone = "signal",
  format = defaultFormat,
  deltaFormat,
  unit,
  deltaLabel = "change",
  className,
}: DeltaCellProps) {
  const present = typeof value === "number" && Number.isFinite(value);
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const strength = deltaStrength(magnitude);
  const sign = !hasDelta || delta === 0 ? "" : delta > 0 ? "+" : "−";
  const size = hasDelta ? (deltaFormat ?? format)(Math.abs(delta)) : "";
  return (
    <span
      data-delta-cell=""
      data-strength={strength}
      className={cn("inline-flex items-baseline justify-end gap-1.5 rounded-control px-1.5 py-0.5", TINT[tone][strength], className)}
    >
      <span>
        {present ? format(value) : "—"}
        {present && unit && <span className={cn("ml-0.5", strength === "none" ? "text-fg-muted" : "text-fg")}>{unit}</span>}
      </span>
      {hasDelta && (
        <span className={cn("text-[0.85em]", strength === "none" ? "text-fg-muted" : "text-fg")}>
          <span className="sr-only">{deltaLabel} </span>
          {sign}
          {size}
        </span>
      )}
    </span>
  );
}
