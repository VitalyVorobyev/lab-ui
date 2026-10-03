import { describe, expect, it } from "vitest";

import { COLORMAPS, colormap, colormapGradient, colormapRgb, colormapValue } from "./colormap";

/** sRGB relative luminance, for the "perceptually ordered" check. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

describe("colormap", () => {
  it("hits the anchors at the ends and clamps outside [0, 1]", () => {
    expect(colormap("viridis", 0)).toBe("rgb(68 1 84)");
    expect(colormap("viridis", 1)).toBe("rgb(253 231 37)");
    expect(colormap("viridis", -3)).toBe(colormap("viridis", 0));
    expect(colormap("cividis", 7)).toBe(colormap("cividis", 1));
    expect(colormap("viridis", Number.NaN)).toBe(colormap("viridis", 0));
  });

  it("rises monotonically in luminance, so equal data steps read as ordered steps", () => {
    for (const name of COLORMAPS) {
      let last = -1;
      for (let i = 0; i <= 100; i++) {
        const l = luminance(colormapRgb(name, i / 100));
        expect(l).toBeGreaterThanOrEqual(last - 1e-9);
        last = l;
      }
    }
  });

  it("maps a value through a domain, reversed or degenerate", () => {
    expect(colormapValue("viridis", 5, [0, 10])).toBe(colormap("viridis", 0.5));
    expect(colormapValue("viridis", 0, [10, 0])).toBe(colormap("viridis", 1));
    expect(colormapValue("cividis", 3, [3, 3])).toBe(colormap("cividis", 0));
  });

  it("writes a CSS gradient through every anchor", () => {
    const gradient = colormapGradient("cividis", "to top");
    expect(gradient.startsWith("linear-gradient(to top, rgb(0 34 78) 0.0%")).toBe(true);
    expect(gradient.endsWith("rgb(254 232 56) 100.0%)")).toBe(true);
  });
});
