/*
 * A labelled control.
 *
 * Two things a naive label cannot express, both of which the schema form needs. A required
 * field's marker is a separate span rather than text concatenated onto the label string, so
 * it can be styled, read out as a marker, or dropped. And a field's description (and its
 * error) is wired to the control through `aria-describedby`, so a screen reader connects
 * the two.
 *
 * `as="group"` exists because a `<label>` cannot label a set of radios or a segmented
 * control; that case needs a labelled group instead, and getting it wrong is the difference
 * between a control that announces itself and one that announces nothing.
 */

import { createContext, use, useId, useMemo, type ReactNode } from "react";

import { byDensity, useDensity } from "./Density";
import { cn } from "./cn";

/** What a `Field` tells the control inside it: the ids that describe it, and whether it is invalid. */
interface FieldControl {
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldControl>({ describedBy: undefined, invalid: false });

/**
 * The `aria-describedby` and `aria-invalid` a control inside a `Field` should carry, merged
 * with the control's own `aria-describedby`. Used by this package's controls; not exported
 * from the package.
 */
export function useFieldDescription(own?: string): {
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
} {
  const { describedBy, invalid } = use(FieldContext);
  const ids = [own, describedBy].filter(Boolean).join(" ");
  return { "aria-describedby": ids === "" ? undefined : ids, "aria-invalid": invalid || undefined };
}

/**
 * A label, the control, and optionally a description, an error and a compact annotation.
 *
 * The label text and the annotation name the control (the `<label>` wraps them and the
 * control); the description and the error are outside the label and wired into the
 * control's `aria-describedby` instead (the error also sets `aria-invalid`): directly for
 * this package's controls — `Input`, `NumberInput`, `Textarea`, `Select`, `Slider`,
 * `SegmentedControl`, `Checkbox` — and, with `as="group"`, on the group itself. A control of your own inside a `label` field does not
 * pick them up; give it `aria-describedby` yourself. State is exposed as `data-invalid` and
 * `data-required`.
 */
export function Field({
  label,
  description,
  error,
  required = false,
  annotation,
  as = "label",
  className,
  children,
}: {
  /** The field's name, shown above the control. */
  label: string;
  /** What the value means or does. Always visible, and read with the control. */
  description?: ReactNode;
  /** What is wrong with the current value. Shown in the verdict red, announced as an alert. */
  error?: ReactNode;
  /** Marks the field required (a `*` after the label). */
  required?: boolean | undefined;
  /** A compact fact about the accepted values -- a range, a unit -- kept out of the prose. */
  annotation?: ReactNode;
  /**
   * `label` (the default) wraps the control in a `<label>`; `group` renders a
   * `role="group"` named by `label`, for a set of radios or a segmented control.
   */
  as?: "label" | "group";
  /** Merged with the field's own classes through `cn`. */
  className?: string | undefined;
  /** The control. */
  children: ReactNode;
}) {
  const descriptionId = useId();
  const errorId = useId();
  const density = useDensity();

  const hasError = error !== undefined && error !== null && error !== false;
  const describedBy =
    [description ? descriptionId : undefined, hasError ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  // A group carries the description itself; its controls would only repeat it.
  const control = useMemo(
    () => ({ describedBy: as === "label" ? describedBy : undefined, invalid: hasError }),
    [as, describedBy, hasError],
  );

  const gap = byDensity(density, "gap-1.5", "gap-1");

  const labelled = (
    <>
      <span className="flex items-baseline gap-2">
        <span className={cn("font-medium text-fg", byDensity(density, "text-xs", "text-[11px]"))}>
          {label}
          {required && (
            <span className="ml-0.5 text-defect" title="Required">
              *
            </span>
          )}
        </span>
        {annotation && (
          <span className="ml-auto font-mono text-[11px] text-fg-subtle">{annotation}</span>
        )}
      </span>
      <FieldContext value={control}>{children}</FieldContext>
    </>
  );

  return (
    <div
      className={cn("flex min-w-0 flex-col", gap, className)}
      data-invalid={hasError ? "" : undefined}
      data-required={required ? "" : undefined}
      {...(as === "group"
        ? { role: "group", "aria-label": label, "aria-describedby": describedBy }
        : {})}
    >
      {/* The description and the error sit outside the <label>: inside it they would be read
          as part of the control's name as well as its description. */}
      {as === "label" ? (
        <label className={cn("flex min-w-0 flex-col", gap)}>{labelled}</label>
      ) : (
        labelled
      )}

      {description && (
        <span id={descriptionId} className="text-xs leading-snug text-fg-muted">
          {description}
        </span>
      )}
      {hasError && (
        <span id={errorId} role="alert" className="text-xs leading-snug text-defect">
          {error}
        </span>
      )}
    </div>
  );
}
