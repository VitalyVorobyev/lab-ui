import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useId } from "react";

/**
 * The overlay grammar (PLAN §5) on a synthetic ChArUco frame: one glyph per feature kind,
 * one colour per role, strokes in screen pixels at any zoom, and the hover / selected /
 * dimmed states. The values here are the proposal `docs/visual-language.md` §5 records;
 * `stage2d` gets them as tokens in L6-2.
 */

/**
 * Role colours. Overlays sit on the image, not on the chrome, so they are one set for both
 * themes — the dark theme's `signal` for selection, because the canvas is dark in both.
 * `feature` and `model` were searched in OKLCH (`tools/visual-language/colours.py`):
 * under typical vision and each simulated dichromacy they stay ≥ 7.3 OKLab ΔE×100 from each
 * other, from `selection`, from the label white and from every verdict colour.
 */
const ROLE = {
  feature: "#ed9d43",
  model: "#9dbdff",
  structure: "rgba(232, 235, 237, 0.55)",
  selection: "#2db2d4",
  halo: "rgba(8, 10, 11, 0.72)",
  label: "#e8ebed",
} as const;

/** Screen-pixel sizes: the same on screen at every zoom. */
const PX = { stroke: 1.5, hover: 2, selected: 2.5, halo: 2, arm: 5, ring: 4, dot: 2.5, label: 11 } as const;

const SQUARE = 40;
const BOARD = { x: 60, y: 50, cols: 8, rows: 5 };
const IMAGE = { width: 440, height: 300 };

interface Corner {
  i: number;
  j: number;
  x: number;
  y: number;
  /** Where the calibrated model projects this corner. */
  mx: number;
  my: number;
}

/** Inner corners with a deterministic sub-pixel detection error against the model. */
const CORNERS: Corner[] = Array.from({ length: (BOARD.cols - 1) * (BOARD.rows - 1) }, (_, index) => {
  const i = (index % (BOARD.cols - 1)) + 1;
  const j = Math.floor(index / (BOARD.cols - 1)) + 1;
  const mx = BOARD.x + i * SQUARE;
  const my = BOARD.y + j * SQUARE;
  return { i, j, mx, my, x: mx + 0.9 * Math.sin(i * 1.3 + j), y: my + 0.8 * Math.cos(i * 0.7 + j * 1.9) };
});

/** ArUco markers sit in the white squares of a ChArUco board. */
const MARKERS = [
  { id: 7, col: 1, row: 0 },
  { id: 12, col: 2, row: 1 },
  { id: 21, col: 5, row: 2 },
];

/** How much a residual is drawn longer than it is, so a 0.5 px error is visible. */
const RESIDUAL_GAIN = 12;

/** A glyph stroked twice: a dark halo under the colour, so it holds on any image. */
function Stroked({ d, colour, width, scale, dash }: { d: string; colour: string; width: number; scale: number; dash?: string }) {
  const dashArray = dash?.split(" ").map((part) => Number(part) / scale).join(" ");
  return (
    <>
      <path d={d} fill="none" stroke={ROLE.halo} strokeWidth={(width + PX.halo) / scale} strokeLinecap="round" />
      <path d={d} fill="none" stroke={colour} strokeWidth={width / scale} strokeLinecap="round" strokeDasharray={dashArray} />
    </>
  );
}

function plus(x: number, y: number, arm: number): string {
  return `M${x - arm} ${y}H${x + arm}M${x} ${y - arm}V${y + arm}`;
}

function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

