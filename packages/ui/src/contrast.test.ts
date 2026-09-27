// @vitest-environment node
/**
 * Every text/background and UI-boundary pair of the token layer, in both themes, against
 * WCAG 2.2 AA (PLAN L3-2): text ≥ 4.5:1 (1.4.3), and the boundary that identifies a control or
 * its state ≥ 3:1 (1.4.11). The tokens are read from `styles.css` itself, so the test cannot
 * drift from the values it checks.
 */

import { readFileSync } from "node:fs";

import { composite, contrast, cssTokens, worstDeltaE } from "@vitavision/config-vitest/colour";
import { describe, expect, it } from "vitest";

/** Read from disk: a `?raw` import goes through the CSS pipeline and loses the source. */
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

type Theme = "light" | "dark";
type Tokens = Record<string, string>;

const THEMES: Record<Theme, Tokens> = { light: cssTokens(css, ":root"), dark: cssTokens(css, ".dark") };

const SURFACES = ["ground", "surface", "raised", "overlay"] as const;
const VERDICTS = ["normal", "defect", "warn"] as const;

interface Pair {
  what: string;
  fg: string;
  bg: string;
  min: number;
}

/** The pairs the components actually draw, resolved to hex for one theme. */
function pairs(t: Tokens): Pair[] {
  const hex = (name: string): string => {
    const value = t[name];
    if (!value) throw new Error(`token --${name} not found`);
    return value;
  };
  const list: Pair[] = [];
  for (const surface of SURFACES) {
    for (const text of ["fg", "fg-muted", "fg-subtle", "signal"]) {
      list.push({ what: `${text} text on ${surface}`, fg: hex(text), bg: hex(surface), min: 4.5 });
    }
  }
  // Primary button, checked switch/checkbox: signal-fg on the signal fill, resting and hovered.
  list.push({ what: "signal-fg on signal", fg: hex("signal-fg"), bg: hex("signal"), min: 4.5 });
  list.push({ what: "signal-fg on signal-strong", fg: hex("signal-fg"), bg: hex("signal-strong"), min: 4.5 });
  // Badge and Callout tones: the colour as text on its own /12 tint, on a panel and on the page.
  for (const tone of [...VERDICTS, "signal"]) {
    for (const surface of ["surface", "ground"]) {
      const tint = composite(hex(tone), 0.12, hex(surface));
      list.push({ what: `${tone} text on ${tone}/12 over ${surface}`, fg: hex(tone), bg: tint, min: 4.5 });
    }
  }
  // Danger button: defect text on defect/10 over a panel.
  list.push({ what: "defect text on defect/10 over surface", fg: hex("defect"), bg: composite(hex("defect"), 0.1, hex("surface")), min: 4.5 });
  // Boundaries (1.4.11): a control's border against what surrounds it, and the signal
  // colour as focus outline and as the checked fill, against every surface.
  for (const surface of ["ground", "surface", "overlay"]) {
    list.push({ what: `line-strong control border on ${surface}`, fg: hex("line-strong"), bg: hex(surface), min: 3 });
  }
  for (const surface of SURFACES) {
    list.push({ what: `signal (focus, checked) on ${surface}`, fg: hex("signal"), bg: hex(surface), min: 3 });
  }
  return list;
}

describe.each(Object.entries(THEMES) as [Theme, Tokens][])("contrast — %s theme", (_theme, tokens) => {
  it("parses every token", () => {
    expect(Object.keys(tokens).length).toBe(16);
  });

  it.each(pairs(tokens).map((p) => [p.what, p] as const))("%s", (_what, { fg, bg, min }) => {
    const ratio = contrast(fg, bg);
    expect(ratio, `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`).toBeGreaterThanOrEqual(min);
  });
});

/**
 * Colour vision (docs/visual-language.md §1): `signal` means "selected", the verdicts mean
 * "judged", and a reader with any dichromacy must still tell them apart. The floors are what
 * the L3-2 retune reached; the light theme is lower because its accent must stay dark
 * enough for 4.5:1 text, which leaves hue as the only lever.
 */
const SEPARATION: Record<Theme, number> = { light: 8, dark: 9.3 };

describe.each(Object.entries(THEMES) as [Theme, Tokens][])("colour vision — %s theme", (theme, tokens) => {
  it.each(["normal", "defect", "warn"])("signal stays apart from %s under every dichromacy", (verdict) => {
    const separation = worstDeltaE(tokens["signal"] ?? "", tokens[verdict] ?? "");
    expect(separation, `ΔE ${separation.toFixed(1)}`).toBeGreaterThanOrEqual(SEPARATION[theme]);
  });
});
