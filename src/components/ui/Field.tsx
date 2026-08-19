/**
 * A labelled control.
 *
 * Two things a naive label cannot express, both of which the schema form needs. A required
 * field's marker is a separate span rather than text concatenated onto the label string, so
 * it can be styled, read out as a marker, or dropped. And a field's description is wired to
 * the control through `aria-describedby`, so a screen reader connects the two.
 *
 * `as="group"` exists because a `<label>` cannot label a set of radios or a segmented
 * control; that case needs a labelled group instead, and getting it wrong is the difference
 * between a control that announces itself and one that announces nothing.
 */

import { useId, type ReactNode } from "react";

import { cn } from "./cn";

export function Field({
  label,
  description,
  error,
  required = false,
  /** A compact fact about the accepted values -- a range, a unit -- kept out of the prose. */
  annotation,
  as = "label",
  className,
  children,
}: {
  label: string;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  annotation?: ReactNode;
  as?: "label" | "group";
  className?: string;
  children: ReactNode;
}) {
  const describedBy = useId();
  const Wrapper = as === "label" ? "label" : "div";

  return (
    <Wrapper
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      {...(as === "group" ? { role: "group", "aria-label": label } : {})}
    >
      <span className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-fg">
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

      {children}

      {description && (
        <span id={describedBy} className="text-xs leading-snug text-fg-muted">
          {description}
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs leading-snug text-defect">
          {error}
        </span>
      )}
    </Wrapper>
  );
}
