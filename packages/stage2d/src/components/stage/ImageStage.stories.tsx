import type { Meta, StoryObj } from "@storybook/react-vite";
import { Hand } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { expect, fireEvent, fn, userEvent, waitFor } from "storybook/test";

import type { Point } from "../measureGeometry";
import { ImageStage, useStage, type ImageStageProps } from "./ImageStage";
import { StageButton, StageReadout, StageToolbar, StageToolbarDivider } from "./StageToolbar";
import type { Rect, StageView } from "./view";

/** The synthetic part's pixel size — larger than the frame, so fit and 100% differ. */
const IMAGE = { width: 1280, height: 1024 };

/**
 * A deterministic stand-in for a backlit inspection image: a machined plate with three bores
 * and a scratch on a dark, gridded background. Built as a string, so no network and no DOM.
 */
const INSPECTION_IMAGE = (() => {
  const grid: string[] = [];
  for (let x = 64; x < IMAGE.width; x += 64) grid.push(`M${x} 0V${IMAGE.height}`);
  for (let y = 64; y < IMAGE.height; y += 64) grid.push(`M0 ${y}H${IMAGE.width}`);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE.width}" height="${IMAGE.height}" viewBox="0 0 ${IMAGE.width} ${IMAGE.height}">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f2226"/><stop offset="1" stop-color="#3b4046"/></linearGradient>`,
    `<radialGradient id="metal" cx="0.45" cy="0.4" r="0.75"><stop offset="0" stop-color="#d6d9dd"/><stop offset="1" stop-color="#8f959c"/></radialGradient></defs>`,
    `<rect width="${IMAGE.width}" height="${IMAGE.height}" fill="url(#bg)"/>`,
    `<path d="${grid.join("")}" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"/>`,
    `<rect x="240" y="192" width="800" height="640" rx="24" fill="url(#metal)"/>`,
    `<circle cx="440" cy="400" r="90" fill="#16181b"/>`,
    `<circle cx="840" cy="400" r="90" fill="#16181b"/>`,
    `<circle cx="640" cy="660" r="60" fill="#16181b"/>`,
    `<path d="M700 250L735 268L782 302" stroke="#5b3b2e" stroke-width="3" fill="none"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
})();

/** Where the scratch is, in image pixels — what the "zoomed" stories frame. */
const DEFECT: Rect = { x: 660, y: 220, width: 160, height: 110 };

function InspectionImage() {
  return (
    <img
      src={INSPECTION_IMAGE}
      alt="Synthetic inspection image: a machined plate with three bores and a scratch"
      draggable={false}
      className="absolute inset-0 h-full w-full"
    />
  );
}

/** A layer that frames a rect once the stage has been measured — a "jump to finding". */
function FrameOnMount({ rect }: { rect: Rect }) {
  const { frame, box } = useStage();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !(box.width > 0)) return;
    done.current = true;
    frame(rect);
  }, [box.width, frame, rect]);
  return null;
}

interface HarnessOptions {
  toolbar?: boolean;
  /** `static` shows the image size; `hover` follows the pointer through `onHover`. */
  readout?: "static" | "hover";
  /** Adds a hand-tool toggle to the toolbar, driving `panTool`. */
  panToggle?: boolean;
  frameOnMount?: Rect;
}

/**
 * The stage is controlled: the story owns `view` (starting from the arg, normally `null` —
 * "open at a sensible view") and forwards every change to the `onView` spy.
 */
function StatefulStage({ options = {}, ...args }: ImageStageProps & { options?: HarnessOptions }) {
  const [view, setView] = useState<StageView | null>(args.view);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [panTool, setPanTool] = useState(args.panTool ?? false);
  const { onView, onHover } = args;

  const toolbar = options.toolbar ? (
    <StageToolbar>
      {options.panToggle && (
        <StageButton label="Pan tool" pressed={panTool} onClick={() => setPanTool((on) => !on)}>
          <Hand className="size-4" aria-hidden />
        </StageButton>
      )}
    </StageToolbar>
  ) : undefined;

  const readout = options.readout ? (
    <StageReadout cursor={options.readout === "hover" ? cursor : null} />
  ) : undefined;

  return (
    <div style={{ height: 480 }}>
      <ImageStage
        {...args}
        view={view}
        onView={(next) => {
          setView(next);
          onView(next);
        }}
        panTool={panTool}
        onHover={(point) => {
          setCursor(point);
          onHover?.(point);
        }}
        {...(toolbar ? { toolbar } : {})}
        {...(readout ? { readout } : {})}
      >
        {args.children}
        {options.frameOnMount && <FrameOnMount rect={options.frameOnMount} />}
      </ImageStage>
    </div>
  );
}

/** The readout's own text, e.g. `1280×1024 · fit` or `1280×1024 · 50%`. */
function readoutText(root: HTMLElement): string {
  const span = [...root.querySelectorAll("span")].find((s) => /·/.test(s.textContent ?? ""));
  return span?.textContent ?? "";
}

function stageTransform(root: HTMLElement): string {
  return root.querySelector<HTMLElement>("[data-stage]")?.style.transform ?? "";
}

const meta = {
  title: "stage2d/ImageStage",
  component: ImageStage,
  subcomponents: { StageToolbar, StageButton, StageReadout, StageToolbarDivider },
  parameters: {
    docs: {
      description: {
        component: `A pannable, zoomable frame that transforms **every stacked layer together** — the photograph, a
mask, a \`MeasureOverlay\`, interactive handles — so they stay registered at any zoom and window size.

The stage is laid out at the image's own pixel size and carries the whole transform; \`scale\` is CSS
pixels per image pixel (\`1\` is 100%). The \`view\` is controlled: pass \`null\` to open at a sensible
view (1:1 if the image fits, otherwise fit) and store what \`onView\` reports. Layers read the transform
through \`useStage()\`. \`StageToolbar\` (zoom out / percentage menu / zoom in / fit / 100%, plus app
groups built from \`StageButton\` and \`StageToolbarDivider\`) and \`StageReadout\` (cursor in image
pixels, and scale) float over the image, outside the transform.

**Use** it for any image result a reader inspects — anything drawn in source-image pixel coordinates.
A press pans only when no layer claims it: an interactive layer stops propagation on \`pointerdown\`
(checking \`useStage().panMode\` first, so the hand tool and a held space bar still win), and
\`onBackgroundClick\` is how it hears "deselect".

**Don't** use it for a static thumbnail with nothing to inspect (a plain \`<img>\` is enough), and don't
put layers *outside* it to make them interactive — that is exactly how layers drift off the image.
\`ZoomPanCanvas\` is its deprecated predecessor.

**Accessibility**: the viewport is \`role="application"\` with an \`aria-label\` (\`label\`, default
"Image canvas") and takes focus; with focus, \`+\` / \`-\` zoom, \`0\` fits, \`1\` is 100% and the arrows
pan (\`panKeys={false}\` frees them). Toolbar buttons are real buttons with \`aria-label\` and
\`aria-pressed\`. The image itself needs its own \`alt\`; overlays are decorative and \`aria-hidden\`,
so a result drawn only on the canvas must also be stated in text beside it.`,
      },
    },
  },
  args: {
    image: IMAGE,
    view: null,
    onView: fn(),
    onHover: fn(),
    onBackgroundClick: fn(),
    children: <InspectionImage />,
  },
  render: (args) => <StatefulStage {...args} />,
} satisfies Meta<typeof ImageStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens at fit (the image is larger than the frame) and reports the measured view. */
export const DefaultFit: Story = {
  render: (args) => <StatefulStage {...args} options={{ readout: "static" }} />,
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByRole("application", { name: "Image canvas" })).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: /Synthetic inspection image/ })).toBeInTheDocument();
    await waitFor(() => expect(args.onView).toHaveBeenCalled());
    await waitFor(() => expect(readoutText(canvasElement)).toBe("1280×1024 · fit"));
  },
};

