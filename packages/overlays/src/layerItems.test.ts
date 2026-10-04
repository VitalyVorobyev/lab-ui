import { latticeEdges } from "@vitavision/stage2d";
import { describe, expect, it } from "vitest";

import { BOARD_IMAGE, charuco, chessboard, directedField, FIELD_IMAGE, markerboard, project, puzzleboard, ringgrid } from "./fixtures.stories";
import { circlePoints, cornerNodes, edgeBitEllipses, markerAreas, ringCentres, ringEllipses } from "./layerItems";
import { TARGET_KINDS, isLatticeKind } from "./model";

describe("isLatticeKind", () => {
  it("is true for the four boards only", () => {
    expect(TARGET_KINDS.filter(isLatticeKind)).toEqual(["chessboard", "charuco", "markerboard", "puzzleboard"]);
  });
});

describe("cornerNodes", () => {
  it("keeps the lattice on a board, so neighbours join", () => {
    const nodes = cornerNodes(chessboard());
    expect(nodes).toHaveLength(54);
    // 9×6: 8×6 edges along i and 9×5 along j.
    expect(latticeEdges(nodes)).toHaveLength(8 * 6 + 9 * 5);
  });

  it("leaves a gap for a missed corner", () => {
    expect(latticeEdges(cornerNodes(chessboard(["3,2"])))).toHaveLength(8 * 6 + 9 * 5 - 4);
  });

  it("drops the lattice on loose corners, even when they carry indices", () => {
    const board = chessboard();
    const nodes = cornerNodes({ ...board, kind: "corners" });
    expect(nodes.every((n) => Number.isNaN(n.i) && Number.isNaN(n.j))).toBe(true);
    expect(latticeEdges(nodes)).toEqual([]);
  });

  it("labels a board's corner with its index, a loose corner with its id, and honours an explicit label", () => {
    const board = cornerNodes(chessboard());
    expect(board.find((n) => n.id === "c3-2")!.label).toBe("3,2");
    expect(cornerNodes({ kind: "corners", corners: [{ id: 42, x: 1, y: 2 }] })[0]!.label).toBe("42");
    expect(cornerNodes({ kind: "corners", corners: [{ id: 42, x: 1, y: 2, label: "A" }] })[0]!.label).toBe("A");
    // A board corner with no index falls back to the id.
    expect(cornerNodes({ kind: "chessboard", corners: [{ id: "z", x: 0, y: 0 }] })[0]!.label).toBe("z");
  });

  it("makes a corner with an angle a directed marker, and one without a plain plus", () => {
    const nodes = cornerNodes({
      kind: "corners",
      corners: [
        { id: "plain", x: 0, y: 0 },
        { id: "one", x: 0, y: 0, angle: 0.3 },
        { id: "two", x: 0, y: 0, angle: 0.3, angle2: 1.9 },
      ],
    });
    expect(nodes.map((n) => n.kind)).toEqual([undefined, "directed", "directed"]);
    expect(nodes[1]).toMatchObject({ angle: 0.3 });
    expect(nodes[1]!.angle2).toBeUndefined();
    expect(nodes[2]).toMatchObject({ angle: 0.3, angle2: 1.9 });
  });

  it("is empty for a detection with no corners", () => {
    expect(cornerNodes({ kind: "ringgrid" })).toEqual([]);
  });
});

describe("markerAreas", () => {
  it("makes an area per marker, labelled with its id unless it has a label", () => {
    const { markers } = charuco();
    const areas = markerAreas(charuco());
    expect(areas).toHaveLength(markers!.length);
    expect(areas[3]).toMatchObject({ id: 3, label: "3" });
    expect(markerAreas({ kind: "charuco", markers: [{ id: 1, corners: [0, 0, 1, 0, 1, 1, 0, 1], label: "tag" }] })[0]!.label).toBe("tag");
  });

  it("skips a marker without a usable quad", () => {
    expect(markerAreas({ kind: "charuco", markers: [{ id: 1, corners: [0, 0] }] })).toEqual([]);
  });
});

describe("circlePoints", () => {
  it("picks the glyph by polarity and labels the matched cell", () => {
    const points = circlePoints(markerboard());
    expect(points.map((p) => p.kind)).toEqual(["circle-white", "circle-black", "circle-white"]);
    expect(points[1]!.label).toBe("(5, 2)");
  });

  it("has no label for a circle that matched no cell, and keeps an explicit one", () => {
    const [bare, named] = circlePoints({
      kind: "circles",
      circles: [
        { id: 1, x: 0, y: 0, polarity: "white" },
        { id: 2, x: 0, y: 0, polarity: "black", label: "c2" },
      ],
    });
    expect(bare!.label).toBeUndefined();
    expect(named!.label).toBe("c2");
  });
});

