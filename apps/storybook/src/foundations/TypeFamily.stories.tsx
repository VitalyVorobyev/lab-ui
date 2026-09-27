import type { Meta, StoryObj } from "@storybook/react-vite";
import { LineChart, type Series } from "@vitavision/charts";
import {
  Badge,
  Button,
  type Column,
  Field,
  NumberInput,
  Panel,
  ReadoutStrip,
  SegmentedControl,
  Select,
  Switch,
  Table,
} from "@vitavision/ui";
import { useState } from "react";
import { expect } from "storybook/test";

/**
 * Decision D1 (PLAN §8): the default type pair. Each column is the same instrument screen —
 * the ramp the packages actually use, a help paragraph, the confusable glyphs, a numeric
 * table, an inspector, and a chart — set in one candidate, at the same pixel sizes, in the
 * build and settings it would ship with (`src/styles.css` has the details).
 */

type Family = "plex" | "inter";

/** A candidate as it would ship, or (`-today`) as the apps load it now. */
type Variant = Family | "plex-today" | "inter-today";

const FAMILIES: Record<Family, { name: string; today: string }> = {
  plex: { name: "IBM Plex Sans + IBM Plex Mono", today: "lab-ui and VAL today" },
  inter: { name: "Inter + Geist Mono", today: "vitavision and calibration-rs today" },
};

const VARIANTS: { variant: Variant; name: string; note: string }[] = [
  { variant: "plex-today", name: "Plex, today", note: "fontsource Plex Mono: dotted zero" },
  { variant: "plex", name: "Plex, as shipped", note: "IBM's complete Plex Mono: slashed zero" },
  { variant: "inter-today", name: "Inter, today", note: "I and l identical; tnum re-spaces the hyphen" },
  { variant: "inter", name: "Inter, as shipped", note: "cv05 + cv08: l with a tail, I with serifs" },
];

/** The sizes and weights the packages use (10 / 11 / 12 / 14 / 20 px), each in its role. */
const RAMP: { spec: string; className: string; sample: string }[] = [
  { spec: "20 · 600", className: "text-xl font-semibold tracking-tight", sample: "Stereo rig calibration" },
  { spec: "14 · 600", className: "text-sm font-semibold tracking-tight", sample: "Intrinsics and distortion" },
  { spec: "14 · 400", className: "text-sm", sample: "Reprojection error fell below target." },
  { spec: "12 · 500", className: "text-xs font-medium", sample: "Square size, marker dictionary" },
  { spec: "12 · 400", className: "text-xs text-fg-muted", sample: "Measured across the full board." },
  { spec: "11 · 600", className: "text-[11px] font-semibold uppercase tracking-wider text-fg-muted", sample: "Compact panel title" },
  { spec: "10 · 400", className: "text-[10px] text-fg-muted", sample: "Axis tick 0.0 0.5 1.0 1.5 2.0" },
  { spec: "mono 14", className: "font-mono text-sm", sample: "fx 3456.218  fy 3455.902" },
  { spec: "mono 12", className: "font-mono text-xs", sample: "rms 0.1840 px  k1 −0.08213" },
  { spec: "mono 11", className: "font-mono text-[11px]", sample: "frame 012/042  5472×3648" },
];

interface Camera {
  id: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  rms: number;
}

const CAMERAS: Camera[] = [
  { id: "cam0", fx: 3456.218, fy: 3455.902, cx: 2736.41, cy: 1824.07, rms: 0.184 },
  { id: "cam1", fx: 3461.007, fy: 3460.115, cx: 2731.88, cy: 1830.52, rms: 0.211 },
  { id: "cam2", fx: 1111.111, fy: 1110.001, cx: 960.0, cy: 540.0, rms: 1.087 },
];

const COLUMNS: Column<Camera>[] = [
  { key: "id", header: "Camera", cell: (row) => row.id },
  { key: "fx", header: "fx", numeric: true, cell: (row) => row.fx.toFixed(3) },
  { key: "fy", header: "fy", numeric: true, cell: (row) => row.fy.toFixed(3) },
  { key: "cx", header: "cx", numeric: true, cell: (row) => row.cx.toFixed(2) },
  { key: "cy", header: "cy", numeric: true, cell: (row) => row.cy.toFixed(2) },
  { key: "rms", header: "RMS (px)", numeric: true, cell: (row) => row.rms.toFixed(3) },
];

/** RMS reprojection error per solver iteration: a fast drop, then a floor. */
function rms(start: number, floor: number): Series["points"] {
  return Array.from({ length: 16 }, (_, index) => ({ x: index, y: floor + (start - floor) * Math.exp(-0.45 * index) }));
}

const CONVERGENCE: Series[] = [
  { name: "cam0", points: rms(2.4, 0.184) },
  { name: "cam1", points: rms(3.1, 0.211) },
];

const TARGETS = [
  { value: "chessboard", label: "Chessboard" },
  { value: "charuco", label: "ChArUco", note: "DICT_4X4_50" },
  { value: "ringgrid", label: "Ring grid" },
];

