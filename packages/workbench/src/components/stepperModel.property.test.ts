/**
 * Property tests for `stepStates`: laws that hold for any steps and any current id, not just
 * the examples in `stepperModel.test.ts`.
 *
 * Inputs come from a seeded PRNG, so a failure reproduces exactly; the failing input is in
 * the assertion message.
 */

import { describe, expect, it } from "vitest";

import { stepStates, type StepGate } from "./stepperModel";

const RUNS = 500;

/** mulberry32 — small, fast, and good enough to spread test inputs. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Up to eight steps with unique ids, each maybe blocked (an empty reason counts as none) and maybe complete. */
function anySteps(random: () => number): StepGate[] {
  const count = Math.floor(random() * 9);
  return Array.from({ length: count }, (_, i) => {
    const gate = random();
    return {
      id: `s${i}`,
      blockedBy: gate < 0.3 ? "Not yet" : gate < 0.4 ? "" : undefined,
      complete: random() < 0.4,
    };
  });
}

/** One of the steps' ids, an unknown id, or none. */
function anyCurrent(random: () => number, steps: StepGate[]): string | null {
  const pick = random();
  if (pick < 0.1) return null;
  if (pick < 0.2) return "unknown";
  return steps[Math.floor(random() * steps.length)]?.id ?? null;
}

describe("stepStates laws", () => {
  it("keeps the steps' order, one view per step", () => {
    const random = prng(1);
    for (let run = 0; run < RUNS; run++) {
      const steps = anySteps(random);
      const views = stepStates(steps, anyCurrent(random, steps));
      expect(views.map((view) => view.id), JSON.stringify(steps)).toEqual(steps.map((step) => step.id));
    }
  });

  it("has one current step exactly when the current id is a step's, and it is that step", () => {
    const random = prng(2);
    for (let run = 0; run < RUNS; run++) {
      const steps = anySteps(random);
      const current = anyCurrent(random, steps);
      const currents = stepStates(steps, current).filter((view) => view.state === "current");
      const known = steps.some((step) => step.id === current);
      expect(currents.map((view) => view.id), JSON.stringify({ steps, current })).toEqual(known ? [current] : []);
    }
  });

  it("blocks exactly the non-current steps with a reason, and activates exactly the open ones", () => {
    const random = prng(3);
    for (let run = 0; run < RUNS; run++) {
      const steps = anySteps(random);
      const current = anyCurrent(random, steps);
      stepStates(steps, current).forEach((view, i) => {
        const step = steps[i]!;
        const context = JSON.stringify({ step, current });
        expect(view.state === "blocked", context).toBe(step.id !== current && Boolean(step.blockedBy));
        expect(view.canActivate, context).toBe(view.state === "complete" || view.state === "upcoming");
        if (view.state === "complete") expect(step.complete, context).toBe(true);
      });
    }
  });
});