/** A controlled view, set by the app — here, framing the scratch as a "jump to finding" would. */
export const Zoomed: Story = {
  render: (args) => (
    <StatefulStage {...args} options={{ toolbar: true, readout: "static", frameOnMount: DEFECT }} />
  ),
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(readoutText(canvasElement)).toMatch(/^1280×1024 · \d+%$/));
    const stage = canvas.getByRole("application");
    stage.focus();
    await userEvent.keyboard("0");
    await waitFor(() => expect(readoutText(canvasElement)).toBe("1280×1024 · fit"));
    await expect(canvas.getByRole("button", { name: "Fit to window" })).toHaveAttribute("aria-pressed", "true");
  },
};

/** The in-canvas controls, and a readout that follows the pointer in image pixels. */
export const WithToolbarAndReadout: Story = {
  render: (args) => <StatefulStage {...args} options={{ toolbar: true, readout: "hover" }} />,
  play: async ({ canvas, canvasElement, args }) => {
    await waitFor(() => expect(readoutText(canvasElement)).toBe("1280×1024 · fit"));

    // Toolbar zoom-in steps to the next round percentage.
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(readoutText(canvasElement)).toMatch(/· \d+%$/));
    await expect(canvas.getByRole("button", { name: "Fit to window" })).toHaveAttribute("aria-pressed", "false");

    // Keyboard shortcuts on the focused stage.
    const stage = canvas.getByRole("application");
    stage.focus();
    await userEvent.keyboard("0");
    await waitFor(() => expect(readoutText(canvasElement)).toBe("1280×1024 · fit"));
    await userEvent.keyboard("1");
    await waitFor(() => expect(readoutText(canvasElement)).toBe("1280×1024 · 100%"));
    await userEvent.keyboard("+");
    await waitFor(() => expect(readoutText(canvasElement)).toBe("1280×1024 · 150%"));
    await userEvent.keyboard("0");
    await waitFor(() => expect(readoutText(canvasElement)).toBe("1280×1024 · fit"));

    // Hover: the readout switches from the image size to the cursor, in image pixels.
    const rect = stage.getBoundingClientRect();
    fireEvent.pointerMove(stage, { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
    await waitFor(() => expect(readoutText(canvasElement)).toMatch(/^\d+\.\d, \d+\.\d px · fit$/));
    await expect(args.onHover).toHaveBeenCalled();
  },
};

/** A status line over the top-left, outside the transform. */
export const WithBanner: Story = {
  args: {
    banner: (
      <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
        Result is from the previous recipe
      </span>
    ),
  },
  render: (args) => <StatefulStage {...args} options={{ toolbar: true, readout: "static" }} />,
};

/** A draggable ROI handle living inside the transform: it claims its press, so it never pans. */
function RoiLayer({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const stage = useStage();
  const [centre, setCentre] = useState<Point>({ x: 640, y: 512 });
  const half = 100;
  const handle = stage.imageLength(16);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // The hand tool and a held space bar outrank the layer.
    if (stage.panMode || event.button !== 0) return;
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, centre, scale: stage.view.scale };
    const move = (e: PointerEvent) =>
      setCentre({
        x: start.centre.x + (e.clientX - start.x) / start.scale,
        y: start.centre.y + (e.clientY - start.y) / start.scale,
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute border-signal"
        style={{
          left: centre.x + 0.5 - half,
          top: centre.y + 0.5 - half,
          width: 2 * half,
          height: 2 * half,
          borderWidth: stage.imageLength(selected ? 2 : 1),
          borderStyle: selected ? "solid" : "dashed",
        }}
      />
      <button
        type="button"
        aria-label={`ROI centre at ${Math.round(centre.x)}, ${Math.round(centre.y)}`}
        aria-pressed={selected}
        className="absolute cursor-move rounded-full border-white bg-signal"
        style={{
          left: centre.x + 0.5 - handle / 2,
          top: centre.y + 0.5 - handle / 2,
          width: handle,
          height: handle,
          borderWidth: stage.imageLength(2),
        }}
        onPointerDown={onPointerDown}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={onSelect}
      />
    </>
  );
}

function InteractiveStage(args: ImageStageProps) {
  const [selected, setSelected] = useState(false);
  return (
    <StatefulStage
      {...args}
      options={{ toolbar: true, readout: "hover" }}
      onBackgroundClick={(event) => {
        setSelected(false);
        args.onBackgroundClick?.(event);
      }}
    >
      {args.children}
      <RoiLayer selected={selected} onSelect={() => setSelected(true)} />
    </StatefulStage>
  );
}

/** An interactive child layer: select and drag the ROI; a background click deselects it. */
export const InteractiveLayer: Story = {
  render: (args) => <InteractiveStage {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    await waitFor(() => expect(readoutText(canvasElement)).toContain("fit"));
    const handle = canvas.getByRole("button", { name: /^ROI centre at/ });
    await userEvent.click(handle);
    await expect(handle).toHaveAttribute("aria-pressed", "true");

    // Dragging the handle moves the ROI, not the image.
    const before = stageTransform(canvasElement);
    const label = handle.getAttribute("aria-label");
    const r = handle.getBoundingClientRect();
    const from = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, ...from });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: from.clientX + 60, clientY: from.clientY + 30 });
    fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: from.clientX + 60, clientY: from.clientY + 30 });
    await waitFor(() => expect(handle.getAttribute("aria-label")).not.toBe(label));
    await expect(stageTransform(canvasElement)).toBe(before);

    // A press on the background that never became a drag deselects.
    const stage = canvas.getByRole("application");
    const s = stage.getBoundingClientRect();
    const corner = { clientX: s.left + 12, clientY: s.top + 12 };
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, ...corner });
    fireEvent.pointerUp(stage, { button: 0, pointerId: 1, ...corner });
    await waitFor(() => expect(handle).toHaveAttribute("aria-pressed", "false"));
    await expect(args.onBackgroundClick).toHaveBeenCalled();
  },
};

/** The hand tool: every press pans, whatever layer it lands on. */
export const PanTool: Story = {
  render: (args) => (
    <StatefulStage
      {...args}
      options={{ toolbar: true, readout: "static", panToggle: true, frameOnMount: DEFECT }}
    />
  ),
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(readoutText(canvasElement)).toMatch(/· \d+%$/));
    const toggle = canvas.getByRole("button", { name: "Pan tool" });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    const stage = canvas.getByRole("application");
    await waitFor(() => expect(stage).toHaveClass("cursor-grab"));
    const before = stageTransform(canvasElement);
    const s = stage.getBoundingClientRect();
    const from = { clientX: s.left + s.width / 2, clientY: s.top + s.height / 2 };
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, ...from });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: from.clientX - 80, clientY: from.clientY - 40 });
    fireEvent.pointerUp(stage, { button: 0, pointerId: 1, clientX: from.clientX - 80, clientY: from.clientY - 40 });
    await waitFor(() => expect(stageTransform(canvasElement)).not.toBe(before));
  },
};