describe("rings", () => {
  const { rings } = ringgrid();

  it("puts a plus at each centre, picked anywhere inside the outer ellipse", () => {
    const centres = ringCentres(rings!);
    expect(centres).toHaveLength(28);
    expect(centres[0]).toMatchObject({ id: 0, kind: "plus", label: "00" });
    expect(centres[0]!.pickRadius).toBe(Math.max(rings![0]!.outer.rx, rings![0]!.outer.ry));
  });

  it("labels a ring by its id when it has no label", () => {
    expect(ringCentres([{ id: 9, x: 0, y: 0, outer: { rx: 1, ry: 1, angle: 0 } }])[0]!.label).toBe("9");
  });

  it("draws the outer edge as a feature and the inner as a model, and skips a missing inner", () => {
    const { outer, inner } = ringEllipses([...rings!, { id: "bare", x: 0, y: 0, outer: { rx: 4, ry: 3, angle: 0 } }]);
    expect(outer).toHaveLength(29);
    expect(inner).toHaveLength(28);
    expect(new Set(outer.map((e) => e.role))).toEqual(new Set(["feature"]));
    expect(new Set(inner.map((e) => e.role))).toEqual(new Set(["model"]));
  });

  it("projects a circle to an ellipse whose points are the image of the circle", () => {
    // Ring 9 is the circle of 0.5 cells at board position (4.575, 2.55): its projected points must lie on the ellipse.
    const ring = ringgrid().rings![9]!;
    const e = ring.outer;
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * 2 * Math.PI;
      const p = project(4.575 + 0.5 * Math.cos(a), 2.55 + 0.5 * Math.sin(a));
      const dx = p.x - ring.x;
      const dy = p.y - ring.y;
      // Into the ellipse's frame.
      const c = Math.cos(e.angle);
      const s = Math.sin(e.angle);
      const q = (dx * c + dy * s) ** 2 / e.rx ** 2 + (-dx * s + dy * c) ** 2 / e.ry ** 2;
      // The local Jacobian is first order, so a 0.5-cell circle is an ellipse to within a few percent.
      expect(q).toBeGreaterThan(0.95);
      expect(q).toBeLessThan(1.05);
    }
  });
});

describe("edgeBitEllipses", () => {
  it("draws bit 1 as a solid feature dot and bit 0 as a dashed model one", () => {
    const [one, zero] = edgeBitEllipses([
      { id: "a", x: 1, y: 2, radius: 3, bit: 1, confidence: 1 },
      { id: "b", x: 1, y: 2, radius: 3, bit: 0, confidence: 1 },
    ]);
    expect(one).toMatchObject({ role: "feature", dashed: false, rx: 3, ry: 3 });
    expect(zero).toMatchObject({ role: "model", dashed: true });
  });

  it("runs the opacity from 35 % at no confidence to 100 % at full, and clamps outside", () => {
    const opacities = edgeBitEllipses([-1, 0, 0.5, 1, 4].map((confidence, k) => ({ id: k, x: 0, y: 0, radius: 1, bit: 1 as const, confidence }))).map((e) => e.opacity);
    expect(opacities[0]).toBeCloseTo(0.35, 10);
    expect(opacities[1]).toBeCloseTo(0.35, 10);
    expect(opacities[2]).toBeCloseTo(0.675, 10);
    expect(opacities[3]).toBeCloseTo(1, 10);
    expect(opacities[4]).toBeCloseTo(1, 10);
  });
});

describe("the story detections", () => {
  it("lie inside their images", () => {
    for (const detection of [chessboard(), charuco(), markerboard(), puzzleboard(), ringgrid()]) {
      const points = [
        ...(detection.corners ?? []),
        ...(detection.circles ?? []),
        ...(detection.rings ?? []),
        ...(detection.markers ?? []).flatMap((m) => Array.from({ length: m.corners.length / 2 }, (_, k) => ({ x: m.corners[2 * k]!, y: m.corners[2 * k + 1]! }))),
      ];
      expect(points.length, detection.kind).toBeGreaterThan(0);
      for (const p of points) {
        expect(p.x, detection.kind).toBeGreaterThan(0);
        expect(p.x, detection.kind).toBeLessThan(BOARD_IMAGE.width);
        expect(p.y, detection.kind).toBeGreaterThan(0);
        expect(p.y, detection.kind).toBeLessThan(BOARD_IMAGE.height);
      }
    }
  });

  it("have unique ids within a detection", () => {
    for (const detection of [chessboard(), charuco(), markerboard(), puzzleboard(), ringgrid(), directedField()]) {
      const ids = [
        ...(detection.corners ?? []).map((c) => c.id),
        ...(detection.markers ?? []).map((m) => m.id),
        ...(detection.circles ?? []).map((c) => c.id),
        ...(detection.rings ?? []).map((r) => r.id),
      ];
      expect(new Set(ids).size, detection.kind).toBe(ids.length);
    }
  });

  it("fill the dense field's image with the requested count", () => {
    const field = directedField(5000);
    expect(field.corners).toHaveLength(5000);
    expect(field.corners!.every((c) => c.x > 0 && c.x < FIELD_IMAGE.width && c.y > 0 && c.y < FIELD_IMAGE.height)).toBe(true);
  });

  it("have a ChArUco marker in every other square, turned by its id", () => {
    const { markers } = charuco();
    expect(markers).toHaveLength(35);
    expect(markers![1]!.corners[0]).not.toBe(markers![0]!.corners[0]);
  });
});
