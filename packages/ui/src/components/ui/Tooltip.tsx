/*
 * A short explanation, on demand.
 *
 * Replaces the native `title` attribute, which appears after an unpredictable delay, in the
 * OS palette, at a size nobody chose, and never at all for a keyboard user.
 *
 * A tooltip is for text that helps but is not needed to operate the control. Anything a
 * reader must have in order to answer the question belongs in the field's description,
 * where it is always visible.
 */

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { HelpCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn, focusRing } from "./cn";

/**
 * Shares one open delay (200 ms) across the tooltips below it. Mount it once near the root:
 * `Tooltip` and `InfoHint` need it above them.
 */
export function TooltipProvider({
  children,
}: {
  /** The app, or the region that uses tooltips. */
  children: ReactNode;
}) {
  return <RadixTooltip.Provider delayDuration={200}>{children}</RadixTooltip.Provider>;
}

/**
 * A short explanation on hover or focus of its child, for text that helps but is not needed
 * to operate the control (that belongs in a field's description).
 *
 * The child must be one focusable element that accepts a ref (Radix `asChild`). Radix
 * exposes `data-state` (`closed`/`delayed-open`/`instant-open`) on it.
 */
export function Tooltip({
  content,
  children,
}: {
  /** The explanation. */
  content: ReactNode;
  /** The one element it explains. */
  children: ReactNode;
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 max-w-xs rounded-control border border-line bg-overlay px-2.5 py-1.5",
            "text-xs leading-snug text-fg shadow-lg shadow-black/25",
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-overlay" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/**
 * The standard affordance: a quiet mark that yields the explanation on hover or focus.
 *
 * `icon` exists because the mark answers two different questions. The default `?` offers
 * help with a control; `Info` offers *facts about the thing on screen* -- where a dataset
 * came from, which method produced a measurement -- which the tone demotes here rather
 * than spending a permanent line on. Reading them as the same affordance would be a small
 * lie.
 */
export function InfoHint({
  children,
  label = "More information",
  icon: Icon = HelpCircle,
}: {
  /** The explanation shown on hover or focus. */
  children: ReactNode;
  /** The button's accessible name. Defaults to "More information". */
  label?: string | undefined;
  /** The mark: `HelpCircle` (the default) for help, `Info` for facts about the thing. */
  icon?: LucideIcon | undefined;
}) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label={label}
        className={cn("rounded-full text-fg-subtle transition-colors hover:text-fg", focusRing)}
      >
        <Icon className="size-3.5" />
      </button>
    </Tooltip>
  );
}
