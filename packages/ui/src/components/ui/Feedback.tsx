/*
 * What the screen says when it has something other than data to show.
 *
 * An error explains what happened and what to do about it; it does not apologise and it is
 * never vague. An empty state is an invitation to act, so it carries the action rather than
 * describing it. And loading is a shape, not the word "Loading…" -- a skeleton or a
 * progress bar keeps a slow request from looking identical to a broken one.
 */

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "./cn";

/** A callout's kind: a fact (`info`), a caveat (`warning`), a failure (`error`) or `success`. */
export type CalloutTone = "info" | "warning" | "error" | "success";

const CALLOUT: Record<CalloutTone, { classes: string; Icon: typeof Info }> = {
  info: { classes: "border-signal/30 bg-signal/8 text-fg", Icon: Info },
  warning: { classes: "border-warn/30 bg-warn/8 text-fg", Icon: AlertTriangle },
  error: { classes: "border-defect/30 bg-defect/8 text-fg", Icon: XCircle },
  success: { classes: "border-normal/30 bg-normal/8 text-fg", Icon: CheckCircle2 },
};

const ICON_TONE: Record<CalloutTone, string> = {
  info: "text-signal",
  warning: "text-warn",
  error: "text-defect",
  success: "text-normal",
};

/**
 * A boxed message with a tone icon, an optional title and optional actions.
 *
 * An `error` callout is a `role="alert"` (announced at once); the others are
 * `role="status"`. The tone is exposed as `data-tone`.
 */
export function Callout({
  tone = "info",
  title,
  actions,
  className,
  children,
}: {
  /** Defaults to `info`. */
  tone?: CalloutTone | undefined;
  /** A one-line summary above the message. */
  title?: ReactNode;
  /** Buttons for what to do about it, below the message. */
  actions?: ReactNode;
  /** Merged with the callout's own classes through `cn`. */
  className?: string | undefined;
  /** The message: what happened and what to do about it. */
  children: ReactNode;
}) {
  const { classes, Icon } = CALLOUT[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        "flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-sm leading-snug",
        classes,
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_TONE[tone])} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        <div className="min-w-0 text-fg-muted">{children}</div>
        {actions && <div className="mt-1 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** The common error shape: an `error` `Callout` with only a message. */
export function ErrorBox({
  className,
  children,
}: {
  /** Merged with the callout's own classes through `cn`. */
  className?: string | undefined;
  /** What went wrong and what to do about it. */
  children: ReactNode;
}) {
  return (
    <Callout tone="error" className={className}>
      {children}
    </Callout>
  );
}

/** An empty state: a sentence saying why there is nothing here, and the action that fixes it. */
export function Empty({
  action,
  className,
  children,
}: {
  /** The action — usually a primary `Button` — rather than a description of it. */
  action?: ReactNode;
  /** Merged with the empty state's own classes through `cn`. */
  className?: string | undefined;
  /** Why there is nothing to show. */
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <p className="text-sm text-fg-muted">{children}</p>
      {action}
    </div>
  );
}

/** One placeholder bar for content on its way (`aria-hidden`; size it with `className`). */
export function Skeleton({
  className,
}: {
  /** Sets the bar's size; merged with its own classes through `cn`. */
  className?: string | undefined;
}) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-line", className)} />;
}

/** A stand-in for a panel's worth of content, so the layout does not jump when it lands. */
export function SkeletonRows({
  rows = 3,
  className,
}: {
  /** How many bars. Defaults to 3; the last is shorter. */
  rows?: number | undefined;
  /** Merged with the column's own classes through `cn`. */
  className?: string | undefined;
}) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cn("h-4", index === rows - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/**
 * A known fraction done, as a bar and (with `label`) a percentage line.
 *
 * A `role="progressbar"` with `aria-valuenow` in percent. Its accessible name is
 * `aria-label` if given, else `label`, else "Progress" — pass one that names the job when
 * a screen shows more than one bar.
 */
export function ProgressBar({
  fraction,
  label,
  "aria-label": ariaLabel,
  className,
}: {
  /** Done, from 0 to 1. Clamped. */
  fraction: number;
  /** What is progressing, printed after the percentage: "42 of 100 images". */
  label?: string | undefined;
  /** The bar's accessible name. Defaults to `label`, then to "Progress". */
  "aria-label"?: string | undefined;
  /** Merged with the wrapper's own classes through `cn`. */
  className?: string | undefined;
}) {
  const percent = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label={ariaLabel ?? label ?? "Progress"}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        data-complete={percent === 100 ? "" : undefined}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-signal transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {label && (
        <span className="font-mono text-xs text-fg-muted tabular-nums">
          {percent}% · {label}
        </span>
      )}
    </div>
  );
}
