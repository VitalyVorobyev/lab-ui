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
 * IBM Plex Sans + IBM Plex Mono on an instrument screen: the ramp the packages
 * use, a help paragraph, the confusable glyphs, a numeric table, an inspector and a chart.
 * The fonts come from `@vitavision/ui/fonts.css`, as every app loads them.
 */

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

function SpecimenScreen() {
  return (
    <section aria-labelledby="type-specimen" className="flex max-w-2xl min-w-0 flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 id="type-specimen" className="text-sm font-semibold tracking-tight">
          IBM Plex Sans + IBM Plex Mono
        </h2>
        <span className="text-xs text-fg-muted">type family</span>
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

      <Table columns={COLUMNS} rows={CAMERAS} rowKey={(row) => row.id} caption="Intrinsics" />

      <Inspector />

      <LineChart
        label="Reprojection RMS per iteration"
        xLabel="iteration"
        yLabel="RMS (px)"
        series={CONVERGENCE}
      />
    </section>
  );
}

const meta = {
  title: "Foundations/Type",
  parameters: {
    docs: {
      description: {
        component: `**IBM Plex Sans** for text, **IBM Plex Mono** for values.
Load them once with \`@import "@vitavision/ui/fonts.css";\` — IBM's Plex Mono files, which keep the
\`zero\` feature, so mono values get a slashed zero. Sans digits are tabular by default; the ramp is
the type roles on the Scales page.`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The type pair on an instrument screen, at the sizes the packages use. */
export const Specimen: Story = {
  render: () => <SpecimenScreen />,
  play: async ({ canvas }) => {
    const region = canvas.getByRole("region", { name: "IBM Plex Sans + IBM Plex Mono" });
    await expect(getComputedStyle(region).fontFamily).toMatch(/^"IBM Plex Sans Variable"/);
    const mono = region.querySelector(".font-mono") as Element;
    await expect(getComputedStyle(mono).fontFamily).toMatch(/^"IBM Plex Mono"/);
    await expect(getComputedStyle(mono).fontVariantNumeric).toContain("slashed-zero");
  },
};

/** The glyphs an instrument UI misreads most, large: sans, then mono. */
export const Glyphs: Story = {
  render: () => (
    <section aria-label="Confusable glyphs" className="flex flex-col gap-2">
      <p className="text-4xl">Il1| O0 rn m 5S 8B 0.184 a-b</p>
      <p className="font-mono text-4xl">Il1| O0 rn m 5S 8B 0.184</p>
    </section>
  ),
};
