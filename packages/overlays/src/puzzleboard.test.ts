import { describe, expect, it } from "vitest";

import { PUZZLE_ALIGNMENT, puzzleboard } from "./fixtures.stories";
import type { TargetCorner } from "./model";
import { PUZZLEBOARD_PERIOD, edgeBitsFromPuzzleboard, type PuzzleboardAlignment, type PuzzleboardEdge } from "./puzzleboard";

const IDENTITY: PuzzleboardAlignment = { transform: { a: 1, b: 0, c: 0, d: 1 }, translation: [0, 0] };

/** Two corners one local step apart in `i` (master (0,0) and (1,0)), 10 px apart. */
const PAIR: TargetCorner[] = [
  { id: "a", x: 100, y: 50, i: 0, j: 0 },
  { id: "b", x: 110, y: 50, i: 1, j: 0 },
];

describe("edgeBitsFromPuzzleboard", () => {
  it("places a dot at the midpoint of its edge, a quarter of the edge in radius", () => {
    const edge: PuzzleboardEdge = { row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 0.8 };
    expect(edgeBitsFromPuzzleboard([edge], PAIR, IDENTITY)).toEqual([
      { id: "horizontal-0-0-0", x: 105, y: 50, radius: 2.5, bit: 1, confidence: 0.8 },
    ]);
  });

  it("follows a vertical edge to the next row", () => {
    const corners: TargetCorner[] = [
      { id: "a", x: 0, y: 0, i: 0, j: 0 },
      { id: "b", x: 0, y: 8, i: 0, j: 1 },
    ];
    const [bit] = edgeBitsFromPuzzleboard([{ row: 0, col: 0, orientation: "vertical", bit: 0, confidence: 1 }], corners, IDENTITY);
    expect(bit).toMatchObject({ x: 0, y: 4, radius: 2, bit: 0 });
  });

  it("maps local coordinates to master indices through the alignment, modulo the period", () => {
    // master = (local j + 100, -local i + 3) mod 501, so local (0, 0) is master (100, 3) and local (1, 0) is master (100, 2).
    const corners: TargetCorner[] = [
      { id: "a", x: 0, y: 0, i: 100, j: 3 },
      { id: "b", x: 4, y: 0, i: 100, j: 2 },
    ];
    const [bit] = edgeBitsFromPuzzleboard([{ row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 1 }], corners, PUZZLE_ALIGNMENT);
    expect(bit).toMatchObject({ x: 2, y: 0, radius: 1 });
    // A negative image of the map wraps into [0, 501): local (0, 0) is master (100, -1 + 501) and local (1, 0) is (100, -2 + 501).
    const wrapped: TargetCorner[] = [
      { id: "a", x: 0, y: 0, i: 100, j: 500 },
      { id: "b", x: 4, y: 0, i: 100, j: 499 },
    ];
    const shifted: PuzzleboardAlignment = { transform: { a: 0, b: 1, c: -1, d: 0 }, translation: [100, -1] };
    expect(edgeBitsFromPuzzleboard([{ row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 1 }], wrapped, shifted)).toHaveLength(1);
  });

  it("honours a different period", () => {
    const corners: TargetCorner[] = [
      { id: "a", x: 0, y: 0, i: 3, j: 0 },
      { id: "b", x: 2, y: 0, i: 4, j: 0 },
    ];
    const shifted: PuzzleboardAlignment = { transform: { a: 1, b: 0, c: 0, d: 1 }, translation: [13, 0] };
    const edge: PuzzleboardEdge = { row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 1 };
    expect(edgeBitsFromPuzzleboard([edge], corners, shifted, 10)).toHaveLength(1);
    expect(edgeBitsFromPuzzleboard([edge], corners, shifted)).toHaveLength(0);
  });

  it("drops an edge when either corner was not detected", () => {
    const edge: PuzzleboardEdge = { row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 1 };
    expect(edgeBitsFromPuzzleboard([edge], PAIR.slice(0, 1), IDENTITY)).toEqual([]);
    expect(edgeBitsFromPuzzleboard([edge], PAIR.slice(1), IDENTITY)).toEqual([]);
  });

  it("clamps the confidence into [0, 1]", () => {
    const edges: PuzzleboardEdge[] = [
      { row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 7 },
      { row: 0, col: 0, orientation: "horizontal", bit: 0, confidence: -1 },
    ];
    expect(edgeBitsFromPuzzleboard(edges, PAIR, IDENTITY).map((b) => b.confidence)).toEqual([1, 0]);
  });

  it("is empty without an alignment, edges or corners", () => {
    const edge: PuzzleboardEdge = { row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 1 };
    expect(edgeBitsFromPuzzleboard([edge], PAIR, null)).toEqual([]);
    expect(edgeBitsFromPuzzleboard([edge], PAIR, undefined)).toEqual([]);
    expect(edgeBitsFromPuzzleboard([], PAIR, IDENTITY)).toEqual([]);
    expect(edgeBitsFromPuzzleboard([edge], [], IDENTITY)).toEqual([]);
  });

  it("ignores corners with no master index", () => {
    const edge: PuzzleboardEdge = { row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 1 };
    expect(edgeBitsFromPuzzleboard([edge], [{ id: "x", x: 0, y: 0 }], IDENTITY)).toEqual([]);
  });

  it("builds every edge of the story's decode, with ids unique", () => {
    const { edgeBits, corners } = puzzleboard();
    // 9×6 corners: 8×6 horizontal and 9×5 vertical edges.
    expect(edgeBits).toHaveLength(8 * 6 + 9 * 5);
    expect(new Set(edgeBits!.map((b) => b.id)).size).toBe(edgeBits!.length);
    // Every master index is inside the period, so the story shows the wrap.
    expect(corners!.every((c) => c.i! >= 0 && c.i! < PUZZLEBOARD_PERIOD && c.j! >= 0 && c.j! < PUZZLEBOARD_PERIOD)).toBe(true);
    expect(Math.max(...corners!.map((c) => c.j!))).toBeGreaterThan(400);
  });
});
