import { describe, expect, it } from "vitest";

import { datumAxes, datumPress, moveDatum, rotateDatum, type Datum } from "./datumEdit";

const D: Datum = { origin: { x: 100, y: 50 }, angle: 0 };

describe("datumAxes", () => {
  it("puts i along the angle and j, half as long, a quarter turn clockwise on screen", () => {
    const { i, j } = datumAxes(D, 40);
    expect(i).toEqual({ x: 140, y: 50 });
    expect(j.x).toBeCloseTo(100, 9);
    expect(j.y).toBeCloseTo(70, 9);
  });

  it("turns both with the angle", () => {
    const { i, j } = datumAxes({ ...D, angle: Math.PI / 2 }, 40);
    expect(i.x).toBeCloseTo(100, 9);
    expect(i.y).toBeCloseTo(90, 9);
    expect(j.x).toBeCloseTo(80, 9);
    expect(j.y).toBeCloseTo(50, 9);
  });
});

describe("moveDatum", () => {
  it("moves the origin and keeps the angle", () => {
    expect(moveDatum({ ...D, angle: 1 }, { x: 3.4, y: 7.6 })).toEqual({ origin: { x: 3.4, y: 7.6 }, angle: 1 });
  });

  it("rounds to a grid", () => {
    expect(moveDatum(D, { x: 13, y: 17.6 }, { grid: 5 }).origin).toEqual({ x: 15, y: 20 });
    expect(moveDatum(D, { x: 13, y: 17.6 }, { grid: 0 }).origin).toEqual({ x: 13, y: 17.6 });
  });

  it("stays inside the bounds, edges included", () => {
    const bounds = { x: 0, y: 0, width: 50, height: 40 };
    expect(moveDatum(D, { x: -5, y: 90 }, { bounds }).origin).toEqual({ x: 0, y: 40 });
    expect(moveDatum(D, { x: 50, y: 0 }, { bounds }).origin).toEqual({ x: 50, y: 0 });
  });

  it("past an edge with a grid, takes the last grid line inside, or only stays in without one", () => {
    const bounds = { x: 3, y: 3, width: 44, height: 1 };
    expect(moveDatum(D, { x: -20, y: 90 }, { grid: 5, bounds }).origin).toEqual({ x: 5, y: 4 });
    expect(moveDatum(D, { x: 90, y: -20 }, { grid: 5, bounds }).origin).toEqual({ x: 45, y: 3 });
    // y's bounds [3, 4] hold no multiple of 5: the edge.
    expect(moveDatum(D, { x: 20, y: 90 }, { grid: 5, bounds }).origin).toEqual({ x: 20, y: 4 });
  });
});

describe("rotateDatum", () => {
  it("points i at the pointer", () => {
    expect(rotateDatum(D, { x: 100, y: 80 }).angle).toBeCloseTo(Math.PI / 2, 9);
    expect(rotateDatum(D, { x: 70, y: 50 }).angle).toBeCloseTo(Math.PI, 9);
    expect(rotateDatum(D, { x: 70, y: 50 }).origin).toBe(D.origin);
  });

  it("rounds to the snap step and stays in (−π, π]", () => {
    const turned = rotateDatum(D, { x: 100 + Math.cos(0.3), y: 50 + Math.sin(0.3) }, Math.PI / 12);
    expect(turned.angle).toBeCloseTo(Math.PI / 12, 9);
    const back = rotateDatum(D, { x: 100 - 10, y: 50 - 0.01 }, Math.PI / 12);
    expect(Math.abs(back.angle)).toBeCloseTo(Math.PI, 9);
  });

  it("keeps the angle for a pointer on the origin", () => {
    expect(rotateDatum({ ...D, angle: 0.7 }, D.origin, Math.PI / 12).angle).toBeCloseTo(Math.PI * (3 / 12), 9);
    expect(rotateDatum({ ...D, angle: 0.7 }, D.origin).angle).toBe(0.7);
  });
});

describe("datumPress", () => {
  // At scale 2: the ring is 3.5 image px, the 40 px arm 20, its handle at (120, 50).
  const press = (x: number, y: number, options = {}) => datumPress(D, { x, y }, 2, 6, options);

  it("grabs the origin inside its ring and within the pointer's reach of it", () => {
    expect(press(100, 50)).toBe("origin");
    expect(press(100, 55)).toBe("origin"); // 10 screen px out: 3 past the ring
    expect(press(100, 57)).toBeNull(); // 14 screen px out: 7 past the ring
  });

  it("grabs the arm along its length and at its handle", () => {
    expect(press(110, 51)).toBe("arm");
    expect(press(121, 53)).toBe("arm");
    expect(press(110, 60)).toBeNull();
  });

  it("gives a press between them to the nearer, and a tie to the origin", () => {
    // On the arm's line just past the ring: 0 from the arm, 2 screen px from the ring.
    expect(press(104.5, 50)).toBe("arm");
    // On the ring's edge where the arm starts: 0 from both.
    expect(press(103.5, 50)).toBe("origin");
  });

  it("has no arm when it cannot turn, and follows the arm's length", () => {
    expect(press(110, 51, { rotatable: false })).toBeNull();
    expect(press(130, 50, { armLength: 60 })).toBe("arm");
    expect(press(130, 50)).toBeNull();
  });
});
