/*
 * The two binary controls, and the difference between them.
 *
 * A `Switch` changes how the thing behaves from now on -- "allow downloads", "show the
 * mask", "lock the caliper axis" -- and reads as a setting. A `Checkbox` asserts something
 * about a state you are about to commit -- "I have read the warnings", "keep this channel"
 * -- and reads as a statement.
 */

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import * as RadixSwitch from "@radix-ui/react-switch";
import { Check, Minus } from "lucide-react";
import { useId, type MouseEvent, type ReactNode } from "react";

import { useFieldDescription } from "./Field";
import { cn, focusRing } from "./cn";

/**
 * A setting: changes how the thing behaves from now on, and reads as one ("show the mask").
 * Always labelled; the label and the description sit beside the switch.
 *
 * Controlled. Radix exposes `data-state` (`checked`/`unchecked`) and `data-disabled`.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}: {
  /** Whether it is on. */
  checked: boolean;
  /** Called with the new state. */
  onCheckedChange: (checked: boolean) => void;
  /** What the setting is. */
  label: ReactNode;
  /** What turning it on does. */
  description?: ReactNode;
  /** Blocks the switch. */
  disabled?: boolean | undefined;
  /** Merged with the row's own classes through `cn`. */
  className?: string | undefined;
}) {
  const descriptionId = useId();
  return (
    <label className={cn("flex min-w-0 items-start gap-2.5", className)}>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "mt-0.5 h-4 w-7 shrink-0 rounded-full border border-line-strong bg-raised transition-colors",
          "data-[state=checked]:border-signal data-[state=checked]:bg-signal",
          "disabled:cursor-not-allowed disabled:opacity-50",
          focusRing,
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            "block size-3 rounded-full bg-fg-subtle transition-transform will-change-transform",
            "translate-x-0.5 data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-signal-fg",
          )}
        />
      </RadixSwitch.Root>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm leading-tight text-fg">{label}</span>
        {description && (
          <span id={descriptionId} className="text-xs leading-snug text-fg-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/**
 * A statement about a state you are about to commit ("keep this channel"). With a `label`
 * it renders its own row; without one it is a bare box (give it `aria-label`, e.g. in a
 * table cell).
 *
 * Controlled. Radix exposes `data-state` (`checked`/`unchecked`/`indeterminate`) and
 * `data-disabled`; inside a `Field` it is described by the field's description and error.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  onClick,
  label,
  description,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: {
  /** `"indeterminate"` for a partial selection over a set. */
  checked: boolean | "indeterminate";
  /** Called with the new state (never `"indeterminate"`: a click resolves it). */
  onCheckedChange: (checked: boolean) => void;
  /**
   * For a checkbox whose meaning depends on the modifier keys — extending a range with
   * shift, toggling one out of a selection with the platform key. `onCheckedChange` gets a
   * boolean and cannot carry them. Keyboard activation synthesises a click with its
   * modifiers intact, so this sees both input paths.
   */
  onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  /** What checking it asserts. Omit for a bare box. */
  label?: ReactNode;
  /** More about the statement, under the label. */
  description?: ReactNode;
  /** Blocks the box. */
  disabled?: boolean | undefined;
  /** For a checkbox in a table cell, where the row is the label. */
  "aria-label"?: string | undefined;
  /** Merged with the row's (or, without a label, the box's) own classes through `cn`. */
  className?: string | undefined;
}) {
  const descriptionId = useId();
  const described = useFieldDescription(description ? descriptionId : undefined);
  const box = (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...described}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[0.25rem] border border-line-strong bg-raised transition-colors",
        "data-[state=checked]:border-signal data-[state=checked]:bg-signal",
        "data-[state=indeterminate]:border-signal data-[state=indeterminate]:bg-signal",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        label === undefined && className,
      )}
    >
      <RadixCheckbox.Indicator className="text-signal-fg">
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );

  if (label === undefined) return box;

  return (
    <label className={cn("flex min-w-0 items-start gap-2.5", className)}>
      <span className="mt-0.5">{box}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm leading-tight text-fg">{label}</span>
        {description && (
          <span id={descriptionId} className="text-xs leading-snug text-fg-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
