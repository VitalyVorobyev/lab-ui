import { describe, expect, it } from "vitest";

import { toneColor, type MeasureTone } from "./tone";

const TONES: MeasureTone[] = ["signal", "normal", "defect", "warn", "muted"];

describe("toneColor", () => {
  it("maps every tone to its design token", () => {
    expect(TONES.map((tone) => toneColor(tone))).toEqual([
      "var(--signal)",
      "var(--normal)",
      "var(--defect)",
      "var(--warn)",
      "var(--fg-subtle)",
    ]);
  });

  // The whole domain, exhaustively: a given tone always wins over the fallback, and an absent
  // one is the fallback's colour.
  it.each(TONES.flatMap((tone) => TONES.map((fallback) => [tone, fallback] as const)))(
    "tone %s with fallback %s",
    (tone, fallback) => {
      expect(toneColor(tone, fallback)).toBe(toneColor(tone));
      expect(toneColor(undefined, fallback)).toBe(toneColor(fallback));
    },
  );

  it("falls back to the accent", () => {
    expect(toneColor(undefined)).toBe("var(--signal)");
  });

  it("only ever returns a CSS variable reference, so the theme swap needs no re-render", () => {
    for (const tone of TONES) expect(toneColor(tone)).toMatch(/^var\(--[a-z-]+\)$/);
  });
});
