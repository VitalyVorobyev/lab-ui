/**
 * What a field shows beyond its control: whether it differs from the form's baseline (a rule
 * at its edge, a "changed" note that says what it was, and a reset), and the app's message
 * for it.
 *
 * The note sits under the control, outside the field's `<label>`: a button inside a label
 * would be part of the control's name. It is the field's description, so a reader hears it
 * with the control.
 */

import { cn, focusRing } from "@vitavision/ui";
import { use, type ReactNode } from "react";

import { describeValue } from "../../api/valueDiff";
import { getAtPath } from "../../api/valuePath";
import type { FieldMeta } from "./chrome";
import { DenseContext, useForm, type FieldMessage } from "./context";

/** A thin rule in the gutter beside a changed field: a scan cue that is not the only one, since the note says it in words. */
const CHANGED_RULE =
  "relative before:absolute before:-left-2.5 before:top-0.5 before:bottom-0.5 before:w-0.5 before:rounded-full before:bg-signal";

/** A message as `{ severity, text }`: a bare string is an error. */
function normalise(message: FieldMessage | string | undefined): FieldMessage | undefined {
  if (message === undefined) return undefined;
  return typeof message === "string" ? { severity: "error", text: message } : message;
}

/** What a field adds to its `Field` or switch. */
export interface FieldExtras {
  /** Classes for the field's root: the rule beside a changed field. */
  className: string | undefined;
  /** Whether the field, or anything under it, differs from the baseline. */
  changed: boolean;
  /** The app's error message for the field. */
  error: string | undefined;
  /** The changed note and the app's warning, to follow the field's description. */
  notes: ReactNode;
}

/**
 * The baseline comparison and the app's message for one field.
 *
 * @param meta - The field.
 * @returns Its extras; all empty for a form with no baseline and no message.
 */
export function useFieldExtras(meta: FieldMeta): FieldExtras {
  const form = useForm();
  // A cell of a tuple row has no room for a note of its own: the rule marks it, and the row's frame carries the reset.
  const dense = use(DenseContext);
  const changes = form.baseline?.counts.get(meta.path) ?? 0;
  const message = normalise(form.messages?.[meta.path]);
  const warning = message?.severity === "warning" ? message.text : undefined;
  const notes =
    (changes > 0 && !dense) || warning !== undefined ? (
      <>
        {warning !== undefined && (
          <span data-message="warning" className="mt-0.5 block text-warn">
            {warning}
          </span>
        )}
        {changes > 0 && !dense && <ChangeNote meta={meta} count={changes} />}
      </>
    ) : undefined;
  return {
    className: changes > 0 ? CHANGED_RULE : undefined,
    changed: changes > 0,
    error: message?.severity === "error" ? message.text : undefined,
    notes,
  };
}

/** An error message where the control has no error slot of its own (a switch). */
export function ErrorText({ text }: { text: string }) {
  return (
    <span role="alert" data-message="error" className="block text-defect">
      {text}
    </span>
  );
}

/** A description and the extras' notes, as one `Field` description (`undefined` when both are empty). */
export function withNotes(description: ReactNode, notes: ReactNode): ReactNode {
  const has = description !== undefined && description !== null && description !== false && description !== "";
  if (!has) return notes;
  return notes === undefined ? (
    description
  ) : (
    <>
      {description}
      {notes}
    </>
  );
}

/** The "changed" marker with what the baseline had, and the button that puts it back. */
export function ChangeNote({ meta, count }: { meta: FieldMeta; count: number }) {
  const form = useForm();
  const was = getAtPath(form.baseline?.value, meta.path);
  const composite = typeof was === "object" && was !== null;
  return (
    <span data-change-note="" className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] leading-snug">
      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-signal">
        <span aria-hidden className="size-1.5 rounded-full bg-signal" />
        {composite && count > 1 ? `${count} changed` : "changed"}
      </span>
      {!composite && (
        <span className="min-w-0 truncate text-fg-muted">
          was <span className="font-mono">{describeValue(was)}</span>
        </span>
      )}
      <ResetButton meta={meta} />
    </span>
  );
}

/** Puts a field (or a whole block) back to the baseline's value. */
export function ResetButton({ meta, className }: { meta: FieldMeta; className?: string | undefined }) {
  const form = useForm();
  return (
    <button
      type="button"
      data-reset=""
      aria-label={`Reset ${meta.label} to baseline`}
      disabled={form.disabled}
      onClick={() => form.setValue(meta.path, getAtPath(form.baseline?.value, meta.path))}
      className={cn(
        "-my-1 ml-auto shrink-0 cursor-pointer rounded-control px-1 py-1 font-medium text-fg-muted transition-colors",
        "hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        className,
      )}
    >
      Reset
    </button>
  );
}
