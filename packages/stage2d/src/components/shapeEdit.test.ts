import { describe, expect, it } from "vitest";

import {
  fromShapeFrame,
  moveShape,
  normalizeAngle,
  resizeShape,
  rotateShape,
  rotationHandlePoint,
  sameShape,
  shapeCorner,
  shapeFromCorner,
  shapeHandleCursor,
  shapeHandlePoint,
  toShapeFrame,
  type RotatedShape,
} from "./shapeEdit";

const FLAT: RotatedShape = { cx: 100, cy: 50, width: 40, height: 20, rotation: 0 };
const QUARTER: RotatedShape = { cx: 100, cy: 50, width: 40, height: 20, rotation: Math.PI / 2 };

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe("shape frame", () => {
  it("maps between image space and the shape's own frame", () => {
    near(toShapeFrame(QUARTER, { x: 100, y: 70 }), { x: 20, y: 0 });
    near(fromShapeFrame(QUARTER, { x: 20, y: 0 }), { x: 100, y: 70 });
    near(toShapeFrame(FLAT, { x: 110, y: 45 }), { x: 10, y: -5 });
  });
});

describe("handle positions", () => {
  it("puts the eight handles on the corners and sides, turned with the shape", () => {
    near(shapeHandlePoint(FLAT, "nw"), { x: 80, y: 40 });
    near(shapeHandlePoint(FLAT, "e"), { x: 120, y: 50 });
    near(shapeHandlePoint(FLAT, "s"), { x: 100, y: 60 });
    // A quarter turn clockwise: the shape's east side now faces south.
    near(shapeHandlePoint(QUARTER, "e"), { x: 100, y: 70 });
    near(shapeHandlePoint(QUARTER, "nw"), { x: 110, y: 30 });
  });

  it("puts the rotation handle beyond the top side", () => {
    near(rotationHandlePoint(FLAT, 12), { x: 100, y: 28 });
    near(rotationHandlePoint(QUARTER, 12), { x: 122, y: 50 });
  });
});

describe("resizeShape", () => {
  it("moves the dragged side and keeps the opposite one", () => {
    const wider = resizeShape(FLAT, "e", { x: 150, y: 77 }, 5);
    expect(wider).toEqual({ cx: 115, cy: 50, width: 70, height: 20, rotation: 0 });
    const taller = resizeShape(FLAT, "n", { x: 0, y: 20 }, 5);
    expect(taller).toEqual({ cx: 100, cy: 40, width: 40, height: 40, rotation: 0 });
  });

  it("moves a corner on both axes", () => {
    const grown = resizeShape(FLAT, "se", { x: 130, y: 70 }, 5);
    expect(grown).toEqual({ cx: 105, cy: 55, width: 50, height: 30, rotation: 0 });
  });

  it("resizes in the shape's own frame when it is rotated", () => {
    // A quarter turn: the shape's east side faces south; dragging it south by 10 widens the shape by 10.
    const wider = resizeShape(QUARTER, "e", { x: 100, y: 80 }, 5);
    expect(wider.width).toBeCloseTo(50, 9);
    expect(wider.height).toBe(20);
    // The west side (now facing north) stays at y = 30.
    near(shapeHandlePoint(wider, "w"), { x: 100, y: 30 });
  });

  it("stops at the minimum size instead of flipping", () => {
    const squashed = resizeShape(FLAT, "e", { x: 0, y: 50 }, 5);
    expect(squashed.width).toBe(5);
    near(shapeHandlePoint(squashed, "w"), { x: 80, y: 50 });
    const corner = resizeShape(FLAT, "nw", { x: 500, y: 500 }, 8);
    expect([corner.width, corner.height]).toEqual([8, 8]);
    near(shapeHandlePoint(corner, "se"), { x: 120, y: 60 });
  });

  it("leaves the other axis alone for a side handle", () => {
    expect(resizeShape(FLAT, "w", { x: 60, y: 999 }, 5).height).toBe(20);
    expect(resizeShape(FLAT, "s", { x: 999, y: 90 }, 5).width).toBe(40);
  });
});

describe("rotateShape", () => {
  it("turns about the centre so the handle points at the pointer", () => {
    // The handle starts straight up; pointing it at the east is a quarter turn clockwise.
    const turned = rotateShape(FLAT, { x: 200, y: 50 });
    expect(turned.rotation).toBeCloseTo(Math.PI / 2, 9);
    expect([turned.cx, turned.cy, turned.width, turned.height]).toEqual([100, 50, 40, 20]);
    near(rotationHandlePoint(turned, 10), { x: 120, y: 50 });
    expect(rotateShape(FLAT, { x: 100, y: 0 }).rotation).toBeCloseTo(0, 9);
    expect(rotateShape(FLAT, { x: 0, y: 50 }).rotation).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("snaps to a step", () => {
    const step = Math.PI / 12;
    const snapped = rotateShape(FLAT, { x: 100 + 100 * Math.sin(0.3), y: 50 - 100 * Math.cos(0.3) }, step);
    expect(snapped.rotation).toBeCloseTo(step, 9);
  });
});

describe("moveShape, normalizeAngle, sameShape", () => {
  it("moves without resizing or turning", () => {
    expect(moveShape(QUARTER, 5, -3)).toEqual({ ...QUARTER, cx: 105, cy: 47 });
  });

  it("normalises angles into (-π, π]", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(normalizeAngle(2.5 * Math.PI)).toBeCloseTo(Math.PI / 2, 9);
  });

  it("compares shapes, rotations modulo a turn", () => {
    expect(sameShape(FLAT, { ...FLAT })).toBe(true);
    expect(sameShape(FLAT, { ...FLAT, rotation: 2 * Math.PI })).toBe(true);
    expect(sameShape(FLAT, { ...FLAT, width: 41 })).toBe(false);
    expect(sameShape(null, null)).toBe(true);
    expect(sameShape(FLAT, null)).toBe(false);
  });
});

describe("handle cursors", () => {
  it("is the resize cursor along the handle's direction on screen", () => {
    expect(shapeHandleCursor("e", 0)).toBe("ew-resize");
    expect(shapeHandleCursor("n", 0)).toBe("ns-resize");
    expect(shapeHandleCursor("se", 0)).toBe("nwse-resize");
    expect(shapeHandleCursor("ne", 0)).toBe("nesw-resize");
    // Turned a quarter, the east handle faces south.
    expect(shapeHandleCursor("e", Math.PI / 2)).toBe("ns-resize");
    // Turned 45 degrees, the east handle faces south-east.
    expect(shapeHandleCursor("e", Math.PI / 4)).toBe("nwse-resize");
    expect(shapeHandleCursor("w", -Math.PI / 4)).toBe("nesw-resize");
  });
});

describe("Konva-style corner origin", () => {
  it("converts between a rotated corner and the centre form", () => {
    // Konva: x, y = 10, 20; 30 x 10; rotation 90 degrees about (10, 20): the rect hangs left of x = 10.
    const shape = shapeFromCorner({ x: 10, y: 20 }, 30, 10, Math.PI / 2);
    near({ x: shape.cx, y: shape.cy }, { x: 5, y: 35 });
    near(shapeCorner(shape), { x: 10, y: 20 });
    near(shapeHandlePoint(shape, "se"), { x: 0, y: 50 });
  });
});
