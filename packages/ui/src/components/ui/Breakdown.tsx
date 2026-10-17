/*
 * Counts by category, as one thin stacked bar.
 *
 * The segments may use the verdict colours because each one counts things the app has already
 * judged: strings it passed, strings it flagged, strings that failed a check. That is the only
 * licence. A share of a continuous quantity, or one series beside another, is not a verdict and
 * belongs on a chart.
 *
 * It is a `role="img"`: the bar is one picture whose meaning is its name. `progressbar` and
 * `meter` carry a single value, and a `list` of segments would make a reader step through
 * parts of a glyph that is meant to be taken in at once. The name is the counts in words, so
 * colour is never the only cue.
 *
 * Widths are flex grow factors rather than percentages, so the one-pixel gaps that keep two
 * neighbouring colours apart come out of the bar and not off its end. The layout is inline
 * rather than classes, so the shares and the 2 px floor hold under any stylesheet.
 */

import type { ComponentProps } from "react";

import { byDensity, useDensity } from "./Density";
import { cn } from "./cn";

/** Counts written the same on the server and in every browser: `2,556`, `0.5`. */
const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * The colour of a `Breakdown` segment: a verdict (`normal`, `warn`, `defect`) for things the app
 * has judged, or `neutral` for a category that is no verdict (skipped, not applicable).
 */
export type BreakdownTone = "normal" | "warn" | "defect" | "neutral";

/** One category of a `Breakdown`: how many, in which colour, and what a reader calls them. */
export interface BreakdownSegment {
  /** How many. Negative and non-finite values count as 0, and a segment of 0 is left out. */
  value: number;
  /** The colour, by meaning. */
  tone: BreakdownTone;
  /** What the count is, as it reads after the number: `"done"` gives "412 done". Unique among the segments. */
  label: string;
}

/** Options of `breakdownText`, the same as the `Breakdown` props of the same names. */
export interface BreakdownTextOptions {
  /** The whole. Defaults to the sum of the segments; a total below the sum counts as the sum. */
  total?: number | undefined;
  /** What the rest of the total is, as it reads after the number: `"to do"` gives "131 to do". */
  remainderLabel?: string | undefined;
}

const TONE_CLASSES: Record<BreakdownTone, string> = {
  normal: "bg-normal",
  warn: "bg-warn",
  defect: "bg-defect",
  neutral: "bg-fg-subtle",
};

/** A count as drawn: 0 for anything that is not a finite, positive number. */
const amount = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** The segments that are drawn, the whole, and the rest of it. */
function measure(segments: readonly BreakdownSegment[], total: number | undefined) {
  const shown = segments.filter((segment) => amount(segment.value) > 0);
  const sum = shown.reduce((acc, segment) => acc + amount(segment.value), 0);
  const whole = total !== undefined && Number.isFinite(total) && total > sum ? total : sum;
  return { shown, sum, whole, rest: whole - sum };
}

/**
 * The counts of a breakdown in words: `"412 done, 20 to check, 3 problems, 131 to do of 566"`.
 *
 * It is the default accessible name of `Breakdown`, and the text for a tooltip or a label printed
 * beside the bar. Segments of 0 are left out; the rest of the total is named only with a
 * `remainderLabel`. With nothing to count it reads `"0 of 566"`.
 *
 * @param segments - The categories, in order.
 * @param options - The `total` and the `remainderLabel`.
 * @returns The text.
 */
export function breakdownText(segments: readonly BreakdownSegment[], options: BreakdownTextOptions = {}): string {
  const { shown, whole, rest } = measure(segments, options.total);
  const parts = shown.map((segment) => `${count.format(amount(segment.value))} ${segment.label}`);
  if (options.remainderLabel !== undefined && rest > 0) parts.push(`${count.format(rest)} ${options.remainderLabel}`);
  return `${parts.length > 0 ? parts.join(", ") : "0"} of ${count.format(whole)}`;
}

/** Props of `Breakdown`: the segments and their total, plus the `<div>` props. */
export type BreakdownProps = Omit<ComponentProps<"div">, "children" | "role"> & {
  /** The categories, drawn left to right in this order, each as wide as its share of the total. */
  segments: readonly BreakdownSegment[];
  /**
   * The whole. Defaults to the sum of the segments; the rest is drawn as empty track. A total
   * below the sum counts as the sum.
   */
  total?: number | undefined;
  /** What the empty track counts, for the accessible name: `"to do"` gives "131 to do". */
  remainderLabel?: string | undefined;
};

/**
 * A thin bar of counts by category: 412 done, 20 to check and 3 problems out of 566, with the
 * rest as empty track. Segments are drawn in the order given, each as wide as its share of the
 * total (a non-zero count is never narrower than 2 px); segments of 0 are left out.
 *
 * Its colours are verdicts, so use it only for things the app has judged — never for a share of
 * a continuous quantity or for series side by side (use `Progress` or a chart).
 *
 * A `role="img"` whose name lists every non-zero count, as `breakdownText` writes it: "412 done,
 * 20 to check, 3 problems, 131 to do of 566". `aria-label` or `aria-labelledby` replaces it. The track
 * matches `Progress` and follows the density in force. State is exposed as `data-state`
 * (`"empty"` with nothing counted, `"partial"`, or `"complete"` when the segments fill the
 * total), and each segment's tone as its `data-tone`. Width changes ease over 300 ms, and not at
 * all with reduced motion.
 */
export function Breakdown({ segments, total, remainderLabel, className, "aria-label": ariaLabel, ...rest }: BreakdownProps) {
  const density = useDensity();
  const { shown, sum, rest: remainder } = measure(segments, total);
  const name = ariaLabel ?? (rest["aria-labelledby"] ? undefined : breakdownText(segments, { total, remainderLabel }));
  return (
    <div
      role="img"
      aria-label={name}
      data-state={sum === 0 ? "empty" : remainder > 0 ? "partial" : "complete"}
      {...rest}
      className={cn("w-full overflow-hidden rounded-full bg-line", byDensity(density, "h-1.5", "h-1"), className)}
      style={{ display: "flex", gap: 1, ...rest.style }}
    >
      {shown.map((segment) => (
        <div
          key={segment.label}
          data-tone={segment.tone}
          className={cn("h-full transition-[flex-grow] duration-300", TONE_CLASSES[segment.tone])}
          style={{ flex: `${amount(segment.value)} 0 0`, minWidth: 2 }}
        />
      ))}
      {remainder > 0 && <div className="h-full transition-[flex-grow] duration-300" style={{ flex: `${remainder} 0 0` }} />}
    </div>
  );
}
