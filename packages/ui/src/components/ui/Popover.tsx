/*
 * Floating content anchored to a trigger: a picker, a small form, a list to choose from.
 *
 * A popover is for content a person works in. A *menu* of commands is `DropdownMenu`, and a
 * short explanation is `Tooltip`. It closes on Escape, on a press outside, or when the caller
 * sets `open` to false.
 */

import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Props of `Popover`. */
export interface PopoverProps {
  /**
   * The element that opens it: one focusable element that accepts a ref (Radix `asChild`).
   * It carries `aria-expanded` and `data-state` (`open` / `closed`).
   */
  trigger: ReactNode;
  /** The content. */
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean | undefined;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean | undefined;
  /** Called when it opens or closes. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** The trigger's side it opens on. Defaults to `bottom`. */
  side?: "top" | "right" | "bottom" | "left" | undefined;
  /** Its alignment along that side. Defaults to `start`. */
  align?: "start" | "center" | "end" | undefined;
  /** Names the content (`aria-label`), when nothing inside it does. */
  "aria-label"?: string | undefined;
  /** Merged with the content's own classes through `cn`. */
  className?: string | undefined;
}

/**
 * Floating content anchored to `trigger`, on the `overlay` surface with a shadow (floating
 * layers are the only ones that cast one).
 *
 * Controlled (`open` / `onOpenChange`) or not (`defaultOpen`). Focus moves into the content
 * when it opens and back to the trigger when it closes. Escape and a press outside close it.
 * The content carries `data-state` and `data-side`.
 */
export function Popover({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  side = "bottom",
  align = "start",
  "aria-label": ariaLabel,
  className,
}: PopoverProps) {
  return (
    <RadixPopover.Root
      {...(open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          aria-label={ariaLabel}
          className={cn(
            "z-50 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto",
            "rounded-panel border border-line bg-overlay p-1 text-sm text-fg shadow-lg shadow-black/25",
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

/**
 * Closes the surrounding `Popover` when its child is activated. Wraps one element (Radix
 * `asChild`).
 */
export function PopoverClose({
  children,
}: {
  /** The one element that closes the popover. */
  children: ReactNode;
}) {
  return <RadixPopover.Close asChild>{children}</RadixPopover.Close>;
}
