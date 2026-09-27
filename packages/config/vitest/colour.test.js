import { describe, expect, it } from "bun:test";

import { composite, contrast, cssTokens, deltaE, worstDeltaE } from "./colour.js";

describe("colour", () => {
  it("matches the WCAG contrast reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#ffffff", "#777777")).toBeCloseTo(contrast("#777777", "#ffffff"), 10);
  });

  it("composites a translucent colour over an opaque one", () => {
    expect(composite("#000000", 0.5, "#ffffff")).toBe("#808080");
    expect(composite("#ff0000", 1, "#00ff00")).toBe("#ff0000");
  });

  it("reads one rule block's hex tokens", () => {
    const css = ":root {\n  --a: #112233;\n  --b: 4px;\n}\n.dark {\n  --a: #445566;\n}";
    expect(cssTokens(css, ":root")).toEqual({ a: "#112233" });
    expect(cssTokens(css, ".dark")).toEqual({ a: "#445566" });
    expect(() => cssTokens(css, ".light")).toThrow();
  });

  it("measures OKLab distance, and collapses what a dichromat cannot tell apart", () => {
    expect(deltaE("#ffffff", "#ffffff", "none")).toBe(0);
    expect(deltaE("#000000", "#ffffff", "none")).toBeCloseTo(100, 0);
    // lab-ui's 0.6 light accent and pass colour: distinct in typical vision, one colour to a
    // tritanope (1.7, the value tools/visual-language/colours.py measured).
    expect(deltaE("#0a6b7a", "#046e4d", "none")).toBeGreaterThan(7);
    expect(deltaE("#0a6b7a", "#046e4d", "tritan")).toBeCloseTo(1.72, 2);
    expect(worstDeltaE("#0a6b7a", "#046e4d")).toBe(deltaE("#0a6b7a", "#046e4d", "tritan"));
  });
});
