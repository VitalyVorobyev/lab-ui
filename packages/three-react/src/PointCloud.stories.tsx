import { useThree } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PointCloud as PointCloudObject } from "@vitavision/three";
import { useEffect } from "react";
import { expect, waitFor, within } from "storybook/test";

import { FrameAxes } from "./gizmos";
import { PointCloud, type PointCloudProps } from "./PointCloud";
import { SceneCanvas } from "./SceneCanvas";

/** The cloud each rendered story drew, by label: how `play` reads what reached the scene. */
const CLOUDS = new Map<string, PointCloudObject>();

function CloudProbe({ label }: { label: string }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    let found: PointCloudObject | undefined;
    scene.traverse((o) => {
      if (o instanceof PointCloudObject) found = o;
    });
    if (found) CLOUDS.set(label, found);
  });
  return null;
}

/** A 120 × 120 saddle surface, `z = (x² − y²) / 2`, over `[-0.5, 0.5]²` metres: 14,400 points, deterministic. */
function saddle(n = 120): { positions: Float32Array; colors: Float32Array } {
  const positions = new Float32Array(3 * n * n);
  const colors = new Float32Array(3 * n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = 3 * (j * n + i);
      const x = i / (n - 1) - 0.5;
      const y = j / (n - 1) - 0.5;
      const z = 0.5 * (x * x - y * y);
      positions.set([x, y, z], k);
      // Height as a dark-blue to yellow ramp: stand-in for a colour map.
      const t = (z + 0.125) / 0.25;
      colors.set([0.1 + 0.9 * t, 0.15 + 0.75 * t, 0.55 - 0.35 * t], k);
    }
  }
  return { positions, colors };
}

const SADDLE = saddle();

function Scene({ label, ...props }: Partial<PointCloudProps> & { label: string }) {
  return (
    <SceneCanvas className="h-80 w-full" eye={[1, -1.1, 0.8]} target={[0, 0, 0]} grid={1} label={label}>
      <PointCloud positions={SADDLE.positions} {...props} />
      <FrameAxes size={0.15} />
      <CloudProbe label={label} />
    </SceneCanvas>
  );
}

const meta = {
  title: "three-react/Point cloud",
  component: Scene,
  args: { label: "Surface points" },
  parameters: {
    docs: {
      description: {
        component: `A point cloud in the enclosing frame (metres): one draw call, whatever the number of points.

- **Points:** \`positions\` is flat \`[x, y, z, …]\`. A new array replaces the points in place, without rebuilding the object; a
  \`Float32Array\` of finite points is used without a copy. A point with a non-finite coordinate is dropped, with its colour,
  so one \`NaN\` cannot hide the cloud.
- **Colour:** by default every point is the \`fg\` token, which reads in both themes. \`color\` sets one colour; \`colors\` gives one
  \`[r, g, b]\` (each 0 to 1) per point, from a colour map of your choice.
- **Size:** \`size\` is screen pixels (2 by default), or metres with \`sizeAttenuation\`, so near points are bigger.
- **Bounds:** computed from the finite points when they are set, so the camera culls the cloud exactly: it is not drawn off
  screen, and never lost to a bad coordinate.
- **Layer:** viewer-only by default; \`physical\` makes it part of the scene a \`SensorImage\` sees.

**Use** it for reconstructed, scanned or sampled geometry. **Don't** use it where points must be picked: it is not pickable
(a ray test over every point would cost more than a viewport can spare), so offer the choices in a list beside the view.

**Accessibility**: the view is a labelled group (see the scene canvas); the cloud itself is decorative, so the figures it shows
belong in text beside it.`,
      },
    },
  },
} satisfies Meta<typeof Scene>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByRole("group", { name: args.label })).toBeVisible();
    await waitFor(() => expect(CLOUDS.get(args.label)).toBeDefined());
    const cloud = CLOUDS.get(args.label)!;
    await waitFor(() => expect(cloud.count).toBe(14400));
    await expect(cloud.material.vertexColors).toBe(false);
    await expect(cloud.bounds.max.z).toBeCloseTo(0.125, 3);
  },
};

export const ColouredPerPoint: Story = {
  args: { label: "Surface by height", colors: SADDLE.colors, size: 3 },
  play: async ({ args }) => {
    await waitFor(() => expect(CLOUDS.get(args.label)).toBeDefined());
    await waitFor(() => expect(CLOUDS.get(args.label)!.material.vertexColors).toBe(true));
  },
};

/** In metres: near points are bigger than far ones. */
export const SizeInMetres: Story = {
  args: { label: "Surface, attenuated", sizeAttenuation: true, size: 0.012, opacity: 0.9 },
  play: async ({ args }) => {
    await waitFor(() => expect(CLOUDS.get(args.label)).toBeDefined());
    await waitFor(() => expect(CLOUDS.get(args.label)!.material.sizeAttenuation).toBe(true));
    await expect(CLOUDS.get(args.label)!.material.transparent).toBe(true);
  },
};

/** One bad coordinate drops that point only. */
export const WithAMissingPoint: Story = {
  args: {
    label: "Surface with a gap",
    positions: SADDLE.positions.map((v, i) => (i === 30 ? Number.NaN : v)),
    colors: SADDLE.colors,
  },
  play: async ({ args }) => {
    await waitFor(() => expect(CLOUDS.get(args.label)).toBeDefined());
    await waitFor(() => expect(CLOUDS.get(args.label)!.count).toBe(14399));
  },
};
