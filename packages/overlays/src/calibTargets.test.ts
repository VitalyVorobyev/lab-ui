import { latticeEdges } from "@vitavision/stage2d";
import { describe, expect, it } from "vitest";

import { fromCalibTargets, type CalibTargetsLabeledCorner, type CalibTargetsResult } from "./calibTargets";
import { calibTargetsChessboard } from "./fixtures.stories";
import { cornerNodes, uncertaintyEllipses } from "./layerItems";

/*
 * The calib-targets result types, copied field for field from `@vitavision/calib-targets`'
 * `typescript-extras.d.ts` (0.15), plus the `position_covariance` that 0.16 adds. They are not
 * imported (this package takes no dependency on it): the assignments in "the real result types"
 * below fail to compile if the adapter's input types ever stop accepting them.
 */
type Point2 = [number, number];
interface Coord {
  u: number;
  v: number;
}
interface GridAlignment {
  lattice: "square" | "hex";
  matrix: [[number, number], [number, number]];
  translation: [number, number];
}
interface Covariance {
  position_covariance: { xx: number; xy: number; yy: number } | null;
}
interface ChessboardDetection {
  corners: { position: Point2; grid: Coord; input_index: number; score: number }[];
  cell_size: number | null;
}
interface CharucoDetection {
  corners: { position: Point2; grid: Coord; id: number; target_position: Point2; score: number }[];
  markers: {
    id: number;
    gc: Coord;
    rotation: number;
    hamming: number;
    score: number;
    border_score: number;
    code: number;
    inverted: boolean;
    corners_rect: [Point2, Point2, Point2, Point2];
    corners_img: [Point2, Point2, Point2, Point2] | null;
  }[];
  alignment: GridAlignment;
}
interface MarkerBoardDetection {
  corners: { position: Point2; grid: Coord; id: number | null; target_position: Point2 | null; score: number }[];
  alignment: GridAlignment | null;
}
interface MarkerBoardDiagnostics {
  inliers: number[];
  circle_candidates: {
    center_img: Point2;
    cell: { i: number; j: number };
    polarity: "white" | "black";
    score: number;
    contrast: number;
    squareness: number;
  }[];
  circle_matches: {
    expected: { cell: { i: number; j: number }; polarity: "white" | "black" };
    matched_index: number | null;
    offset_cells: { di: number; dj: number } | null;
  }[];
  alignment_inliers: number;
  alignment_runner_up_inliers: number;
  alignment_ambiguous: boolean;
}
interface PuzzleBoardDetection {
  corners: { position: Point2; grid: Coord; id: number; target_position: Point2; score: number }[];
  alignment: GridAlignment;
  decode: { edges_observed: number; edges_matched: number; mean_confidence: number; bit_error_rate: number };
}
interface PuzzleBoardDiagnostics {
  observed_edges: { row: number; col: number; orientation: "horizontal" | "vertical"; bit: number; confidence: number }[];
  decode: { score_best?: number };
}
interface Corner {
  position: Point2;
  axes: [{ angle: number; sigma: number }, { angle: number; sigma: number }];
  strength: number;
}

const corner = (x: number, y: number, u: number, v: number, extra: Partial<CalibTargetsLabeledCorner> = {}): CalibTargetsLabeledCorner => ({
  position: [x, y],
  grid: { u, v },
  score: 0.9,
  ...extra,
});

