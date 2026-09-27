/*
 * Text entry.
 *
 * `controlClasses` is exported so a native control that isn't one of the wrapped ones below
 * can still pick up the shared palette and focus treatment.
 */

import { useId, type ComponentProps } from "react";

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

/** Props of `NumberInput`: every `<input>` prop, `ref` included, with numeric bounds and a `unit`. */
export type NumberInputProps = Omit<ComponentProps<"input">, "min" | "max"> & {
  /** The smallest accepted value. */
  min?: number | undefined;
  /** The largest accepted value. */
  max?: number | undefined;
  /**
   * The quantity's unit (`mm`, `m`, `°`, `px`), written inside the field after the number, in
   * mono and muted. It is not part of the value. It is announced as the field's description
   * (`aria-describedby`): after the caller's own `aria-describedby`, before a surrounding
   * `Field`'s description and error.
   */
  unit?: string | undefined;
};

/**
 * A number, with the schema's own bounds attached and, optionally, its unit written in the
 * field.
 *
 * `font-mono` because these are read as quantities and compared down a column. Takes every
 * `<input>` prop, `ref` included (`type` is always `number`); `className`, `style` and `ref`
 * always go to the `<input>`.
 *
 * With a `unit`, the input sits in a `relative` full-width wrapper carrying `data-unit`, keeps
 * room on its right for the unit, and is described by it; size such a field through its
 * container. Without one — or with `""` — the markup is exactly the plain input.
 */
export function NumberInput({ unit, ...props }: NumberInputProps) {
  return unit === undefined || unit === "" ? (
    <PlainNumberInput {...props} />
  ) : (
    <UnitNumberInput unit={unit} {...props} />
  );
}

function PlainNumberInput({
  className,
  "aria-describedby": describedBy,
  ...rest
}: Omit<NumberInputProps, "unit">) {
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

/*
 * A component of its own so that only a field with a unit calls `useId`: a plain
 * `NumberInput` stays byte-identical to the one before `unit` existed, down to the ids React
 * hands the elements rendered after it.
 */
function UnitNumberInput({
  unit,
  style,
  "aria-describedby": describedBy,
  ...rest
}: Omit<NumberInputProps, "unit"> & { unit: string }) {
  const unitId = useId();
  return (
    <span data-unit={unit} className="relative flex w-full min-w-0 items-center">
      <PlainNumberInput
        {...rest}
        aria-describedby={describedBy ? `${describedBy} ${unitId}` : unitId}
        // Room for the unit: its width in the unit's own characters, plus the field's padding.
        style={{ paddingInlineEnd: `calc(${unit.length}ch + 1rem)`, ...style }}
      />
      {/* `aria-hidden` keeps the unit out of the field's *name* when a `<label>` wraps it;
          `aria-describedby` still reads it, as the description. */}
      <span
        id={unitId}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-fg-subtle select-none"
      >
        {unit}
      </span>
    </span>
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