function Inspector() {
  const [target, setTarget] = useState("charuco");
  const [refine, setRefine] = useState(true);
  const [overlay, setOverlay] = useState("residuals");
  return (
    <Panel title="Detector" actions={<Badge tone="normal">converged</Badge>}>
      <div className="flex flex-col gap-3">
        <Field label="Target">
          <Select value={target} onValueChange={setTarget} options={TARGETS} />
        </Field>
        <Field label="Square size" annotation="mm" description="Measured across the full board.">
          <NumberInput min={1} max={500} step={0.001} defaultValue={20.015} />
        </Field>
        <Switch
          checked={refine}
          onCheckedChange={setRefine}
          label="Subpixel refinement"
          description="Saddle-point fit in a 5 px window."
        />
        <SegmentedControl
          aria-label="Overlay"
          value={overlay}
          onValueChange={setOverlay}
          options={[
            { value: "detections", label: "Detections" },
            { value: "reprojection", label: "Reprojection" },
            { value: "residuals", label: "Residuals" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Button variant="primary">Run calibration</Button>
          <Button variant="secondary">Export</Button>
          <Badge tone="warning" className="ml-auto">
            3 outlier frames
          </Badge>
        </div>
      </div>
    </Panel>
  );
}

function Specimen({ family }: { family: Family }) {
  const { name, today } = FAMILIES[family];
  const headingId = `specimen-${family}`;
  return (
    <section data-type-family={family} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 id={headingId} className="text-sm font-semibold tracking-tight">
          {name}
        </h2>
        <span className="text-xs text-fg-muted">{today}</span>
      </header>

      <ReadoutStrip
        items={[
          { label: "dataset", value: "rig-2026-09" },
          { label: "frame", value: "012 / 042" },
          { value: "5472×3648" },
          { label: "zoom", value: "125 %" },
        ]}
      />

      <dl className="grid grid-cols-[4.5rem_1fr] items-baseline gap-x-3 gap-y-1.5">
        {RAMP.map(({ spec, className, sample }) => (
          <div key={spec} className="contents">
            <dt className="font-mono text-[10px] text-fg-subtle">{spec}</dt>
            <dd className={`${className} truncate`}>{sample}</dd>
          </div>
        ))}
      </dl>

      <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
        The board is detected in every frame, then the intrinsics are refined jointly with each
        frame&apos;s pose. Frames whose residuals exceed 1 px are flagged as outliers rather than
        dropped, so you can inspect them before the next run.
      </p>

      <div className="grid grid-cols-2 gap-3 rounded-panel bg-surface p-3 ring-1 ring-line">
        <p className="text-2xl tracking-tight" aria-label="Sans confusables">
          Il1| O0 rn m 5S 8B
        </p>
        <p className="font-mono text-2xl" aria-label="Mono confusables">
          Il1| O0 {"{}"} 0.184
        </p>
      </div>

      <Table columns={COLUMNS} rows={CAMERAS} rowKey={(row) => row.id} caption={`Intrinsics (${name})`} />

      <Inspector />

      <LineChart
        label={`Reprojection RMS per iteration (${name})`}
        xLabel="iteration"
        yLabel="RMS (px)"
        series={CONVERGENCE}
      />
    </section>
  );
}

const meta = {
  title: "Foundations/Type family (D1)",
  parameters: {
    docs: {
      description: {
        component: `Decision **D1** (PLAN §8), **settled 2026-09-27: IBM Plex** (ADR-0003). This page is the
comparison it was made on; L3-2 turns it into the Plex specimen.
Both columns are the same screen at the same pixel sizes, in the ramp the packages use today.
The toolbar's **Type** switch renders every other story in Inter + Geist Mono too. The measured
differences — x-height, width, tabular digits, the zero — are in \`docs/visual-language.md\` §2.`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The two candidates side by side. */
export const SideBySide: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <Specimen family="plex" />
      <Specimen family="inter" />
    </div>
  ),
  play: async ({ canvas }) => {
    const plex = canvas.getByRole("region", { name: FAMILIES.plex.name });
    const inter = canvas.getByRole("region", { name: FAMILIES.inter.name });
    await expect(getComputedStyle(plex).fontFamily).toMatch(/^"IBM Plex Sans Variable"/);
    await expect(getComputedStyle(inter).fontFamily).toMatch(/^"?InterVariable/);
    const mono = (region: HTMLElement) => getComputedStyle(region.querySelector(".font-mono") as Element).fontFamily;
    await expect(mono(plex)).toMatch(/^"IBM Plex Mono Complete"/);
    await expect(mono(inter)).toMatch(/^"Geist Mono Variable"/);
  },
};

/** The glyphs an instrument UI misreads most, large: sans, then mono, today and as shipped. */
export const Confusables: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      {VARIANTS.map(({ variant, name, note }) => (
        <section
          key={variant}
          data-type-family={variant}
          aria-label={name}
          className="grid grid-cols-[14rem_1fr] items-baseline gap-x-4 gap-y-1"
        >
          <h2 className="text-xs font-medium">{name}</h2>
          <p className="text-4xl">Il1| O0 rn m 5S 8B 0.184 a-b</p>
          <p className="text-xs text-fg-muted">{note}</p>
          <p className="font-mono text-4xl">Il1| O0 rn m 5S 8B 0.184</p>
        </section>
      ))}
    </div>
  ),
};
