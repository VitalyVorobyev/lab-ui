/*
 * Text entry.
 *
 * `controlClasses` is exported so a native control that isn't one of the wrapped ones below
 * can still pick up the shared palette and focus treatment.
 */

import { useId, useState, type ComponentProps, type KeyboardEvent } from "react";

import { byDensity, useDensity } from "./Density";
import { useFieldDescription } from "./Field";
import { cn, focusRingInset } from "./cn";
import { formatNumber, parseNumber } from "./numberText";

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
 * Props of `NumberInput`: every `<input>` prop, `ref` included, with numeric bounds, a `unit`,
 * and an optional number-valued API (`onValueChange`, `precision`).
 */
export type NumberInputProps = Omit<ComponentProps<"input">, "min" | "max" | "value"> & {
  /**
   * The value. As text, it is the native input's `value`. With `onValueChange` it is a
   * number, and `null` is an empty field.
   */
  value?: string | number | readonly string[] | null | undefined;
  /**
   * Makes the field number-valued.
   *
   * - **While focused** it keeps the text as typed, and reports every keystroke that parses to
   *   a new number. Empty or partial text (`""`, `-`, `1e`) is never reported mid-edit, so
   *   clearing a field to retype it does not pass through 0.
   * - **Enter** shows the value at `precision`. **Escape** restores the value the field had
   *   on focus.
   * - **Leaving** the field, or pressing Enter, with the text empty reports `null`. A caller
   *   that has no empty value ignores it, and the field shows the value it was given again.
   */
  onValueChange?: ((value: number | null) => void) | undefined;
  /**
   * Decimals shown when a number-valued field is not being edited. Without it the number is
   * shown as JavaScript prints it.
   */
  precision?: number | undefined;
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
 *
 * With `onValueChange` the field is number-valued: `value` is a number (or `null`), the typed
 * text survives while the field has focus, and only parsed numbers are reported (see
 * `onValueChange`). Without it the field is the native text-valued input.
 */
export function NumberInput({ onValueChange, precision, ...props }: NumberInputProps) {
  if (onValueChange) {
    return <ValueNumberInput {...props} onValueChange={onValueChange} precision={precision} />;
  }
  const { unit, ...rest } = props;
  // A `null` text value is an empty field, not a switch to uncontrolled.
  const text = (rest.value === null ? { ...rest, value: "" } : rest) as TextNumberInputProps;
  return unit === undefined || unit === "" ? (
    <PlainNumberInput {...text} />
  ) : (
    <UnitNumberInput unit={unit} {...text} />
  );
}

type TextNumberInputProps = Omit<NumberInputProps, "unit" | "value" | "onValueChange" | "precision"> & {
  value?: string | number | readonly string[] | undefined;
};

/** The number-valued field: formatted at rest, the typed text while focused. */
function ValueNumberInput({
  value,
  onValueChange,
  precision,
  step,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
  ...rest
}: Omit<NumberInputProps, "onValueChange"> & { onValueChange: (value: number | null) => void }) {
  const numeric = typeof value === "number" ? value : null;
  const show = (v: number | null) =>
    v === null ? "" : precision === undefined ? String(v) : formatNumber(v, precision);
  // Non-null while the field is being edited: the text as typed, and the value on focus.
  const [draft, setDraft] = useState<{ text: string; initial: number | null } | null>(null);

  /** Reports an emptied field once, on commit, and only if it was not already empty. */
  const commitEmpty = (text: string) => {
    if (text.trim() === "" && numeric !== null) onValueChange(null);
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (draft && event.key === "Enter") {
      commitEmpty(draft.text);
      setDraft({ ...draft, text: draft.text.trim() === "" ? "" : show(numeric) });
    } else if (draft && event.key === "Escape") {
      event.preventDefault();
      if (draft.initial !== numeric) onValueChange(draft.initial);
      setDraft({ ...draft, text: show(draft.initial) });
    }
    onKeyDown?.(event);
  };

  return (
    <NumberInput
      {...rest}
      value={draft?.text ?? show(numeric)}
      step={step ?? "any"}
      onFocus={(event) => {
        setDraft({ text: show(numeric), initial: numeric });
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (draft) commitEmpty(draft.text);
        setDraft(null);
        onBlur?.(event);
      }}
      onKeyDown={keyDown}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft((current) => ({ text, initial: current?.initial ?? numeric }));
        const parsed = parseNumber(text);
        if (parsed !== null && parsed !== numeric) onValueChange(parsed);
        onChange?.(event);
      }}
    />
  );
}

function PlainNumberInput({
  className,
  "aria-describedby": describedBy,
  ...rest
}: TextNumberInputProps) {
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
}: TextNumberInputProps & { unit: string }) {
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
