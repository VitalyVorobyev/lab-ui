/*
 * A dense on/off control for a thing that is drawn on screen.
 *
 * `Switch` is a settings row — a stacked label, a description, generous padding — and
 * three of them side by side over an image canvas is a panel, not a toolbar. This is the
 * same binary decision in the space a toolbar has: one line, one target, and an optional
 * swatch carrying the colour the layer is actually drawn in — an overlay's caliper boxes,
 * a chart's series — so the legend and the control are the same object rather than two
 * things to reconcile.
 *
 * Hand-built on a native `button` with `role="switch"`: this is not one of the four Radix
 * primitives the rest of the toggle vocabulary is built on, and a chip does not need one.
 */

import type { ReactNode } from "react";

import type { ButtonSize } from "./Button";
import { cn, focusRing } from "./cn";

/**
 * The chip's box, by size. `sm` is the toolbar size and the default. `md` sets the height
 * explicitly (`h-8`, border included) rather than leaving it to padding plus line-height.
 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-xs",
  md: "h-8 px-3 text-sm",
};

/** The swatch dot, by size: a little larger beside `text-sm` so it keeps its weight against the label. */
const SWATCH_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "size-2",
  md: "size-2.5",
};

/**
 * A dense on/off chip for a layer drawn on screen, with an optional swatch in the layer's
 * colour: a toolbar-sized `Switch` (`role="switch"`, `aria-checked`).
 *
 * Controlled. State is exposed as `data-state` (`checked`/`unchecked`).
 *
 * Toolbar-sized by default. In a row with a comfortable-density `Input`, `Select` or
 * `Button`, pass `size="md"` and the chip's outer height matches theirs.
 */
export function ToggleChip({
  checked,
  onCheckedChange,
  children,
  swatch,
  disabled = false,
  title,
  size = "sm",
  className,
}: {
  /** Whether the layer is shown. */
  checked: boolean;
  /** Called with the new state. */
  onCheckedChange: (checked: boolean) => void;
  /** The layer's name. */
  children: ReactNode;
  /** A CSS colour: the colour this layer is drawn in, shown as a dot. */
  swatch?: string;
  /** Blocks the chip. */
  disabled?: boolean | undefined;
  /** Why the control is disabled, or what the layer is. Never the only explanation. */
  title?: string | undefined;
  /**
   * The chip's height: `sm` (the default) is the toolbar size, about 26px with `text-xs`
   * text; `md` is exactly 32px (`h-8`) outside, border included, with `text-sm` text and a
   * slightly larger swatch, the height of a comfortable-density `Input` or `Button`. Not
   * derived from the density in force, so a consumer that never passes it renders as it
   * always did.
   */
  size?: ButtonSize | undefined;
  /** Merged with the chip's own classes through `cn`. */
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      title={title}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border",
        SIZE_CLASSES[size],
        "whitespace-nowrap transition-colors",
        checked
          ? "border-line-strong bg-raised text-fg"
          : "border-line bg-transparent text-fg-muted hover:text-fg",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-fg-muted",
        focusRing,
        className,
      )}
    >
      {swatch !== undefined && (
        <span
          aria-hidden
          className={cn(
            SWATCH_SIZE_CLASSES[size],
            "shrink-0 rounded-full border transition-opacity",
            checked ? "opacity-100" : "opacity-30",
          )}
          style={{ backgroundColor: swatch, borderColor: swatch }}
        />
      )}
      {children}
    </button>
  );
}