describe("the real result types", () => {
  it("are accepted as they are, with or without position_covariance", () => {
    const chessboard: ChessboardDetection = {
      corners: [{ position: [1, 2], grid: { u: 0, v: 0 }, input_index: 0, score: 1 }],
      cell_size: 10,
    };
    const charuco: CharucoDetection = {
      corners: [],
      markers: [],
      alignment: {
        lattice: "square",
        matrix: [
          [1, 0],
          [0, 1],
        ],
        translation: [0, 0],
      },
    };
    const markerboard: MarkerBoardDetection = { corners: [], alignment: null };
    const markerDiag: MarkerBoardDiagnostics = {
      inliers: [],
      circle_candidates: [],
      circle_matches: [],
      alignment_inliers: 0,
      alignment_runner_up_inliers: 0,
      alignment_ambiguous: false,
    };
    const puzzle: PuzzleBoardDetection = {
      corners: [],
      alignment: {
        lattice: "square",
        matrix: [
          [1, 0],
          [0, 1],
        ],
        translation: [0, 0],
      },
      decode: { edges_observed: 0, edges_matched: 0, mean_confidence: 0, bit_error_rate: 0 },
    };
    const puzzleDiag: PuzzleBoardDiagnostics = { observed_edges: [], decode: {} };
    const raw: Corner[] = [
      {
        position: [3, 4],
        axes: [
          { angle: 0, sigma: 0.1 },
          { angle: 1.5, sigma: 0.1 },
        ],
        strength: 7,
      },
    ];
    const chessboard16: { corners: (ChessboardDetection["corners"][number] & Covariance)[] } = {
      corners: [{ position: [1, 2], grid: { u: 0, v: 0 }, input_index: 0, score: 1, position_covariance: null }],
    };
    const raw16: (Corner & Covariance)[] = [{ ...raw[0]!, position_covariance: { xx: 1, xy: 0, yy: 1 } }];

    const results: CalibTargetsResult[] = [
      { kind: "chessboard", detection: chessboard },
      { kind: "chessboard", detection: null },
      { kind: "charuco", detection: charuco },
      { kind: "markerboard", detection: markerboard, diagnostics: markerDiag },
      { kind: "puzzleboard", detection: puzzle, diagnostics: puzzleDiag },
      { kind: "puzzlepole", detection: puzzle },
      { kind: "corners", corners: raw },
      { kind: "chessboard", detection: chessboard16 },
      { kind: "corners", corners: raw16 },
    ];
    expect(results.map((r) => fromCalibTargets(r).kind)).toEqual([
      "chessboard",
      "chessboard",
      "charuco",
      "markerboard",
      "puzzleboard",
      "puzzleboard",
      "corners",
      "chessboard",
      "corners",
    ]);
    expect(fromCalibTargets({ kind: "corners", corners: raw16 }).corners![0]!.cov).toEqual([1, 0, 1]);
  });
});

describe("fromCalibTargets: chessboard", () => {
  it("maps each corner one to one, in order, with its lattice index and score, and ids by index", () => {
    const detection = fromCalibTargets({ kind: "chessboard", detection: { corners: [corner(1, 2, 0, 0), corner(3, 4, 0, 1)] } });
    expect(detection).toEqual({
      kind: "chessboard",
      corners: [
        { id: "corner-0", x: 1, y: 2, i: 0, j: 0, score: 0.9 },
        { id: "corner-1", x: 3, y: 4, i: 0, j: 1, score: 0.9 },
      ],
    });
  });

  it("passes positions through unchanged: no half-pixel offset anywhere", () => {
    const detection = fromCalibTargets({ kind: "chessboard", detection: { corners: [corner(5.5, 6.5, 2, 3)] } });
    expect(detection.corners![0]).toMatchObject({ x: 5.5, y: 6.5, i: 2, j: 3 });
  });

  it("joins the corners into a lattice, labelled by index", () => {
    const detection = fromCalibTargets({ kind: "chessboard", detection: calibTargetsChessboard() });
    const nodes = cornerNodes(detection);
    expect(latticeEdges(nodes)).toHaveLength(8 * 6 + 9 * 5);
    expect(nodes[10]!.label).toBe("1,1");
  });

  it("is an empty detection of its kind when nothing was found", () => {
    expect(fromCalibTargets({ kind: "chessboard", detection: null })).toEqual({ kind: "chessboard" });
    expect(fromCalibTargets({ kind: "chessboard", detection: undefined })).toEqual({ kind: "chessboard" });
    expect(fromCalibTargets({ kind: "chessboard", detection: { corners: [] } })).toEqual({ kind: "chessboard" });
  });

  it("leaves a corner with no grid label without a lattice index", () => {
    const [unlabelled] = fromCalibTargets({
      kind: "markerboard",
      detection: { corners: [{ position: [1, 1], grid: null, score: 1 }] },
    }).corners!;
    expect(unlabelled).toEqual({ id: "corner-0", x: 1, y: 1, score: 1 });
  });
});

