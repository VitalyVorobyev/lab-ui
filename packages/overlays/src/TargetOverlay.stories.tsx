import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImageStage, imageViewBox, type StageView } from "@vitavision/stage2d";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { BOARD_IMAGE, FIELD_IMAGE, charuco, chessboard, directedField, markerboard, project, puzzleboard, ringgrid } from "./fixtures.stories";
import { ellipsePath } from "./glyphs";
import type { TargetDetection, TargetHit, TargetId } from "./model";
import { TargetOverlay, type TargetOverlayProps } from "./TargetOverlay";

const BOARD_VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

const hover = fn();
const press = fn();

/** Client position of image point `p` (the view is 1:1 at the origin) on the stage the story renders. */
function at(root: Element, p: { x: number; y: number }, extra: Record<string, unknown> = {}) {
  const stage = root.querySelector("[data-stage]")!.getBoundingClientRect();
  return { clientX: stage.left + p.x + 0.5, clientY: stage.top + p.y + 0.5, pointerId: 1, button: 0, ...extra };
}

const viewport = (root: Element) => root.querySelector("[role=application]")!;

/** The board as the camera saw it: a checker of squares, the markers and discs printed on it. */
function Backdrop({ detection, image }: { detection: TargetDetection; image: { width: number; height: number } }) {
  const polygon = (points: [number, number][]) => points.map(([u, v]) => {
    const p = project(u, v);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");
  const board = detection.kind !== "corners";
  const squares = [];
  if (board && detection.kind !== "ringgrid") {
    for (let b = 0; b < 7; b++) {
      for (let a = 0; a < 10; a++) {
        const light = (a + b) % 2 === 0;
        squares.push(
          <polygon
            key={`${a}-${b}`}
            points={polygon([[a, b], [a + 1, b], [a + 1, b + 1], [a, b + 1]])}
            fill={light ? "rgb(196 200 204)" : "rgb(52 56 62)"}
          />,
        );
      }
    }
  }
  return (
    <svg viewBox={imageViewBox(image)} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <rect x={-0.5} y={-0.5} width={image.width} height={image.height} fill="rgb(24 27 31)" />
      {detection.kind === "ringgrid" && <polygon points={polygon([[0, 0], [10, 0], [10, 7], [0, 7]])} fill="rgb(196 200 204)" />}
      {squares}
      {/* ArUco markers: a dark quad in each light square. */}
      {(detection.markers ?? []).map((m) => (
        <polygon key={m.id} points={m.corners.reduce<string[]>((out, v, k) => (k % 2 === 0 ? [...out, `${v},${m.corners[k + 1]}`] : out), []).join(" ")} fill="rgb(38 42 48)" />
      ))}
      {/* Marker-board discs, in their printed polarity. */}
      {(detection.circles ?? []).map((c) => (
        <ellipse key={c.id} cx={c.x} cy={c.y} rx={9} ry={7} fill={c.polarity === "white" ? "rgb(236 238 240)" : "rgb(20 22 26)"} />
      ))}
      {/* Ring bands, from the fitted ellipses. */}
      {(detection.rings ?? []).map((r) => (
        <g key={r.id}>
          <path d={ellipsePath(r.x, r.y, r.outer.rx, r.outer.ry, r.outer.angle)} fill="rgb(38 42 48)" />
          {r.inner && <path d={ellipsePath(r.x, r.y, r.inner.rx, r.inner.ry, r.inner.angle)} fill="rgb(196 200 204)" />}
        </g>
      ))}
    </svg>
  );
}

function Frame({
  detection,
  image = BOARD_IMAGE,
  view = BOARD_VIEW,
  viewport: size = { width: image.width * view.scale, height: image.height * view.scale },
  children,
}: {
  detection: TargetDetection;
  image?: { width: number; height: number };
  view?: StageView;
  /** The frame's size in CSS px; the scaled image by default. */
  viewport?: { width: number; height: number };
  children: React.ReactNode;
}) {
  return (
    <ImageStage
      image={image}
      view={view}
      onView={() => {}}
      style={{ width: size.width + 2, height: size.height + 2 }}
    >
      <Backdrop detection={detection} image={image} />
      {children}
    </ImageStage>
  );
}

function Harness({ detection, ...props }: { detection: TargetDetection } & Partial<TargetOverlayProps>) {
  const [selected, setSelected] = useState<Set<TargetId>>(() => new Set());
  return (
    <div>
      <Frame detection={detection}>
        <TargetOverlay
          detection={detection}
          {...props}
          selectedIds={selected}
          onHoverChange={hover}
          onItemPress={(hit: TargetHit) => {
            press(hit);
            setSelected(new Set([hit.id]));
          }}
        />
      </Frame>
      <output data-testid="selected">{[...selected].map(String).join(",") || "none"}</output>
    </div>
  );
}

const CHESSBOARD = chessboard();
const CHARUCO = charuco();
const MARKERBOARD = markerboard();
const PUZZLEBOARD = puzzleboard();
const RINGGRID = ringgrid();

const meta = {
  title: "overlays/TargetOverlay",
  component: TargetOverlay,
  parameters: {
    docs: {
      description: {
        component: `A calibration-target detection over the image: one component for a chessboard, a ChArUco board, a
marker board, a PuzzleBoard, a ring grid, or a loose set of corners. It replaces the per-board overlays and glyph
components that each app wrote for itself, and draws through \`@vitavision/stage2d\`'s batched layers, so a detection
of thousands of items is a few dozen DOM nodes and the pointer is resolved by the stage's hit-test index, not the DOM.

**The input** is a \`TargetDetection\`, independent of the detector that produced it. Positions are image pixels with the
centre of pixel \`i\` at coordinate \`i\` (what the WASM detectors report); the stage places them, so do not add 0.5.
Angles are radians, clockwise on screen. An app maps its detector's result to this shape once.

| Part | Drawn as | Layer |
|---|---|---|
| \`corners\` | plus (5 px arms); the edge directions when \`angle\` is set; lattice edges and \`i,j\` labels on a board | \`GridLayer\` |
| \`markers\` | quad outline and 12 % fill, corner 0 ticked, id inside | \`AreaSet\` |
| \`circles\` | hollow ring for white, ring with a centre dot for black | \`PointSet\` |
| \`rings\` | fitted outer and inner ellipse (image-sized), plus at the centre | \`EllipseSet\` + \`PointSet\` |
| \`edgeBits\` | dot on the edge: solid for 1, dashed for 0, opacity from confidence | \`EllipseSet\` |

- **States:** hover 2 px, selected 2.5 px in the selection colour with a ring on points, dimmed at 35 % opacity.
  \`hoveredId\` and \`selectedIds\` are controlled by the app; a hover it does not control is tracked here.
- **Colour:** roles only. A score is never drawn as red, amber or green, and polarity and bits are shapes (hollow or
  dotted, solid or dashed), not hues: colour is never the only channel.
- **Labels** (lattice indices, marker and ring ids) appear only where items are at least 24 screen px apart, at most
  200 at a time. \`showLabels={false}\` hides them; \`showEdges={false}\` hides the lattice edges.
- **Callbacks** report \`{ id, part }\` with the id from the detection, so the app maps it back to its feature. Keep ids
  unique within a detection. Setting \`onItemPress\` makes the layers claim presses on their items.

**Use** it for any detection of the calibration targets above, inside an \`ImageStage\`, with a list of the same
features beside it.

**Don't** use it for residuals or reprojections (a \`PointSet\` of \`hollow\` markers and a \`PolylineSet\`), or for a
hand-drawn annotation (\`AreaSet\`, \`PolylineSet\`). Don't compare two detections here by overlaying them: put the second in
the \`model\` role through \`PointSet\`.

**Accessibility**: every layer is a named image with a count ("Corners: 54 points, 0 selected"); the lattice edges and
ellipses are decorative. Picking is by pointer, so the same selection must be possible from the list beside the stage,
which is also where a screen reader finds it.`,
      },
    },
  },
  args: { detection: CHESSBOARD },
  render: (args) => <Harness detection={args.detection} />,
} satisfies Meta<typeof TargetOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chessboard: Story = {
  render: () => <Harness detection={CHESSBOARD} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Corners: 54 points, 0 selected" })).toBeInTheDocument();
    // Two axes are two batches, the j axis dashed so they differ by more than colour: not one element per edge.
    await expect(canvasElement.querySelectorAll("path[data-edge-batch]")).toHaveLength(2);
    await expect(canvasElement.querySelector("path[data-edge-batch='j|0']")!.getAttribute("stroke-dasharray")).not.toBeNull();
    await expect(canvasElement.querySelector("path[data-edge-batch='i|0']")!.getAttribute("stroke-dasharray")).toBeNull();
    // 9×6 corners: 8×6 edges along i and 9×5 along j.
    await expect((canvasElement.querySelector("path[data-edge-batch='i|0']")!.getAttribute("d")!.match(/M/g) ?? []).length).toBe(48);
    await expect((canvasElement.querySelector("path[data-edge-batch='j|0']")!.getAttribute("d")!.match(/M/g) ?? []).length).toBe(45);
    // Lattice indices label the corners where they have room.
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((t) => t.textContent);
    await expect(labels).toEqual(expect.arrayContaining(["0,0", "8,5"]));
    // Colours are roles, never a hex.
    await expect(canvasElement.querySelector("path[data-batch]")!.getAttribute("stroke")).toBe("var(--stage-feature)");
  },
};

export const MissedCorners: Story = {
  render: () => <Harness detection={chessboard(["3,2", "4,2", "8,5"])} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Corners: 51 points, 0 selected" })).toBeInTheDocument();
    // A missed corner leaves a gap, never a long edge: (3,2) and (4,2) take three edges along i between them and (8,5) one more.
    const i = canvasElement.querySelector("path[data-edge-batch='i|0']")!;
    const j = canvasElement.querySelector("path[data-edge-batch='j|0']")!;
    await expect((i.getAttribute("d")!.match(/M/g) ?? []).length).toBe(48 - 4);
    await expect((j.getAttribute("d")!.match(/M/g) ?? []).length).toBe(45 - 5);
  },
};

