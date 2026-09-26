/*
 * A continuous value, with its number always on screen.
 *
 * A slider that drives what you are looking at -- a results threshold, an overlay opacity,
 * a caliper search range -- is a measurement instrument: the number matters as much as the
 * position, so it is rendered beside the track rather than left to a separate line of prose.
 */

import * as RadixSlider from "@radix-ui/react-slider";
import type { ReactNode } from "react";

import { useFieldDescription } from "./Field";
import { cn, focusRing } from "./cn";

/**
 * A continuous value, with its number rendered beside the track.
 *
 * Controlled. The name (`aria-label`) and a surrounding `Field`'s description go on the
 * thumb — the element with `role="slider"` that a keyboard and a screen reader operate.
 * Radix exposes `data-disabled` and `data-orientation` on the parts.
 */
export function Slider({
  value,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 1,
  step = 0.01,
  readout,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-describedby": ownDescribedBy,
  className,
}: {
  /** The current value. */
  value: number;
  /** Called on every move. */
  onValueChange: (value: number) => void;
  /** Called once when a drag or a key press ends — for updates too expensive to run per move. */
  onValueCommit?: ((value: number) => void) | undefined;
  /** Defaults to 0. */
  min?: number | undefined;
  /** Defaults to 1. */
  max?: number | undefined;
  /** Defaults to 0.01. */
  step?: number | undefined;
  /** Rendered to the right of the track. Give it a fixed-width mono span for stability. */
  readout?: ReactNode;
  /** Blocks the thumb and dims the track. */
  disabled?: boolean | undefined;
  /** Names the slider (set on the thumb). */
  "aria-label"?: string | undefined;
  /** Ids of elements describing the slider, merged with a surrounding `Field`'s. */
  "aria-describedby"?: string | undefined;
  /** Merged with the row's own classes through `cn`. */
  className?: string | undefined;
}) {
  const described = useFieldDescription(ownDescribedBy);

  return (
    // Grows by default: a slider that does not fill the space it is given collapses to a
    // few pixels of track, which is unusable and reads as a rendering fault.
    <div className={cn("flex min-w-0 flex-1 items-center gap-3", className)}>
      <RadixSlider.Root
        value={[value]}
        onValueChange={([next]) => next !== undefined && onValueChange(next)}
        onValueCommit={([next]) => next !== undefined && onValueCommit?.(next)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          "relative flex h-5 min-w-0 flex-1 touch-none items-center select-none",
          "data-disabled:opacity-50",
        )}
      >
        <RadixSlider.Track className="relative h-1 grow overflow-hidden rounded-full bg-line">
          <RadixSlider.Range className="absolute h-full bg-signal" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-label={ariaLabel}
          {...described}
          className={cn(
            "block size-3.5 rounded-full border-2 border-signal bg-surface transition-shadow",
            "hover:shadow-[0_0_0_4px] hover:shadow-signal/20",
            "disabled:cursor-not-allowed",
            focusRing,
          )}
        />
      </RadixSlider.Root>
      {readout && (
        <span className="shrink-0 font-mono text-xs text-fg tabular-nums">{readout}</span>
      )}
    </div>
  );
}