describe("fromCalibTargets: covariance", () => {
  it("carries a position covariance as [xx, xy, yy]", () => {
    const detection = fromCalibTargets({
      kind: "chessboard",
      detection: { corners: [corner(0, 0, 0, 0, { position_covariance: { xx: 0.04, xy: -0.01, yy: 0.09 } })] },
    });
    expect(detection.corners![0]!.cov).toEqual([0.04, -0.01, 0.09]);
  });

  it("has no cov when the covariance is absent, null or not finite", () => {
    const detection = fromCalibTargets({
      kind: "chessboard",
      detection: {
        corners: [
          corner(0, 0, 0, 0),
          corner(0, 0, 1, 0, { position_covariance: null }),
          corner(0, 0, 2, 0, { position_covariance: { xx: Number.NaN, xy: 0, yy: 1 } }),
          corner(0, 0, 3, 0, { position_covariance: { xx: 1, xy: Number.POSITIVE_INFINITY, yy: 1 } }),
        ],
      },
    });
    expect(detection.corners!.map((c) => "cov" in c)).toEqual([false, false, false, false]);
  });

  it("keeps a covariance that is finite but not drawable, and the layer skips it", () => {
    const corners = fromCalibTargets({ kind: "chessboard", detection: calibTargetsChessboard() }).corners!;
    // 52 of the 54 corners report one; the singular one is mapped but has no ellipse.
    expect(corners.filter((c) => c.cov)).toHaveLength(52);
    expect(uncertaintyEllipses(corners, 40)).toHaveLength(51);
  });
});

describe("fromCalibTargets: raw corners", () => {
  it("draws both axes, scores by strength and labels by index", () => {
    const detection = fromCalibTargets({
      kind: "corners",
      corners: [{ position: [426.5, 369.25], axes: [{ angle: 0 }, { angle: Math.PI / 2 }], strength: 12 }],
    });
    expect(detection).toEqual({
      kind: "corners",
      corners: [{ id: "corner-0", x: 426.5, y: 369.25, score: 12, angle: 0, angle2: Math.PI / 2, label: "0" }],
    });
    expect(cornerNodes(detection)[0]).toMatchObject({ kind: "directed", angle: 0, angle2: Math.PI / 2 });
  });

  it("is an empty detection for no corners", () => {
    expect(fromCalibTargets({ kind: "corners", corners: [] })).toEqual({ kind: "corners" });
  });
});

describe("fromCalibTargets: charuco", () => {
  const quad: [Point2, Point2, Point2, Point2] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("keeps each marker's four image corners in order, labelled by its dictionary id", () => {
    const detection = fromCalibTargets({
      kind: "charuco",
      detection: { corners: [corner(1, 2, 0, 0)], markers: [{ id: 4, corners_img: quad }] },
    });
    expect(detection.kind).toBe("charuco");
    expect(detection.markers).toEqual([{ id: "marker-0", corners: [0, 0, 10, 0, 10, 10, 0, 10], label: "4" }]);
    expect(detection.corners).toHaveLength(1);
  });

  it("leaves out a marker with no image quad, keeping the others' ids", () => {
    const detection = fromCalibTargets({
      kind: "charuco",
      detection: {
        corners: [],
        markers: [
          { id: 1, corners_img: null },
          { id: 2, corners_img: quad },
        ],
      },
    });
    expect(detection.markers!.map((m) => [m.id, m.label])).toEqual([["marker-1", "2"]]);
    expect(detection.corners).toBeUndefined();
  });

  it("has no markers part when none has a quad", () => {
    expect(fromCalibTargets({ kind: "charuco", detection: { corners: [], markers: [{ id: 1, corners_img: null }] } })).toEqual({
      kind: "charuco",
    });
  });
});

describe("fromCalibTargets: markerboard", () => {
  const diagnostics = {
    circle_candidates: [{ center_img: [9, 8] as const }, { center_img: [20, 21] as const }],
    circle_matches: [
      { expected: { cell: { i: 3, j: 4 }, polarity: "black" as const }, matched_index: 1 },
      { expected: { cell: { i: 1, j: 1 }, polarity: "white" as const }, matched_index: null },
      { expected: { cell: { i: 5, j: 2 }, polarity: "white" as const }, matched_index: 0 },
      // An index past the candidates is ignored, not a crash.
      { expected: { cell: { i: 6, j: 6 }, polarity: "white" as const }, matched_index: 9 },
    ],
  };

  it("draws the matched circles at the candidate's centre with the board's cell and polarity", () => {
    const detection = fromCalibTargets({ kind: "markerboard", detection: { corners: [corner(1, 2, 0, 0)] }, diagnostics });
    expect(detection.kind).toBe("markerboard");
    expect(detection.circles).toEqual([
      { id: "circle-0", x: 20, y: 21, polarity: "black", i: 3, j: 4 },
      { id: "circle-2", x: 9, y: 8, polarity: "white", i: 5, j: 2 },
    ]);
    expect(detection.corners).toHaveLength(1);
  });

  it("has corners only without diagnostics, or when nothing matched", () => {
    expect(fromCalibTargets({ kind: "markerboard", detection: { corners: [corner(1, 2, 0, 0)] } }).circles).toBeUndefined();
    expect(
      fromCalibTargets({
        kind: "markerboard",
        detection: { corners: [corner(1, 2, 0, 0)] },
        diagnostics: { circle_candidates: [], circle_matches: [] },
      }).circles,
    ).toBeUndefined();
  });
});

