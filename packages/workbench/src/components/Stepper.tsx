/*
 * A gated sequence of steps — Teach, then Find, then Verify — where a step can be entered
 * only once what it depends on is in place, and says what that is.
 *
 * A disabled button would say nothing: it cannot be focused, so neither the tooltip nor a
 * screen reader can give the reason. A blocked step stays focusable, marked
 * `aria-disabled`, and carries its reason as its description.
 */

import { Check, Lock } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Tooltip, cn, focusRing } from "@vitavision/ui";

import { stepStates, type StepState } from "./stepperModel";

/** One step of a `Stepper`. */
export interface StepperStep {
  /** Its identity, unique among the steps; the stepper's `value`. */
  id: string;
  /** Its name. */
  label: ReactNode;
  /**
   * Why it cannot be entered yet — "Teach a model first". A step with a reason is blocked:
   * shown, focusable and described by the reason, but not choosable.
   */
  blockedBy?: string | undefined;
  /** Marks it done (a check instead of its number). */
  complete?: boolean | undefined;
}

/** Props of `Stepper`. */
export interface StepperProps {
  /** The steps, in order. */
  steps: readonly StepperStep[];
  /** The current step's id, or `null` for none. Leave undefined to let the stepper keep it. */
  value?: string | null | undefined;
  /** The current step at first, when the stepper keeps it. Defaults to the first step. */
  defaultValue?: string | undefined;
  /** Called with a step's id when a person chooses a step that is neither current nor blocked. */
  onValueChange?: ((id: string) => void) | undefined;
  /** A row (the default) or a column. */
  orientation?: "horizontal" | "vertical" | undefined;
  /** Names the list of steps. */
  "aria-label": string;
  /** Merged with the list's own classes through `cn`. */
  className?: string | undefined;
}

/**
 * The steps of a gated sequence as an ordered list of buttons, numbered, with the current one
 * marked (`aria-current="step"`) and done ones checked. Controlled with `value` and
 * `onValueChange`, or kept by the stepper from `defaultValue`.
 *
 * A step with `blockedBy` is blocked: it keeps its Tab stop but carries `aria-disabled`, its
 * reason is its description (`aria-describedby`) and its tooltip, and choosing it does nothing.
 * Each step carries `data-state` (`current`, `complete`, `blocked` or `upcoming`), and the
 * list `data-orientation`.
 */
export function Stepper({
  steps,
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  "aria-label": ariaLabel,
  className,
}: StepperProps) {
  const [kept, setKept] = useState<string | null>(() => defaultValue ?? steps[0]?.id ?? null);
  const current = value === undefined ? kept : value;
  const views = stepStates(steps, current);
  const baseId = useId();
  const vertical = orientation === "vertical";

  const choose = (id: string) => {
    if (value === undefined) setKept(id);
    onValueChange?.(id);
  };

  return (
    <ol
      aria-label={ariaLabel}
      data-orientation={orientation}
      className={cn("flex", vertical ? "flex-col items-start" : "flex-wrap items-center gap-y-1", className)}
    >
      {steps.map((step, index) => {
        const view = views[index];
        if (view === undefined) return null;
        const { state, canActivate } = view;
        const blocked = state === "blocked";
        const reasonId = `${baseId}-${index}-reason`;
        const button = (
          <button
            type="button"
            aria-current={state === "current" ? "step" : undefined}
            aria-disabled={blocked ? true : undefined}
            aria-describedby={blocked ? reasonId : undefined}
            data-state={state}
            onClick={() => {
              if (canActivate) choose(step.id);
            }}
            className={cn(
              "flex items-center gap-2 rounded-control px-1.5 py-1 text-sm transition-colors",
              state === "current" ? "font-medium text-fg" : "text-fg-muted",
              canActivate && "hover:text-fg",
              blocked && "cursor-not-allowed",
              focusRing,
            )}
          >
            <StepMarker state={state} number={index + 1} />
            <span>{step.label}</span>
          </button>
        );
        return (
          <li key={step.id} className={cn("flex", vertical ? "flex-col items-start" : "items-center")}>
            {index > 0 && (
              <span
                aria-hidden
                className={cn("bg-line-strong", vertical ? "ml-4 h-3 w-px" : "mx-1 h-px w-6")}
              />
            )}
            {blocked ? <Tooltip content={step.blockedBy}>{button}</Tooltip> : button}
            {blocked && (
              <span id={reasonId} className="sr-only">
                {step.blockedBy}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The step's number in a circle; a check when done, a lock when blocked. Decorative. */
function StepMarker({ state, number }: { state: StepState; number: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[11px] tabular-nums [&>svg]:size-3",
        state === "current" && "border-signal bg-signal text-signal-fg",
        state === "complete" && "border-signal text-signal",
        state === "blocked" && "border-line-strong text-fg-muted",
        state === "upcoming" && "border-line-strong text-fg-muted",
      )}
    >
      {state === "complete" ? <Check /> : state === "blocked" ? <Lock /> : number}
    </span>
  );
}
