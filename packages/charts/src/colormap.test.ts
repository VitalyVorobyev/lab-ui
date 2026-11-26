import { describe, expect, it } from "vitest";

import {
  COLORMAPS,
  DIVERGING_COLORMAPS,
  colormap,
  colormapGradient,
  colormapRgb,
  colormapValue,
  isDivergingColormap,
  symmetricDomain,
  type ColormapName,
} from "./colormap";

const SEQUENTIAL = COLORMAPS.filter((name) => !isDivergingColormap(name));

/** OKLab of an sRGB colour, for step-size checks (Ottosson, 2020). */
function oklab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const distance = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The ΔE (OKLab) of each of `steps` equal steps along a map. */
function steps(name: ColormapName, count = 64): number[] {
  const out: number[] = [];
  let last = oklab(colormapRgb(name, 0));
  for (let i = 1; i <= count; i++) {
    const next = oklab(colormapRgb(name, i / count));
    out.push(distance(last, next));
    last = next;
  }
  return out;
}

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
    for (const name of SEQUENTIAL) {
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

describe("the shipped maps", () => {
  it("includes magma and inferno from black to a pale end, and a diverging map", () => {
    expect(colormap("magma", 0)).toBe("rgb(0 0 4)");
    expect(colormap("magma", 1)).toBe("rgb(252 253 191)");
    expect(colormap("inferno", 0)).toBe("rgb(0 0 4)");
    expect(colormap("inferno", 1)).toBe("rgb(252 255 164)");
    expect(DIVERGING_COLORMAPS).toEqual(["blueOrange"]);
    expect(SEQUENTIAL).toEqual(["viridis", "cividis", "magma", "inferno"]);
  });

  it("steps evenly in perceived colour along the diverging map, which was built to", () => {
    const d = steps("blueOrange");
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    expect(Math.max(...d.map((v) => Math.abs(v - mean) / mean))).toBeLessThan(0.3);
  });

  it("writes a gradient with a stop per anchor for every map", () => {
    for (const name of COLORMAPS) {
      const g = colormapGradient(name);
      expect(g.startsWith("linear-gradient(to right, ")).toBe(true);
      expect(g.endsWith("100.0%)")).toBe(true);
      expect(colormapValue(name, 2, [0, 4])).toBe(colormap(name, 0.5));
    }
  });
});

describe("blueOrange, the diverging map", () => {
  it("is a neutral light grey in the middle, blue below and orange above", () => {
    const [r, g, b] = colormapRgb("blueOrange", 0.5);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(6);
    expect(r).toBeGreaterThan(225);
    const low = colormapRgb("blueOrange", 0);
    const high = colormapRgb("blueOrange", 1);
    expect(low[2]).toBeGreaterThan(low[0] + 60);
    expect(high[0]).toBeGreaterThan(high[2] + 60);
  });

  it("is lightest at the middle and falls at the same rate to both ends", () => {
    let last = Infinity;
    const lightness = (t: number) => oklab(colormapRgb("blueOrange", t))[0];
    for (let i = 0; i <= 50; i++) {
      const left = lightness(0.5 - i / 100);
      expect(left).toBeLessThanOrEqual(last + 1e-9);
      last = left;
    }
    for (const t of [0.1, 0.25, 0.4]) expect(Math.abs(lightness(0.5 - t) - lightness(0.5 + t))).toBeLessThan(0.025);
    expect(Math.abs(lightness(0) - lightness(1))).toBeLessThan(0.02);
  });

  it("carries as much colour at -x as at +x", () => {
    const chroma = (t: number) => Math.hypot(oklab(colormapRgb("blueOrange", t))[1], oklab(colormapRgb("blueOrange", t))[2]);
    for (const t of [0.1, 0.25, 0.4]) expect(Math.abs(chroma(0.5 - t) - chroma(0.5 + t))).toBeLessThan(0.03);
  });
});

describe("symmetricDomain", () => {
  it("centres on zero over the largest absolute end", () => {
    expect(symmetricDomain([-0.2, 0.5])).toEqual([-0.5, 0.5]);
    expect(symmetricDomain([-3, 1])).toEqual([-3, 3]);
    expect(symmetricDomain([0, 0])).toEqual([-1, 1]);
    expect(symmetricDomain([Number.NaN, 2])).toEqual([-2, 2]);
    expect(symmetricDomain([])).toEqual([-1, 1]);
  });
});
