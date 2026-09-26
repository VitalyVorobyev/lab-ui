/*
 * Status colour, in one place.
 *
 * The tone vocabulary is deliberately small and deliberately *about verdicts*. The chrome
 * carries no saturation, so a colour on screen means something: green is a normal sample
 * (or an in-tolerance measurement), red is a defect (or an out-of-tolerance one), amber is
 * a caveat. `info` is the one tone that borrows the interaction accent, and it is reserved
 * for statements of fact about a method -- "produces anomaly maps", "caliper axis fixed" --
 * rather than for anything a reader must act on.
 */

import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * The badge and status-dot vocabulary: the verdicts (`normal`, `defect`, `warning`),
 * `unlabeled` for a sample with no verdict yet, `info` for a statement of fact about a
 * method, and `neutral` for everything else.
 */
export type Tone = "neutral" | "normal" | "defect" | "unlabeled" | "warning" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-raised text-fg-muted ring-line",
  normal: "bg-normal/12 text-normal ring-normal/25",
  defect: "bg-defect/12 text-defect ring-defect/25",
  unlabeled: "bg-raised text-fg-subtle ring-line",
  warning: "bg-warn/12 text-warn ring-warn/25",
  info: "bg-signal/12 text-signal ring-signal/25",
};

const DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  normal: "bg-normal",
  defect: "bg-defect",
  unlabeled: "bg-line-strong",
  warning: "bg-warn",
  info: "bg-signal",
};

/**
 * A short label in a tone: a verdict, a status, a count.
 *
 * The tone is exposed as `data-tone`, so a stylesheet or a test can read it without parsing
 * class names.
 */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  /** Which colour, by meaning. Defaults to `neutral`. */
  tone?: Tone | undefined;
  /** Merged with the badge's own classes through `cn`. */
  className?: string | undefined;
  /** The label. */
  children: ReactNode;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A status as a dot and a word.
 *
 * The mapping from a domain status to a tone belongs to each caller -- only it knows
 * whether "running" is good news -- but the *rendering* of the answer does not.
 */
export function StatusDot({
  tone,
  className,
  children,
}: {
  /** The status, as a tone; also exposed as `data-tone`. */
  tone: Tone;
  /** Merged with the row's own classes through `cn`. */
  className?: string | undefined;
  /** The word beside the dot. The dot alone is decoration: say the status in words. */
  children?: ReactNode;
}) {
  return (
    <span
      data-tone={tone}
      className={cn("inline-flex items-center gap-1.5 text-xs text-fg-muted", className)}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])} aria-hidden />
      {children}
    </span>
  );
}

/** Counts as a compact `12 normal · 9 defect` run of badges, skipping the zeroes. */
export function CountRun({
  counts,
  className,
}: {
  /** `[name, count, tone]` triples, in display order. Zero counts are dropped. */
  counts: [string, number, Tone][];
  /** Merged with the run's own classes through `cn`. */
  className?: string | undefined;
}) {
  const shown = counts.filter(([, value]) => value > 0);
  if (shown.length === 0) {
    return <span className={cn("text-xs text-fg-subtle", className)}>empty</span>;
  }
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map(([name, value, tone]) => (
        <Badge key={name} tone={tone}>
          <span className="font-mono">{value}</span> {name}
        </Badge>
      ))}
    </span>
  );
}
