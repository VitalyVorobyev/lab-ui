// @vitest-environment node
/**
 * The categorical series palette against the checks it was chosen by (styles.css, and
 * docs/visual-language.md §4), in both themes: each slot ≥ 3:1 on the panel and the page
 * (WCAG 1.4.11, so a 1.5 px line shows), and every pair ≥ 9.4 OKLab ΔE×100 apart for a
 * reader with protanopia, deuteranopia or tritanopia.
 */

import { readFileSync } from "node:fs";

import { contrast, cssTokens, worstDeltaE } from "@vitavision/config-vitest/colour";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const series = read("./styles.css");
// The surfaces are the ui package's tokens: the charts draw on its panels.
const chrome = read("../../ui/src/styles.css");

const THEMES = [
  ["light", ":root"],
  ["dark", ".dark"],
] as const;

describe.each(THEMES)("series palette — %s theme", (_theme, selector) => {
  const tokens = cssTokens(series, selector);
  const surfaces = cssTokens(chrome, selector);
  const slots = Array.from({ length: 6 }, (_, i) => [`series-${i + 1}`, tokens[`series-${i + 1}`] ?? ""] as const);

  it("defines six slots", () => {
    expect(slots.every(([, hex]) => /^#[0-9a-f]{6}$/i.test(hex))).toBe(true);
  });

  it.each(slots)("%s is ≥ 3:1 on surface and ground", (_name, hex) => {
    for (const surface of ["surface", "ground"]) {
      expect(contrast(hex, surfaces[surface] ?? "")).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every pair ≥ 9.4 apart under every dichromacy", () => {
    const close = slots.flatMap(([a, x], i) =>
      slots.slice(i + 1).flatMap(([b, y]) => {
        const d = worstDeltaE(x, y);
        return d < 9.4 ? [`${a} / ${b}: ${d.toFixed(1)}`] : [];
      }),
    );
    expect(close).toEqual([]);
  });
});