function Label({ x, y, scale, children }: { x: number; y: number; scale: number; children: ReactNode }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={PX.label / scale}
      className="font-mono"
      fill={ROLE.label}
      stroke={ROLE.halo}
      strokeWidth={3 / scale}
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

/** The synthetic frame: a grey ground with a vignette and the checkerboard. */
function Frame({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-vignette`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#9aa0a4" />
          <stop offset="100%" stopColor="#3d4144" />
        </radialGradient>
        <pattern id={`${id}-checker`} x={BOARD.x} y={BOARD.y} width={2 * SQUARE} height={2 * SQUARE} patternUnits="userSpaceOnUse">
          <rect width={2 * SQUARE} height={2 * SQUARE} fill="#d9dcde" />
          <rect width={SQUARE} height={SQUARE} fill="#1b1d1f" />
          <rect x={SQUARE} y={SQUARE} width={SQUARE} height={SQUARE} fill="#1b1d1f" />
        </pattern>
      </defs>
      <rect width={IMAGE.width} height={IMAGE.height} fill={`url(#${id}-vignette)`} />
      <rect x={BOARD.x} y={BOARD.y} width={BOARD.cols * SQUARE} height={BOARD.rows * SQUARE} fill={`url(#${id}-checker)`} />
    </>
  );
}

/** Every layer of the grammar at one zoom. */
function Layers({ scale, labels }: { scale: number; labels: boolean }) {
  const board = `M${BOARD.x} ${BOARD.y}h${BOARD.cols * SQUARE}v${BOARD.rows * SQUARE}h${-BOARD.cols * SQUARE}Z`;
  const selected = CORNERS[10];
  return (
    <g>
      <Stroked d={board} colour={ROLE.structure} width={1} scale={scale} />
      {MARKERS.map(({ id, col, row }) => {
        const x = BOARD.x + col * SQUARE + 8;
        const y = BOARD.y + row * SQUARE + 8;
        const side = SQUARE - 16;
        return (
          <g key={id}>
            <Stroked d={`M${x} ${y}h${side}v${side}h${-side}Z`} colour={ROLE.feature} width={PX.stroke} scale={scale} />
            <rect x={x - 1.5 / scale} y={y - 1.5 / scale} width={3 / scale} height={3 / scale} fill={ROLE.feature} />
            {labels && (
              <Label x={x + 3 / scale} y={y + side - 3 / scale} scale={scale}>
                {id}
              </Label>
            )}
          </g>
        );
      })}
      {CORNERS.map((corner) => (
        <g key={`${corner.i},${corner.j}`}>
          <Stroked
            d={`M${corner.x} ${corner.y}L${corner.x + (corner.mx - corner.x) * RESIDUAL_GAIN} ${corner.y + (corner.my - corner.y) * RESIDUAL_GAIN}`}
            colour={ROLE.model}
            width={1}
            scale={scale}
          />
          <Stroked d={circle(corner.mx, corner.my, PX.ring / scale)} colour={ROLE.model} width={1} scale={scale} />
          <Stroked d={plus(corner.x, corner.y, PX.arm / scale)} colour={ROLE.feature} width={PX.stroke} scale={scale} />
          {labels && (
            <Label x={corner.x + 6 / scale} y={corner.y - 6 / scale} scale={scale}>
              {corner.i},{corner.j}
            </Label>
          )}
        </g>
      ))}
      {selected && (
        <>
          <Stroked d={circle(selected.x, selected.y, (PX.arm + 4) / scale)} colour={ROLE.selection} width={PX.selected} scale={scale} />
          <Stroked d={plus(selected.x, selected.y, PX.arm / scale)} colour={ROLE.selection} width={PX.selected} scale={scale} />
        </>
      )}
      <Stroked d={circle(BOARD.x, BOARD.y, 7 / scale)} colour={ROLE.label} width={PX.stroke} scale={scale} />
      <Stroked d={`M${BOARD.x} ${BOARD.y}h${28 / scale}`} colour={ROLE.label} width={PX.stroke} scale={scale} />
      <Stroked d={`M${BOARD.x} ${BOARD.y}v${28 / scale}`} colour={ROLE.label} width={PX.stroke} scale={scale} />
      <Label x={BOARD.x + 30 / scale} y={BOARD.y + 4 / scale} scale={scale}>
        i
      </Label>
      <Label x={BOARD.x - 14 / scale} y={BOARD.y + 38 / scale} scale={scale}>
        j
      </Label>
    </g>
  );
}

/** One viewport onto the frame: `view` is the visible image rectangle, drawn `width` px wide. */
function Viewport({ view, width, labels, caption }: { view: [number, number, number, number]; width: number; labels: boolean; caption: string }) {
  const scale = width / view[2];
  const id = useId();
  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={view.join(" ")}
        width={width}
        height={(view[3] / view[2]) * width}
        role="img"
        aria-label={caption}
        className="rounded-panel bg-canvas"
      >
        <Frame id={id} />
        <Layers scale={scale} labels={labels} />
      </svg>
      <figcaption className="font-mono text-xs text-fg-muted">{caption}</figcaption>
    </figure>
  );
}

const LEGEND: { swatch: ReactNode; name: string; rule: string }[] = [
  { swatch: <path d={plus(12, 12, 5)} stroke={ROLE.feature} strokeWidth={1.5} />, name: "corner / X-junction", rule: "plus, 5 px arms — the centre stays visible" },
  { swatch: <rect x={5} y={5} width={14} height={14} fill="none" stroke={ROLE.feature} strokeWidth={1.5} />, name: "marker (ArUco, AprilTag)", rule: "quad outline, corner 0 ticked, id inside" },
  { swatch: <circle cx={12} cy={12} r={2.5} fill={ROLE.feature} />, name: "blob / circle centre / keypoint", rule: "dot, r 2.5 px" },
  {
    swatch: (
      <>
        <ellipse cx={12} cy={12} rx={8} ry={5} fill="none" stroke={ROLE.feature} strokeWidth={1.5} />
        <path d={plus(12, 12, 2.5)} stroke={ROLE.feature} strokeWidth={1} />
      </>
    ),
    name: "ring / ellipse target", rule: "fitted ellipse + plus at the centre" },
  { swatch: <circle cx={12} cy={12} r={4} fill="none" stroke={ROLE.model} strokeWidth={1} />, name: "reprojected / predicted", rule: "hollow circle r 4 px, model colour" },
  { swatch: <path d="M5 16L19 8" stroke={ROLE.model} strokeWidth={1} />, name: "residual", rule: `observed → model, drawn ×${RESIDUAL_GAIN}; the gain is in the legend` },
  { swatch: <path d="M4 12H20" stroke={ROLE.label} strokeWidth={1.5} strokeDasharray="4 3" />, name: "ground truth / reference", rule: "dashed 4 3; the prediction is solid" },
  { swatch: <path d="M4 7H20M4 17H20" stroke={ROLE.structure} strokeWidth={1} />, name: "structure (board, grid)", rule: "1 px, 55 % white — context, not data" },
];

const meta = {
  title: "Foundations/Overlay grammar",
  parameters: {
    docs: {
      description: {
        component: `How geometry is drawn over an image, in \`stage2d\`, \`overlays\` and \`three\`:
strokes are **screen** pixels at every zoom (\`width / scale\`, not \`vector-effect\`, which is
unreliable under a CSS transform), each feature kind has one glyph, and each role one colour. Every
glyph has a dark halo so it holds on a bright or a dark image. Spec: \`docs/visual-language.md\` §5.`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole frame, and 4× on one corner: strokes, glyphs and labels keep their screen size. */
export const Zoom: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <Viewport view={[0, 0, IMAGE.width, IMAGE.height]} width={440} labels={false} caption="1× — labels hidden: too dense to read" />
      <Viewport view={[120, 90, 110, 75]} width={440} labels caption="4× — same stroke widths, labels shown" />
    </div>
  ),
};

/** One glyph per feature kind, one colour per role. */
export const Glyphs: Story = {
  render: () => (
    <ul className="grid max-w-3xl grid-cols-2 gap-x-8 gap-y-2">
      {LEGEND.map(({ swatch, name, rule }) => (
        <li key={name} className="grid grid-cols-[2rem_1fr] items-center gap-3">
          <svg viewBox="0 0 24 24" className="size-8 rounded-control bg-canvas" aria-hidden>
            {swatch}
          </svg>
          <span className="flex flex-col">
            <span className="text-xs font-medium">{name}</span>
            <span className="text-xs text-fg-muted">{rule}</span>
          </span>
        </li>
      ))}
    </ul>
  ),
};

const STATES: { name: string; colour: string; width: number; opacity: number; ring: boolean; rule: string }[] = [
  { name: "default", colour: ROLE.feature, width: PX.stroke, opacity: 1, ring: false, rule: "1.5 px, role colour" },
  { name: "hover", colour: ROLE.feature, width: PX.hover, opacity: 1, ring: false, rule: "2 px — nothing else moves" },
  { name: "selected", colour: ROLE.selection, width: PX.selected, opacity: 1, ring: true, rule: "2.5 px signal + ring" },
  { name: "dimmed", colour: ROLE.feature, width: PX.stroke, opacity: 0.35, ring: false, rule: "35 % — not in the current set" },
];

/** The state model: one glyph in each state, on the canvas. */
export const States: Story = {
  render: () => (
    <ul className="flex flex-wrap gap-4">
      {STATES.map(({ name, colour, width, opacity, ring, rule }) => (
        <li key={name} className="flex w-40 flex-col gap-1.5">
          <svg viewBox="0 0 80 56" className="h-28 w-40 rounded-panel bg-canvas" aria-hidden>
            <g opacity={opacity}>
              <Stroked d="M18 14h24v24h-24Z" colour={colour} width={width} scale={1} />
              <Stroked d={plus(60, 26, PX.arm)} colour={colour} width={width} scale={1} />
              {ring && <Stroked d={circle(60, 26, PX.arm + 4)} colour={colour} width={width} scale={1} />}
            </g>
          </svg>
          <span className="text-xs font-medium">{name}</span>
          <span className="text-xs text-fg-muted">{rule}</span>
        </li>
      ))}
    </ul>
  ),
};
