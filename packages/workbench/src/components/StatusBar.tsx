/*
 * The status line along the foot of a studio app: what the app is doing and what it is
 * showing — the duration of the last operation, the current frame, the model in use.
 *
 * Studio apps each grew one, and each placed, sized and spaced its facts differently. This is
 * the one line, built from `ReadoutStrip`, so the facts read like the readouts everywhere else:
 * mono, quiet labels, separated by a dot.
 */

import type { ReactNode } from "react";

import { ReadoutStrip, cn, type ReadoutItem } from "@vitavision/ui";

/** Props of `StatusBar`. */
export interface StatusBarProps {
  /** The facts at the left end, in order. Items whose `value` is `null` or `undefined` are skipped. */
  start?: ReadoutItem[] | undefined;
  /** The facts at the right end, in order. Items whose `value` is `null` or `undefined` are skipped. */
  end?: ReadoutItem[] | undefined;
  /** Drawn between the two ends, e.g. a `ProgressBar` while an operation runs. */
  children?: ReactNode;
  /** Names the bar. Defaults to "Status". */
  "aria-label"?: string | undefined;
  /**
   * Announce changes to the bar's content politely (`role="status"`) instead of leaving it a
   * plain named group. Defaults to false.
   */
  live?: boolean | undefined;
  /** Merged with the bar's own classes through `cn`. */
  className?: string | undefined;
}

/**
 * One 24 px line of facts for `AppShell`'s `bottom` slot: a `ReadoutStrip` of `start` items at
 * the left end, one of `end` items at the right end, and `children` between them.
 *
 * It is a `role="group"` named by `aria-label` ("Status"). With `live` it is a
 * `role="status"` instead (a polite live region, and `data-live`), so a screen reader
 * announces what changes in it: use that for facts worth hearing when they change (an
 * operation finished), not for ones that change many times a second. The line does not wrap;
 * keep it to a few short facts.
 */
export function StatusBar({
  start,
  end,
  children,
  "aria-label": ariaLabel = "Status",
  live = false,
  className,
}: StatusBarProps) {
  const hasChildren = children !== undefined && children !== null && children !== false;
  return (
    <div
      role={live ? "status" : "group"}
      aria-label={ariaLabel}
      aria-live={live ? "polite" : undefined}
      data-live={live ? "" : undefined}
      className={cn("flex h-6 min-w-0 items-center gap-3 overflow-hidden px-3", className)}
    >
      {start && <ReadoutStrip items={start} className={STRIP} />}
      {hasChildren && <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>}
      {end && <ReadoutStrip items={end} className={cn(STRIP, "ml-auto")} />}
    </div>
  );
}

/** One line: the strip's own wrapping would push the second line out of a 24 px bar. */
const STRIP = "shrink-0 flex-nowrap whitespace-nowrap";