describe("fromCalibTargets: puzzleboard", () => {
  const identity = {
    matrix: [
      [1, 0],
      [0, 1],
    ] as const,
    translation: [0, 0] as const,
  };

  it("labels corners with their master index and places the observed edges as edge bits", () => {
    const detection = fromCalibTargets({
      kind: "puzzleboard",
      detection: { corners: [corner(10, 20, 0, 0), corner(30, 20, 1, 0)], alignment: identity },
      diagnostics: { observed_edges: [{ row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 0.5 }] },
    });
    expect(detection.kind).toBe("puzzleboard");
    expect(detection.corners).toMatchObject([
      { id: "corner-0", i: 0, j: 0 },
      { id: "corner-1", i: 1, j: 0 },
    ]);
    expect(detection.edgeBits).toHaveLength(1);
    expect(detection.edgeBits![0]).toMatchObject({ x: 20, y: 20, radius: 5, bit: 1, confidence: 0.5 });
  });

  it("maps local edges through the alignment's row-major matrix and translation", () => {
    // master (i, j) = [[0, 1], [-1, 0]] · (col, row) + (100, 3): local (0,0) is master (100, 3), local (0,1) is (101, 3).
    const detection = fromCalibTargets({
      kind: "puzzleboard",
      detection: {
        corners: [corner(0, 0, 100, 3), corner(0, 8, 101, 3)],
        alignment: {
          matrix: [
            [0, 1],
            [-1, 0],
          ],
          translation: [100, 3],
        },
      },
      diagnostics: { observed_edges: [{ row: 0, col: 0, orientation: "vertical", bit: 0, confidence: 1 }] },
    });
    expect(detection.edgeBits).toHaveLength(1);
    expect(detection.edgeBits![0]).toMatchObject({ x: 0, y: 4, bit: 0 });
  });

  it("reads any nonzero observed bit as 1", () => {
    const detection = fromCalibTargets({
      kind: "puzzleboard",
      detection: { corners: [corner(10, 20, 0, 0), corner(30, 20, 1, 0)], alignment: identity },
      diagnostics: { observed_edges: [{ row: 0, col: 0, orientation: "horizontal", bit: 3, confidence: 1 }] },
    });
    expect(detection.edgeBits![0]!.bit).toBe(1);
  });

  it("has no edge bits without diagnostics, or when no edge has both corners", () => {
    const detection = { corners: [corner(10, 20, 0, 0)], alignment: identity };
    expect(fromCalibTargets({ kind: "puzzleboard", detection }).edgeBits).toBeUndefined();
    expect(
      fromCalibTargets({
        kind: "puzzleboard",
        detection,
        diagnostics: { observed_edges: [{ row: 0, col: 0, orientation: "horizontal", bit: 1, confidence: 1 }] },
      }).edgeBits,
    ).toBeUndefined();
    expect(fromCalibTargets({ kind: "puzzleboard", detection: null, diagnostics: { observed_edges: [] } })).toEqual({
      kind: "puzzleboard",
    });
  });
});

describe("fromCalibTargets: puzzlepole", () => {
  it("draws a pole's corners as a PuzzleBoard lattice", () => {
    const detection = fromCalibTargets({ kind: "puzzlepole", detection: { corners: [corner(0, 0, 4, 0), corner(10, 0, 5, 0)] } });
    expect(detection.kind).toBe("puzzleboard");
    expect(latticeEdges(cornerNodes(detection))).toHaveLength(1);
    expect(detection.edgeBits).toBeUndefined();
  });
});

describe("fromCalibTargets: ids", () => {
  it("are unique across corners, markers and circles", () => {
    const charuco = fromCalibTargets({
      kind: "charuco",
      detection: {
        corners: [corner(0, 0, 0, 0), corner(1, 0, 1, 0)],
        markers: [
          {
            id: 0,
            corners_img: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
          {
            id: 1,
            corners_img: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
        ],
      },
    });
    const ids = [...charuco.corners!.map((c) => c.id), ...charuco.markers!.map((m) => m.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
