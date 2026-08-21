/**
 * Text entry.
 *
 * `controlClasses` is exported so a native control that isn't one of the wrapped ones below
 * can still pick up the shared palette and focus treatment.
 */

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { byDensity, useDensity } from "./Density";
import { cn, focusRingInset } from "./cn";

export const controlClasses = cn(
  "w-full rounded-control border border-line-strong bg-raised px-2.5 text-sm text-fg",
  "placeholder:text-fg-subtle",
  "transition-colors hover:border-fg-subtle",
  "disabled:cursor-not-allowed disabled:opacity-50",
  focusRingInset,
);

/** @deprecated Use `Input`, `NumberInput`, `Textarea` or `Select`. */
export const inputClasses = controlClasses;

/** The control height in force — exported so an app's own native control can match. */
export function useControlHeight(): string {
  return byDensity(useDensity(), "h-8", "h-7");
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(controlClasses, useControlHeight(), className)} />;
}

/**
 * A number, with the schema's own bounds attached.
 *
 * `font-mono` because these are read as quantities and compared down a column.
 */
export function NumberInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { min?: number; max?: number }) {
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      className={cn(controlClasses, useControlHeight(), "font-mono tabular-nums", className)}
    />
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(controlClasses, "py-1.5 font-mono", className)} />;
}
