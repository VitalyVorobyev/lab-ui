/*
 * How far a long operation has got.
 *
 * The bar is in `signal`, not a verdict colour: progress is not a pass or a fail, and a bar
 * that turned green at 100 % would claim a verdict nobody made. The value text is "412 of
 * 2,556" rather than a bare percentage, because the count is what a reader checks against
 * the work ("2,556 strings"), and a screen reader says it as written.
 */

import type { ComponentProps } from "react";

import { byDensity, useDensity } from "./Density";
import { cn } from "./cn";

/** Counts written the same on the server and in every browser: `2,556`, `0.5`. */
const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * The accessible value text of a progress: `"412 of 2,556"`, or `null` while indeterminate.
 *
 * @param value - Done so far; `null` or `undefined` for an unknown amount.
 * @param max - The whole. Defaults to 100.
 * @returns The text, with the value clamped to `[0, max]`.
 */
export function progressText(value: number | null | undefined, max = 100): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const whole = max > 0 ? max : 100;
  return `${count.format(Math.min(Math.max(value, 0), whole))} of ${count.format(whole)}`;
}

/** Props of `Progress`: a value out of a `max`, or none for an unknown amount, plus the `<div>` props. */
export type ProgressProps = Omit<ComponentProps<"div">, "children" | "role"> & {
  /** Done so far, from 0 to `max`; clamped. `null` or left out: indeterminate, the amount unknown. */
  value?: number | null | undefined;
  /** The whole. Defaults to 100; a value ≤ 0 counts as 100. */
  max?: number | undefined;
  /**
   * What a screen reader says for the value. Defaults to `"412 of 2,556"`; give your own when
   * the unit matters ("412 of 2,556 strings").
   */
  valueText?: string | undefined;
};

/**
 * A progress bar: determinate when it has a `value` (a `max`, 100 by default), indeterminate
 * without one. Name it with `aria-label` or `aria-labelledby`.
 *
 * A `progressbar` with `aria-valuenow`, `aria-valuemax` and `aria-valuetext` ("412 of 2,556",
 * or your `valueText`); indeterminate, it has none of them, as the ARIA pattern asks.
 * The track follows the density in force. State is exposed as `data-state`
 * (`"indeterminate"`, `"loading"` or `"complete"`). With reduced motion the indeterminate bar
 * holds still.
 */
export function Progress({ value, max = 100, valueText, className, ...rest }: ProgressProps) {
  const density = useDensity();
  const whole = max > 0 ? max : 100;
  const text = progressText(value, whole);
  const done = text === null ? null : Math.min(Math.max(value as number, 0), whole);
  const state = done === null ? "indeterminate" : done >= whole ? "complete" : "loading";
  return (
    <div
      role="progressbar"
      aria-valuemin={done === null ? undefined : 0}
      aria-valuemax={done === null ? undefined : whole}
      aria-valuenow={done ?? undefined}
      aria-valuetext={done === null ? undefined : (valueText ?? text ?? undefined)}
      data-state={state}
      {...rest}
      className={cn("relative w-full overflow-hidden rounded-full bg-line", byDensity(density, "h-1.5", "h-1"), className)}
    >
      {done === null ? (
        // A third of the track sweeping across it. Its resting place (reduced motion, a
        // screenshot) is the left third, still visibly "in progress".
        <div className="absolute inset-y-0 left-0 w-1/3 animate-progress-sweep rounded-full bg-signal" />
      ) : (
        <div className="h-full rounded-full bg-signal transition-[width] duration-300" style={{ width: `${(done / whole) * 100}%` }} />
      )}
    </div>
  );
}
