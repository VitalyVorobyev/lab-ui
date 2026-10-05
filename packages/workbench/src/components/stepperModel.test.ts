import { describe, expect, it } from "vitest";

import { stepStates } from "./stepperModel";

const states = (views: ReturnType<typeof stepStates>) => views.map((view) => view.state);

describe("stepStates", () => {
  it("marks the current step, the complete ones and the upcoming ones", () => {
    const steps = [{ id: "a", complete: true }, { id: "b" }, { id: "c" }];
    expect(states(stepStates(steps, "b"))).toEqual(["complete", "current", "upcoming"]);
  });

  it("blocks a step with a reason, even a complete one, and never lets it be activated", () => {
    const steps = [
      { id: "a" },
      { id: "b", blockedBy: "Teach first", complete: true },
      { id: "c", blockedBy: "Find first" },
    ];
    expect(stepStates(steps, "a")).toEqual([
      { id: "a", state: "current", canActivate: false },
      { id: "b", state: "blocked", canActivate: false },
      { id: "c", state: "blocked", canActivate: false },
    ]);
  });

  it("treats an empty reason as no reason", () => {
    expect(stepStates([{ id: "a", blockedBy: "" }], null)).toEqual([{ id: "a", state: "upcoming", canActivate: true }]);
  });

  it("lets the current step outrank its gate: the app put the person there", () => {
    expect(stepStates([{ id: "a", blockedBy: "Not yet" }], "a")).toEqual([
      { id: "a", state: "current", canActivate: false },
    ]);
  });

  it("activates complete and upcoming steps, and has no current step for an unknown or null value", () => {
    const steps = [{ id: "a", complete: true }, { id: "b" }];
    expect(stepStates(steps, null).map((view) => view.canActivate)).toEqual([true, true]);
    expect(states(stepStates(steps, "zz"))).toEqual(["complete", "upcoming"]);
    expect(stepStates([], "a")).toEqual([]);
  });
});
