import { describe, expect, it } from "vitest";

import type { MeasurePrimitive } from "./MeasureOverlay";
import { measurePrimitiveDistance, nearestMeasurePrimitive } from "./measureHit";

const at = (x: number, y: number) => ({ x, y });

describe("measurePrimitiveDistance", () => {
  it("is 0 inside a dot and the gap to its rim outside, the dot sized in screen pixels", () => {
    const dot: MeasurePrimitive = { kind: "point", x: 10, y: 10, radius: 4 };
    expect(measurePrimitiveDistance(dot, at(11, 11), 1)).toBe(0);
    expect(measurePrimitiveDistance(dot, at(20, 10), 1)).toBeCloseTo(6, 9);
    // At scale 2 the 4 px dot is 2 image px across the radius.
    expect(measurePrimitiveDistance(dot, at(20, 10), 2)).toBeCloseTo(8, 9);
    expect(measurePrimitiveDistance({ kind: "point", x: 0, y: 0 }, at(5, 0), 1)).toBeCloseTo(2, 9);
  });

  it("measures a cross to its arms, which are 5 screen px long", () => {
    const cross: MeasurePrimitive = { kind: "point", x: 0, y: 0, cross: true };
    expect(measurePrimitiveDistance(cross, at(3, 0), 1)).toBe(0);
    expect(measurePrimitiveDistance(cross, at(3, 3), 1)).toBeCloseTo(3, 9);
    expect(measurePrimitiveDistance(cross, at(8, 0), 1)).toBeCloseTo(3, 9);
    expect(measurePrimitiveDistance(cross, at(8, 0), 0.5)).toBe(0);
  });

  it("measures a segment to its nearest point, ends included", () => {
    const segment: MeasurePrimitive = { kind: "segment", x1: 0, y1: 0, x2: 10, y2: 0 };
    expect(measurePrimitiveDistance(segment, at(5, 3), 1)).toBeCloseTo(3, 9);
    expect(measurePrimitiveDistance(segment, at(13, 4), 1)).toBeCloseTo(5, 9);
  });

  it("measures segments to the nearest one, skipping a non-finite one", () => {
    const segments: MeasurePrimitive = { kind: "segments", points: [0, 0, 10, 0, Number.NaN, 0, 0, 0, 0, 20, 10, 20, 99] };
    expect(measurePrimitiveDistance(segments, at(5, 18), 1)).toBeCloseTo(2, 9);
    expect(measurePrimitiveDistance(segments, at(5, 4), 1)).toBeCloseTo(4, 9);
    expect(measurePrimitiveDistance({ kind: "segments", points: [1, 2] }, at(1, 2), 1)).toBe(Infinity);
  });

  it("measures an outlined circle to its rim and is 0 inside a filled one", () => {
    expect(measurePrimitiveDistance({ kind: "circle", cx: 0, cy: 0, r: 10 }, at(0, 0), 1)).toBeCloseTo(10, 9);
    expect(measurePrimitiveDistance({ kind: "circle", cx: 0, cy: 0, r: 10 }, at(12, 0), 1)).toBeCloseTo(2, 9);
    expect(measurePrimitiveDistance({ kind: "circle", cx: 0, cy: 0, r: 10, filled: true }, at(3, 4), 1)).toBe(0);
    expect(measurePrimitiveDistance({ kind: "circle", cx: 0, cy: 0, r: 10, filled: true }, at(13, 0), 1)).toBeCloseTo(3, 9);
  });

  it("measures an arc to its rim within its sweep, and to its nearer end outside it", () => {
    // A quarter from +x clockwise (on screen) to +y.
    const arc: MeasurePrimitive = { kind: "arc", cx: 0, cy: 0, r: 10, startAngle: 0, endAngle: Math.PI / 2 };
    expect(measurePrimitiveDistance(arc, at(8, 8), 1)).toBeCloseTo(Math.hypot(8, 8) - 10, 9);
    // Opposite the sweep: nearer to the end at (10, 0) or (0, 10) than to the rim there.
    expect(measurePrimitiveDistance(arc, at(-10, 0), 1)).toBeCloseTo(Math.hypot(10, 10), 9);
    expect(measurePrimitiveDistance(arc, at(10, -3), 1)).toBeCloseTo(3, 9);
    // A whole turn is the circle; a zero sweep and a zero radius draw nothing.
    expect(measurePrimitiveDistance({ ...arc, endAngle: 2 * Math.PI }, at(-12, 0), 1)).toBeCloseTo(2, 9);
    expect(measurePrimitiveDistance({ ...arc, endAngle: 0 }, at(10, 0), 1)).toBe(Infinity);
    expect(measurePrimitiveDistance({ ...arc, r: 0 }, at(0, 0), 1)).toBe(Infinity);
  });

  it("is 0 inside a caliper box, turned with it, and measures its arrow outside", () => {
    const caliper: MeasurePrimitive = { kind: "caliper", cx: 50, cy: 50, width: 40, height: 10, angle: Math.PI / 2 };
    // Turned a quarter: 10 wide along x, 40 tall along y.
    expect(measurePrimitiveDistance(caliper, at(53, 68), 1)).toBe(0);
    expect(measurePrimitiveDistance(caliper, at(60, 50), 1)).toBeCloseTo(5, 9);
    // The arrow runs from the centre along +y to past the box's far side (20 + 8 = 28).
    expect(measurePrimitiveDistance(caliper, at(50, 77), 1)).toBe(0);
    expect(measurePrimitiveDistance({ ...caliper, showDirection: false }, at(50, 77), 1)).toBeCloseTo(7, 9);
  });

  it("measures a dimension to its extension and dimension lines", () => {
    const dimension: MeasurePrimitive = { kind: "dimension", x1: 0, y1: 0, x2: 100, y2: 0, label: "100", offset: 20 };
    // The dimension line is 20 above the span.
    expect(measurePrimitiveDistance(dimension, at(50, -18), 1)).toBeCloseTo(2, 9);
    expect(measurePrimitiveDistance(dimension, at(-3, -10), 1)).toBeCloseTo(3, 9);
    expect(measurePrimitiveDistance(dimension, at(50, 0), 1)).toBeCloseTo(20, 9);
    // The default offset is 16.
    expect(measurePrimitiveDistance({ kind: "dimension", x1: 0, y1: 0, x2: 100, y2: 0, label: "100" }, at(50, -16), 1)).toBeCloseTo(0, 9);
  });

  it("measures a polyline to its segments, the closing one only when closed", () => {
    const open: MeasurePrimitive = { kind: "polyline", points: [0, 0, 10, 0, 10, 10] };
    expect(measurePrimitiveDistance(open, at(3, 5), 1)).toBeCloseTo(5, 9);
    expect(measurePrimitiveDistance({ ...open, closed: true }, at(3, 5), 1)).toBeCloseTo(Math.SQRT2, 9);
    expect(measurePrimitiveDistance({ kind: "polyline", points: [4, 4] }, at(7, 8), 1)).toBeCloseTo(5, 9);
    expect(measurePrimitiveDistance({ kind: "polyline", points: [] }, at(0, 0), 1)).toBe(Infinity);
  });

  it("is Infinity for a kind it does not know", () => {
    const unknown = { kind: "glyph", x: 0, y: 0 } as unknown as MeasurePrimitive;
    expect(measurePrimitiveDistance(unknown, at(0, 0), 1)).toBe(Infinity);
  });
});

