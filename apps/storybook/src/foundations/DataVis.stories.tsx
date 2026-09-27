import type { Meta, StoryObj } from "@storybook/react-vite";
import { SERIES_COLOURS } from "@vitavision/charts";

/**
 * The data-visualisation palettes: categorical (the charts package's `--series-*`), and the
 * sequential and diverging maps the spec proposes for heatmaps, residual magnitudes and
 * signed errors. The map stops are the published matplotlib/ColorBrewer anchors.
 */

/** Ten evenly spaced anchors of each perceptually uniform map (matplotlib). */
const SEQUENTIAL: { name: string; use: string; stops: string[] }[] = [
  {
    name: "viridis",
    use: "Magnitudes on the chrome: residual size, per-cell error, confidence.",
    stops: ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"],
  },
  {
    name: "inferno",
    use: "Heatmaps over an image: low values fade to black, so the image shows through.",
    stops: ["#000004", "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60", "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"],
  },
  {
    name: "cividis",
    use: "When the reader's colour vision is unknown and the map carries the finding alone.",
    stops: ["#00224e", "#123570", "#3b496c", "#575d6d", "#707173", "#8a8779", "#a69d75", "#c4b56c", "#e4cf5b", "#fee838"],
  },
];

/** ColorBrewer PuOr, 11 classes: signed quantities around a meaningful zero. */
const DIVERGING = ["#2d004b", "#542788", "#8073ac", "#b2abd2", "#d8daeb", "#f7f7f7", "#fee0b6", "#fdb863", "#e08214", "#b35806", "#7f3b08"];

/**
 * Colour-vision-deficiency simulation (Machado, Oliveira & Fernandes 2009, severity 1.0), as
 * SVG colour matrices. `feColorMatrix` works in linear RGB by default, which is where the
 * matrices apply.
 */
const CVD: { id: string; name: string; matrix: string }[] = [
  {
    id: "protan",
    name: "Protanopia",
    matrix: "0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0",
  },
  {
    id: "deutan",
    name: "Deuteranopia",
    matrix: "0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0",
  },
  {
    id: "tritan",
    name: "Tritanopia",
    matrix: "1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.303900 0 0  0 0 0 1 0",
  },
];

function gradient(stops: string[]): string {
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** Six series as short lines, the way a legend and a chart show them. */
function SeriesSwatches({ filter }: { filter?: string }) {
  return (
    <svg viewBox="0 0 240 64" className="h-16 w-60" role="img" aria-label="The six series colours as lines">
      <g filter={filter ? `url(#${filter})` : undefined}>
        {SERIES_COLOURS.map((colour, index) => (
          <line
            key={colour}
            x1={8 + index * 38}
            x2={36 + index * 38}
            y1={40 - (index % 2) * 16}
            y2={24 + (index % 2) * 16}
            stroke={colour}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}

const meta = {
  title: "Foundations/Data-vis palette",
  parameters: {
    docs: {
      description: {
        component: `Categorical colours tell series apart; sequential maps show magnitude; a diverging
map shows a signed value around zero. **None of them is a verdict colour**, and a verdict colour is
never a series — a red line that means "series 4" teaches a reader to ignore red.
Spec: \`docs/visual-language.md\` §4.`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The six categorical slots, in order, as the theme resolves them. */
export const Categorical: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-6 gap-3">
        {SERIES_COLOURS.map((colour, index) => (
          <li key={colour} className="flex flex-col gap-1.5">
            <span aria-hidden className="h-10 rounded-control" style={{ background: colour }} />
            <code className="text-xs">--series-{index + 1}</code>
          </li>
        ))}
      </ol>
      <p className="max-w-prose text-xs text-fg-muted">
        Each slot is ≥ 3:1 against <code>surface</code> and <code>ground</code> in its theme. A seventh
        series reuses a slot and is told apart by its legend text, never by colour alone.
      </p>
    </div>
  ),
};

/** The same six series as a reader with each dichromacy sees them. */
export const ColourVisionDeficiency: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <svg aria-hidden className="absolute size-0">
        <defs>
          {CVD.map(({ id, matrix }) => (
            <filter key={id} id={`cvd-${id}`} colorInterpolationFilters="linearRGB">
              <feColorMatrix type="matrix" values={matrix} />
            </filter>
          ))}
        </defs>
      </svg>
      <div className="grid grid-cols-[8rem_1fr] items-center gap-x-4 gap-y-1">
        <span className="text-xs text-fg-muted">Typical vision</span>
        <SeriesSwatches />
        {CVD.map(({ id, name }) => (
          <div key={id} className="contents">
            <span className="text-xs text-fg-muted">{name}</span>
            <SeriesSwatches filter={`cvd-${id}`} />
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Sequential maps for magnitude, and the diverging map for signed values. */
export const Maps: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {SEQUENTIAL.map(({ name, use, stops }) => (
        <section key={name} aria-label={name} className="grid grid-cols-[6rem_1fr] items-center gap-x-4 gap-y-1">
          <code className="text-xs">{name}</code>
          <span aria-hidden className="h-6 rounded-control" style={{ background: gradient(stops) }} />
          <span />
          <span className="text-xs text-fg-muted">{use}</span>
        </section>
      ))}
      <section aria-label="PuOr" className="grid grid-cols-[6rem_1fr] items-center gap-x-4 gap-y-1">
        <code className="text-xs">PuOr</code>
        <span aria-hidden className="h-6 rounded-control" style={{ background: gradient(DIVERGING) }} />
        <span />
        <span className="flex justify-between text-xs text-fg-muted">
          <span>− (e.g. residual left of the model)</span>
          <span>0</span>
          <span>+ (right of the model)</span>
        </span>
      </section>
      <p className="max-w-prose text-xs text-fg-muted">
        Not used: <code>jet</code>, <code>hot</code>, <code>turbo</code> and red→green ramps. They are
        not perceptually uniform (a band reads as an edge in the data) and red/green carries a
        verdict.
      </p>
    </div>
  ),
};