export const Charuco: Story = {
  render: () => <Harness detection={CHARUCO} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Markers: 35 areas, 0 selected" })).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Corners: 54 points, 0 selected" })).toBeInTheDocument();
    // Corner 0 of each marker is ticked, and the id is inside.
    await expect(canvasElement.querySelector("path[data-ticks]")).not.toBeNull();
    const ids = [...canvasElement.querySelectorAll("[data-labels] text")].map((t) => t.textContent);
    await expect(ids).toEqual(expect.arrayContaining(["0", "1", "34"]));
  },
};

export const Markerboard: Story = {
  render: () => <Harness detection={MARKERBOARD} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Circles: 3 points, 0 selected" })).toBeInTheDocument();
    // Polarity is a shape: two white rings and one black ring with a dot.
    await expect(canvasElement.querySelector("path[data-batch='0|feature|circle-white']")).not.toBeNull();
    await expect(canvasElement.querySelector("path[data-batch='0|feature|circle-black']")).not.toBeNull();
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((t) => t.textContent);
    await expect(labels).toEqual(expect.arrayContaining(["(2, 1)", "(5, 2)", "(3, 4)"]));
  },
};

export const Puzzleboard: Story = {
  render: () => <Harness detection={PUZZLEBOARD} />,
  play: async ({ canvasElement }) => {
    // 93 edge bits: solid for 1, dashed for 0, in a handful of opacity batches, not 93 elements.
    const dots = canvasElement.querySelector("svg[data-ellipses='93']")!;
    await expect(dots).not.toBeNull();
    await expect(dots.querySelectorAll("path[data-batch]").length).toBeLessThan(24);
    await expect(dots.querySelector("path[data-batch*='dashed'][stroke-dasharray]")).not.toBeNull();
    await expect(dots.querySelector("path[data-batch*='solid']")).not.toBeNull();
    // The corners carry the board's master indices, which wrap the 501 period.
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((t) => t.textContent);
    await expect(labels).toContain("100,3");
  },
};