describe("nearestMeasurePrimitive", () => {
  const primitives: MeasurePrimitive[] = [
    { kind: "circle", id: "big", cx: 50, cy: 50, r: 40, filled: true },
    { kind: "caliper", id: "box", cx: 50, cy: 50, width: 20, height: 10, angle: 0, showDirection: false },
    { kind: "segment", x1: 0, y1: 95, x2: 100, y2: 95 },
    { kind: "point", id: "dot", x: 90, y: 10 },
  ];

  it("finds the nearest primitive with an id within the radius", () => {
    expect(nearestMeasurePrimitive(primitives, at(91, 12), 3, 1)).toEqual({ id: "dot", distance: 0 });
    expect(nearestMeasurePrimitive(primitives, at(95, 10), 3, 1)).toEqual({ id: "dot", distance: 2 });
    expect(nearestMeasurePrimitive(primitives, at(99, 1), 3, 1)).toBeNull();
  });

  it("skips primitives without an id", () => {
    expect(nearestMeasurePrimitive(primitives, at(50, 95), 3, 1)).toBeNull();
  });

  it("gives a tie to the later primitive, which is drawn on top", () => {
    // Inside both the filled circle and the box: both are 0 away.
    expect(nearestMeasurePrimitive(primitives, at(50, 50), 3, 1)).toEqual({ id: "box", distance: 0 });
    expect(nearestMeasurePrimitive(primitives, at(50, 30), 3, 1)).toEqual({ id: "big", distance: 0 });
  });

  it("reaches a mark sized in screen pixels past its geometric box", () => {
    // A 3 px dot at scale 0.25 is 12 image px across the radius.
    expect(nearestMeasurePrimitive(primitives, at(90, 21), 1, 0.25)?.id).toBe("dot");
    expect(nearestMeasurePrimitive(primitives, at(90, 21), 1, 1)).toBeNull();
  });

  it("never picks a primitive with a non-finite coordinate", () => {
    expect(nearestMeasurePrimitive([{ kind: "point", id: "nan", x: Number.NaN, y: 0 }], at(0, 0), 100, 1)).toBeNull();
  });

  it("follows a new array, and keeps answering for the same one", () => {
    const first: MeasurePrimitive[] = [{ kind: "point", id: "a", x: 0, y: 0 }];
    expect(nearestMeasurePrimitive(first, at(0, 0), 1, 1)?.id).toBe("a");
    expect(nearestMeasurePrimitive(first, at(0, 0), 1, 1)?.id).toBe("a");
    const second: MeasurePrimitive[] = [{ kind: "point", id: "b", x: 50, y: 50 }];
    expect(nearestMeasurePrimitive(second, at(0, 0), 1, 1)).toBeNull();
    expect(nearestMeasurePrimitive(second, at(50, 50), 1, 1)?.id).toBe("b");
  });
});
