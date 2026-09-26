/*
 * Text entry.
 *
 * `controlClasses` is exported so a native control that isn't one of the wrapped ones below
 * can still pick up the shared palette and focus treatment.
 */

import type { ComponentProps } from "react";

import { byDensity, useDensity } from "./Density";
import { useFieldDescription } from "./Field";
import { cn, focusRingInset } from "./cn";

/**
 * The shared look of a text-like control — border, palette, placeholder, hover, disabled and
 * focus — for a native control that is not one of `Input`, `NumberInput` or `Textarea`.
 * Add the height with `useControlHeight()`.
 */
export const controlClasses = cn(
  "w-full rounded-control border border-line-strong bg-raised px-2.5 text-sm text-fg",
  "placeholder:text-fg-subtle",
  "transition-colors hover:border-fg-subtle",
  "disabled:cursor-not-allowed disabled:opacity-50",
  focusRingInset,
);

/**
 * The former name of `controlClasses`, kept as an alias for existing consumers.
 *
 * @deprecated Use `Input`, `NumberInput`, `Textarea` or `Select`, or `controlClasses`.
 */
export const inputClasses = controlClasses;

/**
 * The control height in force — exported so an app's own native control can match.
 *
 * @returns A Tailwind height class: `h-8` comfortable, `h-7` compact.
 */
export function useControlHeight(): string {
  return byDensity(useDensity(), "h-8", "h-7");
}

/**
 * A single-line text input. Takes every `<input>` prop, `ref` included; inside a `Field` it
 * is described by the field's description and error.
 */
export function Input({ className, "aria-describedby": describedBy, ...rest }: ComponentProps<"input">) {
  return (
    <input
      {...useFieldDescription(describedBy)}
      {...rest}
      className={cn(controlClasses, useControlHeight(), className)}
    />
  );
}

/**
 * A number, with the schema's own bounds attached.
 *
 * `font-mono` because these are read as quantities and compared down a column. Takes every
 * `<input>` prop, `ref` included (`type` is always `number`).
 */
export function NumberInput({
  className,
  "aria-describedby": describedBy,
  ...rest
}: Omit<ComponentProps<"input">, "min" | "max"> & {
  /** The smallest accepted value. */
  min?: number | undefined;
  /** The largest accepted value. */
  max?: number | undefined;
}) {
  return (
    <input
      {...useFieldDescription(describedBy)}
      {...rest}
      type="number"
      inputMode="decimal"
      className={cn(controlClasses, useControlHeight(), "font-mono tabular-nums", className)}
    />
  );
}

/**
 * Multi-line text — set in mono, for JSON and lists. Takes every `<textarea>` prop, `ref`
 * included.
 */
export function Textarea({
  className,
  "aria-describedby": describedBy,
  ...rest
}: ComponentProps<"textarea">) {
  return (
    <textarea
      {...useFieldDescription(describedBy)}
      {...rest}
      className={cn(controlClasses, "py-1.5 font-mono", className)}
    />
  );
}