export const Ringgrid: Story = {
  render: () => <Harness detection={RINGGRID} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Rings: 28 points, 0 selected" })).toBeInTheDocument();
    // Outer and inner edges are two ellipse layers of 28; their size is the data's.
    await expect(canvasElement.querySelectorAll("svg[data-ellipses='28']")).toHaveLength(2);
    // No lattice, so no edges.
    await expect(canvasElement.querySelector("[data-edges]")).toBeNull();
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((t) => t.textContent);
    await expect(labels).toEqual(expect.arrayContaining(["00", "1B"]));
  },
};

/** 5,000 corners, each with its two edge directions, seen at half size: a handful of paths, and labels only where there is room. */
export const DirectedField: Story = {
  render: () => {
    const detection = directedField();
    return (
      <Frame detection={detection} image={FIELD_IMAGE} view={{ scale: 0.5, tx: 0, ty: 0 }}>
        <TargetOverlay detection={detection} />
      </Frame>
    );
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Corners: 5000 points, 0 selected" })).toBeInTheDocument();
    // Batched: a few paths for 5,000 corners (the rest are labels, at most 200).
    await expect(canvasElement.querySelectorAll("svg path").length).toBeLessThan(30);
    // Corners are 8 screen px apart, so only a thinned subset (24 px apart) is labelled.
    const labels = canvasElement.querySelectorAll("[data-labels] text");
    await expect(labels.length).toBeGreaterThan(0);
    await expect(labels.length).toBeLessThanOrEqual(200);
    // Two axes per corner, each two segments: four per corner in one path.
    await expect((canvasElement.querySelector("path[data-batch$='directed']")!.getAttribute("d")!.match(/M/g) ?? []).length).toBe(20000);
  },
};

