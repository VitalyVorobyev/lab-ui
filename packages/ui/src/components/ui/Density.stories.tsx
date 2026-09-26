import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Button } from "./Button";
import { DensityProvider } from "./Density";
import { Panel, Section } from "./Panel";
import { type Column, Table } from "./Table";

type Row = { frame: number; score: number };

const ROWS: Row[] = [
  { frame: 1, score: 0.912 },
  { frame: 2, score: 0.874 },
];

const COLUMNS: Column<Row>[] = [
  { key: "frame", header: "Frame", numeric: true, cell: (row) => row.frame },
  { key: "score", header: "Score", numeric: true, cell: (row) => row.score.toFixed(3) },
];

/** A few density-aware primitives, as an inspector column would stack them. */
function Sample() {
  return (
    <Panel title="Inspector" actions={<Button variant="ghost">Reset</Button>}>
      <Section step={1} title="Frames">
        <Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.frame} caption="Frames" />
      </Section>
    </Panel>
  );
}

const meta = {
  title: "ui/Density",
  component: DensityProvider,
  parameters: {
    docs: {
      description: {
        component: `How much room the chrome takes, decided once per region rather than per component.

**Use** \`<DensityProvider value="compact">\` around a permanent tool surface — an inspector column
beside a canvas — where padding is less of the instrument on screen. \`Panel\`, \`Section\`, \`Table\`,
\`Button\` and the other two-spacing primitives read it via \`useDensity\`. The default is
\`comfortable\`, so a tree that never mentions density is unchanged.

**Don't** use \`compact\` for a reading surface such as a form you go through once, and don't treat
it as "the same design, smaller": it drops padding and leading but keeps type sizes and hit targets.

**Accessibility**: no output of its own. Compact keeps control hit targets, so it does not trade
away operability.`,
      },
    },
  },
  args: { value: "comfortable", children: <Sample /> },
} satisfies Meta<typeof DensityProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Comfortable: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Reset" }).className).toContain("h-8");
  },
};

export const Compact: Story = {
  args: { value: "compact" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Reset" }).className).toContain("h-7");
  },
};

export const SideBySide: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <DensityProvider value="comfortable">
        <Sample />
      </DensityProvider>
      <DensityProvider value="compact">
        <Sample />
      </DensityProvider>
    </div>
  ),
};
