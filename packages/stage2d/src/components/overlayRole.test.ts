import { describe, expect, it } from "vitest";

import { OVERLAY_ROLES, OVERLAY_STATE_OPACITY, OVERLAY_STATE_WIDTH, overlayRole } from "./overlayRole";

describe("overlayRole", () => {
  it("is a reference to the stage stylesheet's role token", () => {
    expect(OVERLAY_ROLES.map(overlayRole)).toEqual([
      "var(--stage-feature)",
      "var(--stage-model)",
      "var(--stage-structure)",
      "var(--stage-selection)",
      "var(--stage-label)",
      "var(--stage-halo)",
    ]);
  });

  it("orders the state widths as the overlay grammar does", () => {
    expect(OVERLAY_STATE_WIDTH.default).toBe(1.5);
    expect(OVERLAY_STATE_WIDTH.hover).toBe(2);
    expect(OVERLAY_STATE_WIDTH.selected).toBe(2.5);
    expect(OVERLAY_STATE_OPACITY.dimmed).toBe(0.35);
  });
});