/** The same field zoomed to 3×: now corners are 48 screen px apart, and they carry labels. */
export const DirectedFieldZoomed: Story = {
  render: () => {
    const detection = directedField();
    return (
      <Frame detection={detection} image={FIELD_IMAGE} view={{ scale: 3, tx: -200 * 3, ty: -100 * 3 }} viewport={{ width: 720, height: 420 }}>
        <TargetOverlay detection={detection} />
      </Frame>
    );
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll("[data-labels] text");
    await expect(labels.length).toBeGreaterThan(10);
    await expect(labels.length).toBeLessThanOrEqual(200);
  },
};

export const LabelsOff: Story = {
  render: () => (
    <Frame detection={CHARUCO}>
      <TargetOverlay detection={CHARUCO} showLabels={false} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-labels]")).toBeNull();
  },
};

export const EdgesOff: Story = {
  render: () => (
    <Frame detection={CHESSBOARD}>
      <TargetOverlay detection={CHESSBOARD} showEdges={false} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("path[data-edge-batch]")).toHaveLength(0);
  },
};

export const Hovered: Story = {
  render: () => (
    <Frame detection={CHARUCO}>
      <TargetOverlay detection={CHARUCO} hoveredId={4} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    // Id 4 is a marker: only the marker layer shows it hovered.
    await expect(canvasElement.querySelector("svg[data-hovered='4']")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-hovered-area]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-hovered-point]")).toBeNull();
  },
};

export const HoveredCorner: Story = {
  render: () => (
    <Frame detection={CHARUCO}>
      <TargetOverlay detection={CHARUCO} hoveredId="c4-2" />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg[data-hovered='c4-2']")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-hovered-point]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-hovered-area]")).toBeNull();
  },
};

export const Selected: Story = {
  render: () => (
    <Frame detection={MARKERBOARD}>
      <TargetOverlay detection={MARKERBOARD} selectedIds={["c4-2", "c5-2", "circle1"]} />
    </Frame>
  ),
  play: async ({ canvas, canvasElement }) => {
    // Each layer counts only the selected ids it owns, and a selected point has a ring.
    await expect(canvas.getByRole("img", { name: "Corners: 54 points, 2 selected" })).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Circles: 3 points, 1 selected" })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("[data-selection-rings]").length).toBeGreaterThanOrEqual(2);
  },
};

export const SelectedRing: Story = {
  render: () => (
    <Frame detection={RINGGRID}>
      <TargetOverlay detection={RINGGRID} selectedIds={[9]} hoveredId={10} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    // The selected ring's ellipses switch to the selection colour; the hovered one thickens.
    await expect(canvasElement.querySelectorAll("[data-selected-ellipses]")).toHaveLength(2);
    await expect(canvasElement.querySelectorAll("[data-hovered-ellipse]")).toHaveLength(2);
  },
};

export const Dimmed: Story = {
  render: () => (
    <Frame detection={CHARUCO}>
      <TargetOverlay detection={CHARUCO} dimmed />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path[opacity='0.35'], g[opacity='0.35']")).not.toBeNull();
  },
};

