import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Button,
  type Column,
  DensityProvider,
  Field,
  Input,
  Panel,
  Table,
  type Density,
} from "@vitavision/ui";

/**
 * The type scale, the spacing steps, density, and radii — as the packages use them today
 * named so a new component picks from the list instead of inventing.
 */

/** Each role once: its classes, its size and weight, and where it is used. */
const TYPE_ROLES: { role: string; className: string; spec: string; use: string }[] = [
  { role: "title", className: "text-xl font-semibold tracking-tight", spec: "20 / 600", use: "PageHeader h1 — one per screen" },
  { role: "heading", className: "text-sm font-semibold tracking-tight", spec: "14 / 600", use: "Panel, Section and Dialog titles" },
  { role: "body", className: "text-sm", spec: "14 / 400", use: "Values, table cells, prose" },
  { role: "label", className: "text-xs font-medium", spec: "12 / 500", use: "Field labels, buttons (sm), segments" },
  { role: "meta", className: "text-xs text-fg-muted", spec: "12 / 400", use: "Hints, descriptions, captions, legends" },
  { role: "eyebrow", className: "text-[11px] font-semibold uppercase tracking-wider text-fg-muted", spec: "11 / 600 caps", use: "Compact panel titles only" },
  { role: "micro", className: "text-[10px] text-fg-muted", spec: "10 / 400", use: "Chart ticks, compact table headers" },
];

/** The spacing steps in use (Tailwind units, 1 = 4 px). Anything else is a smell. */
const SPACING = [0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8];

const SPACING_WIDTH: Record<number, string> = {
  0.5: "w-0.5",
  1: "w-1",
  1.5: "w-1.5",
  2: "w-2",
  2.5: "w-2.5",
  3: "w-3",
  4: "w-4",
  6: "w-6",
  8: "w-8",
};

interface Row {
  frame: string;
  corners: number;
  rms: number;
}

const ROWS: Row[] = [
  { frame: "012", corners: 88, rms: 0.184 },
  { frame: "013", corners: 88, rms: 0.176 },
  { frame: "014", corners: 61, rms: 1.087 },
];

const COLUMNS: Column<Row>[] = [
  { key: "frame", header: "Frame", cell: (row) => row.frame },
  { key: "corners", header: "Corners", numeric: true, cell: (row) => row.corners },
  { key: "rms", header: "RMS (px)", numeric: true, cell: (row) => row.rms.toFixed(3) },
];

function DensitySample({ density }: { density: Density }) {
  return (
    <DensityProvider value={density}>
      <Panel title={density === "compact" ? "Inspector (compact)" : "Settings (comfortable)"}>
        <div className="flex flex-col gap-3">
          <Field label="Threshold" description="Scores above this are defects.">
            <Input defaultValue="0.72" />
          </Field>
          <Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.frame} caption={`Frames, ${density}`} />
          <div className="flex gap-2">
            <Button variant="primary">Apply</Button>
            <Button variant="secondary">Reset</Button>
          </div>
        </div>
      </Panel>
    </DensityProvider>
  );
}

const meta = {
  title: "Foundations/Scales",
  parameters: {
    docs: {
      description: {
        component: `Type roles, spacing steps, density and radii. The sizes are the ones the
packages already use, named so new code picks a role rather than a size.`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seven roles, five sizes: 10, 11, 12, 14 and 20 px. */
export const TypeRoles: Story = {
  render: () => (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Type roles</caption>
      <thead>
        <tr className="text-xs text-fg-muted">
          <th scope="col" className="pb-2 pr-4 font-medium">Role</th>
          <th scope="col" className="pb-2 pr-4 font-medium">Specimen</th>
          <th scope="col" className="pb-2 pr-4 font-medium">px / weight</th>
          <th scope="col" className="pb-2 font-medium">Used for</th>
        </tr>
      </thead>
      <tbody>
        {TYPE_ROLES.map(({ role, className, spec, use }) => (
          <tr key={role} className="border-t border-line">
            <th scope="row" className="py-2 pr-4 font-mono text-xs font-normal text-fg-muted">{role}</th>
            <td className={`py-2 pr-4 ${className}`}>Reprojection error</td>
            <td className="py-2 pr-4 font-mono text-xs">{spec}</td>
            <td className="py-2 text-xs text-fg-muted">{use}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** The spacing steps, to scale. */
export const Spacing: Story = {
  render: () => (
    <ul className="flex flex-col gap-1.5">
      {SPACING.map((step) => (
        <li key={step} className="grid grid-cols-[3rem_4rem_1fr] items-center gap-3 font-mono text-xs">
          <span>{step}</span>
          <span className="text-fg-muted">{step * 4} px</span>
          <span aria-hidden className={`h-3 rounded-sm bg-signal ${SPACING_WIDTH[step] ?? ""}`} />
        </li>
      ))}
    </ul>
  ),
};

/** The same panel in both densities: compact drops padding and leading, not hit targets. */
export const Densities: Story = {
  render: () => (
    <div className="grid grid-cols-2 items-start gap-6">
      <DensitySample density="comfortable" />
      <DensitySample density="compact" />
    </div>
  ),
};

/** Two radii and one elevation rule: shadows only on layers that float. */
export const RadiiAndElevation: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6 text-xs">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-8 w-28 items-center justify-center rounded-control bg-raised ring-1 ring-line-strong">control</div>
        <code className="text-fg-muted">rounded-control · 6 px</code>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-20 w-40 items-center justify-center rounded-panel bg-surface ring-1 ring-line">panel</div>
        <code className="text-fg-muted">rounded-panel · 10 px</code>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-7 items-center rounded-full bg-raised px-3 ring-1 ring-line">pill · chip · dot</div>
        <code className="text-fg-muted">rounded-full</code>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-20 w-40 items-center justify-center rounded-panel bg-overlay shadow-lg shadow-black/25 ring-1 ring-line">
          popover
        </div>
        <code className="text-fg-muted">overlay + shadow-lg</code>
      </div>
    </div>
  ),
};
