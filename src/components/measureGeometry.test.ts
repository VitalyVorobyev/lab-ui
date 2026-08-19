import { describe, expect, it } from "vitest";

import {
  arcPath,
  arrowHeadPoints,
  caliperArrow,
  caliperCorners,
  crossSegments,
  dimensionGeometry,
  polygonPath,
  rotatePoint,
  strokeWidthFor,
} from "./measureGeometry";

describe("strokeWidthFor", () => {
  it("is the identity at scale 1", () => {
    expect(strokeWidthFor(1)).toBe(1);
  });

  it("shrinks in native-pixel units as the screen scale grows, so 1px stays 1px", () => {
    // At 2x zoom, a shape drawn 0.5 native-pixel-units wide covers 1 screen pixel.
    expect(strokeWidthFor(2)).toBeCloseTo(0.5, 6);
    expect(strokeWidthFor(4)).toBeCloseTo(0.25, 6);
  });

  it("honours a requested screen width other than 1px", () => {
    expect(strokeWidthFor(2, 3)).toBeCloseTo(1.5, 6);
  });

  it("falls back to the requested screen width for a non-positive or non-finite scale", () => {
    expect(strokeWidthFor(0)).toBe(1);
    expect(strokeWidthFor(-3)).toBe(1);
    expect(strokeWidthFor(Number.NaN)).toBe(1);
    expect(strokeWidthFor(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("rotatePoint", () => {
  it("leaves a point alone at angle 0", () => {
    const p = rotatePoint(3, 4, 0);
    expect(p.x).toBeCloseTo(3, 6);
    expect(p.y).toBeCloseTo(4, 6);
  });

  it("turns +x into +y at a quarter turn", () => {
    const p = rotatePoint(1, 0, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(1, 6);
  });

  it("negates both axes at a half turn", () => {
    const p = rotatePoint(2, -3, Math.PI);
    expect(p.x).toBeCloseTo(-2, 6);
    expect(p.y).toBeCloseTo(3, 6);
  });
});

describe("polygonPath", () => {
  it("closes the loop through every point", () => {
    const d = polygonPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(d).toBe("M0.00 0.00 L10.00 0.00 L10.00 10.00 Z");
  });

  it("is empty for fewer than two points", () => {
    expect(polygonPath([])).toBe("");
    expect(polygonPath([{ x: 0, y: 0 }])).toBe("");
  });
});

describe("crossSegments", () => {
  it("draws a horizontal and a vertical segment centred on the point", () => {
    const [horizontal, vertical] = crossSegments(5, 5, 2);
    expect(horizontal).toEqual([{ x: 3, y: 5 }, { x: 7, y: 5 }]);
    expect(vertical).toEqual([{ x: 5, y: 3 }, { x: 5, y: 7 }]);
  });
});

describe("arcPath", () => {
  it("sweeps forward from start to end, clockwise on screen", () => {
    const d = arcPath(0, 0, 10, 0, Math.PI / 2);
    expect(d).toBe("M10.00 0.00 A10.00 10.00 0 0 1 0.00 10.00");
  });

  it("sets the large-arc flag once the sweep passes half a turn", () => {
    const short = arcPath(0, 0, 10, 0, Math.PI * 0.6);
    const long = arcPath(0, 0, 10, 0, Math.PI * 1.4);
    expect(short).toContain(" 0 0 1 ");
    expect(long).toContain(" 0 1 1 ");
  });

  it("wraps a negative-going end angle forward through a full turn", () => {
    // Sweeping from 350° to 10° is a short 20° forward arc, not the long way around (340°)
    // and not a negative sweep — the large-arc flag pins down which one was drawn.
    const d = arcPath(0, 0, 5, (350 * Math.PI) / 180, (10 * Math.PI) / 180);
    expect(d).not.toBe("");
    expect(d).toContain(" 0 0 1 ");
  });

  it("draws a full circle as two half-circle arcs rather than a degenerate one", () => {
    const d = arcPath(0, 0, 10, 0, Math.PI * 2);
    expect(d.match(/A/g)).toHaveLength(2);
  });

  it("is empty for a zero sweep or a non-positive radius", () => {
    expect(arcPath(0, 0, 10, 1, 1)).toBe("");
    expect(arcPath(0, 0, 0, 0, Math.PI)).toBe("");
    expect(arcPath(0, 0, -5, 0, Math.PI)).toBe("");
  });
});

describe("caliperCorners", () => {
  it("is an axis-aligned box at angle 0", () => {
    const [a, b, c, d] = caliperCorners(0, 0, 4, 2, 0);
    expect(a).toEqual({ x: -2, y: -1 });
    expect(b).toEqual({ x: 2, y: -1 });
    expect(c).toEqual({ x: 2, y: 1 });
    expect(d).toEqual({ x: -2, y: 1 });
  });

  it("rotates about its own centre, which need not be the origin", () => {
    const corners = caliperCorners(100, 50, 4, 2, Math.PI / 2);
    for (const corner of corners) {
      const radius = Math.hypot(corner.x - 100, corner.y - 50);
      expect(radius).toBeCloseTo(Math.hypot(2, 1), 6);
    }
  });
});

describe("caliperArrow", () => {
  it("points along the box's own +x axis, past its edge", () => {
    const { from, to } = caliperArrow(0, 0, 10, 0);
    expect(from).toEqual({ x: 0, y: 0 });
    expect(to.x).toBeGreaterThan(5); // past the half-width
    expect(to.y).toBeCloseTo(0, 6);
  });

  it("follows the box's rotation", () => {
    const { to } = caliperArrow(0, 0, 10, Math.PI / 2);
    expect(to.x).toBeCloseTo(0, 6);
    expect(to.y).toBeGreaterThan(0);
  });
});

describe("arrowHeadPoints", () => {
  it("sits both back points behind the tip, along the given direction", () => {
    const [left, tip, right] = arrowHeadPoints({ x: 10, y: 0 }, 0, 4);
    expect(tip).toEqual({ x: 10, y: 0 });
    expect(left.x).toBeLessThan(tip.x);
    expect(right.x).toBeLessThan(tip.x);
  });

  it("is symmetric about the direction of travel", () => {
    const [left, , right] = arrowHeadPoints({ x: 0, y: 0 }, 0, 4);
    expect(left.y).toBeCloseTo(-right.y, 6);
  });
});

describe("dimensionGeometry", () => {
  it("offsets a rightward measurement upward on screen for a positive offset", () => {
    const g = dimensionGeometry(0, 0, 10, 0, 5);
    expect(g.dimensionLine[0].y).toBeCloseTo(-5, 6);
    expect(g.dimensionLine[1].y).toBeCloseTo(-5, 6);
    expect(g.extensionLine1).toEqual([{ x: 0, y: 0 }, g.dimensionLine[0]]);
    expect(g.extensionLine2).toEqual([{ x: 10, y: 0 }, g.dimensionLine[1]]);
  });

  it("anchors the label at the midpoint of the dimension line", () => {
    const g = dimensionGeometry(0, 0, 10, 0, 5);
    expect(g.labelAnchor).toEqual({ x: 5, y: -5 });
  });

  it("reports the dimension line's own angle for an upright label", () => {
    expect(dimensionGeometry(0, 0, 10, 0, 5).angleDegrees).toBeCloseTo(0, 6);
    expect(dimensionGeometry(0, 0, 0, 10, 5).angleDegrees).toBeCloseTo(90, 6);
  });

  it("does not divide by zero for a degenerate (zero-length) measurement", () => {
    const g = dimensionGeometry(3, 3, 3, 3, 5);
    expect(Number.isFinite(g.labelAnchor.x)).toBe(true);
    expect(Number.isFinite(g.labelAnchor.y)).toBe(true);
  });
});