/** Dim everything but one marker: a predicate over ids, the way a filter or a list selection does it. */
export const DimmedExceptOne: Story = {
  render: () => (
    <Frame detection={CHARUCO}>
      <TargetOverlay detection={CHARUCO} dimmed={dimExceptMarker7} selectedIds={[7]} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[opacity='0.35']").length).toBeGreaterThan(0);
    await expect(canvasElement.querySelector("[data-selected-areas]")).not.toBeNull();
  },
};

/** Dim a listed set of ids, the simple form of the same thing. */
export const DimmedList: Story = {
  render: () => (
    <Frame detection={CHARUCO}>
      <TargetOverlay detection={CHARUCO} dimmed={DIMMED_MARKERS} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("g[opacity='0.35']").length).toBeGreaterThan(0);
  },
};

const DIMMED_MARKERS: readonly TargetId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Stable, so the layers do not re-batch. */
function dimExceptMarker7(id: TargetId): boolean {
  return id !== 7;
}

export const HoverAndPress: Story = {
  render: () => <Harness detection={CHARUCO} />,
  play: async ({ canvas, canvasElement }) => {
    hover.mockClear();
    press.mockClear();
    const stage = viewport(canvasElement);
    const corner = CHARUCO.corners!.find((c) => c.id === "c3-2")!;
    const marker = CHARUCO.markers!.find((m) => m.id === 6)!;
    const centre = { x: (marker.corners[0]! + marker.corners[4]!) / 2, y: (marker.corners[1]! + marker.corners[5]!) / 2 };

    // Hover a corner, then the marker beside it: each change is reported once, with the id from the detection.
    await fireEvent.pointerMove(stage, at(canvasElement, corner));
    await waitFor(() => expect(hover).toHaveBeenLastCalledWith({ id: "c3-2", part: "corner" }));
    await fireEvent.pointerMove(stage, at(canvasElement, centre));
    await waitFor(() => expect(hover).toHaveBeenLastCalledWith({ id: 6, part: "marker" }));
    await expect(hover.mock.calls.map((call: unknown[]) => call[0])).toEqual([{ id: "c3-2", part: "corner" }, { id: 6, part: "marker" }]);
    await waitFor(() => expect(canvasElement.querySelector("svg[data-hovered='6']")).not.toBeNull());

    // Off every item.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 5, y: 5 }));
    await waitFor(() => expect(hover).toHaveBeenLastCalledWith(null));

    // A press selects, and the stage does not pan from it.
    await fireEvent.pointerDown(stage, at(canvasElement, corner));
    await waitFor(() => expect(press).toHaveBeenCalledWith({ id: "c3-2", part: "corner" }));
    await expect(stage).not.toHaveAttribute("data-panning");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("c3-2"));
    await expect(canvas.getByRole("img", { name: "Corners: 54 points, 1 selected" })).toBeInTheDocument();
    await fireEvent.pointerUp(stage, at(canvasElement, corner));

    await fireEvent.pointerDown(stage, at(canvasElement, centre));
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("6"));
    await fireEvent.pointerUp(stage, at(canvasElement, centre));
  },
};

export const PressRing: Story = {
  render: () => <Harness detection={RINGGRID} />,
  play: async ({ canvas, canvasElement }) => {
    press.mockClear();
    const stage = viewport(canvasElement);
    const ring = RINGGRID.rings![9]!;
    // A ring is picked anywhere inside its outer ellipse, not only at its centre.
    const edge = { x: ring.x + 0.8 * ring.outer.rx * Math.cos(ring.outer.angle), y: ring.y + 0.8 * ring.outer.rx * Math.sin(ring.outer.angle) };
    await fireEvent.pointerDown(stage, at(canvasElement, edge));
    await waitFor(() => expect(press).toHaveBeenCalledWith({ id: 9, part: "ring" }));
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("9"));
    await fireEvent.pointerUp(stage, at(canvasElement, edge));
  },
};

export const WithoutPressHandler: Story = {
  render: () => (
    <Frame detection={CHESSBOARD}>
      <TargetOverlay detection={CHESSBOARD} layerIdPrefix="board" />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    // Without `onItemPress` the layers do not claim presses: a press on a corner pans the stage.
    const stage = viewport(canvasElement);
    const corner = CHESSBOARD.corners![10]!;
    await fireEvent.pointerDown(stage, at(canvasElement, corner));
    await expect(stage).toHaveAttribute("data-panning");
    await fireEvent.pointerUp(stage, at(canvasElement, corner));
  },
};
