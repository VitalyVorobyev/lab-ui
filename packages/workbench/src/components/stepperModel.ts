/*
 * What each step of a `Stepper` is, as a pure function, so the rules (a blocked step cannot
 * be entered, the current step outranks every other state) are tested without a DOM.
 */

/**
 * Where a step stands: `current` (the one a person is on), `blocked` (cannot be entered
 * yet; it says why), `complete` (done) or `upcoming` (not done, and open).
 */
export type StepState = "current" | "complete" | "blocked" | "upcoming";

/** The part of a step its state depends on. */
export interface StepGate {
  /** Its identity, unique among the steps. */
  id: string;
  /** Why it cannot be entered yet. A step with a non-empty reason is blocked. */
  blockedBy?: string | undefined;
  /** Whether it is done. */
  complete?: boolean | undefined;
}

/** One step's state, and whether choosing it would make it current. */
export interface StepView {
  /** The step's id. */
  id: string;
  /** Where the step stands. */
  state: StepState;
  /** True when choosing it makes it current: it is neither blocked nor current already. */
  canActivate: boolean;
}

/**
 * Each step's state, in order.
 *
 * The step whose id is `current` is `current`, whatever else is true of it: the app put the
 * person there. Of the others, one with a `blockedBy` reason is `blocked` (even if `complete`:
 * a step can be done and then fall behind a newer gate), then `complete`, then `upcoming`.
 * Only a step that is neither current nor blocked can be activated.
 *
 * @param steps - The steps, in order.
 * @param current - The current step's id, or `null` for none.
 */
export function stepStates(steps: readonly StepGate[], current: string | null): StepView[] {
  return steps.map(({ id, blockedBy, complete }) => {
    const state: StepState =
      id === current ? "current" : blockedBy ? "blocked" : complete ? "complete" : "upcoming";
    return { id, state, canActivate: state === "complete" || state === "upcoming" };
  });
}
