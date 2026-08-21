/**
 * A pannable, zoomable frame that transforms **everything stacked inside it together**.
 *
 * A result viewer over a stack — a photograph, an anomaly map, a model's segmentation, a
 * measurement overlay drawn in source-image pixel coordinates — and the layers only stay
 * registered with each other if one transform moves all of them.
 *
 * The stage element is laid out at **exactly the image's pixel size** and carries the whole
 * transform (see `view.ts`). Two things follow, and both are the point:
 *
 *   - a child `<svg viewBox="0 0 W H">` at `inset-0` is registered with the photograph at
 *     every viewport size, with no letterbox correction to get wrong. Its predecessor
 *     scaled layers by the *frame's* size, so an aspect mismatch between frame and image
 *     drew the overlay stretched against a letterboxed picture — layers drifting apart on
 *     window resize;
 *   - `scale` means CSS pixels per image pixel, so "100%" is a value rather than a
 *     coincidence, and zooming *out* past fit is expressible.
 *
 * Interactive children are supported, which is the other half of the rewrite. This stage
 * starts a pan only when the gesture is unclaimed — the press landed on the background, or
 * used the middle button, or held space, or the caller says the pan tool is active. A layer
 * that wants a press simply handles it. The predecessor called `setPointerCapture` on every
 * `pointerdown`, so an ROI handle or a clickable contour could not exist inside it at all,
 * and its consumers put those layers *outside* the transform — where they no longer moved
 * with the image.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import { cn } from "../ui";
import type { Point } from "../measureGeometry";
import {
  clampView,
  fitView,
  frameRect,
  imageLengthFor,
  initialView,
  isFit,
  preserveCenter,
  scaleRange,
  toImage,
  toScreen,
  zoomAbout,
  type Box,
  type ClampOptions,
  type Rect,
  type StageView,
} from "./view";

const WHEEL_SENSITIVITY = 0.0015;
/** How far a press may travel and still count as a click rather than a pan. */
const CLICK_SLOP = 3;

export interface StageContext {
  view: StageView;
  setView: (view: StageView) => void;
  /** The source image's pixel dimensions. */
  image: Box;
  /** The viewport's CSS size — `{0, 0}` until first measured. */
  box: Box;
  /** Client coordinates → image pixels. */
  toImage: (client: Point) => Point;
  /** Image pixels → client coordinates. */
  toClient: (image: Point) => Point;
  /** Image pixels → viewport-local CSS pixels. */
  toViewport: (image: Point) => Point;
  /** The image-pixel length that covers `css` screen pixels — for screen-constant geometry. */
  imageLength: (css: number) => number;
  /** Put a rect (image coordinates) on screen with a margin. */
  frame: (rect: Rect, pad?: number) => void;
  /** Fit the whole image. */
  fit: () => void;
  /** Set a scale about the viewport centre, or about `anchor` in client coordinates. */
  zoomTo: (scale: number, anchor?: Point) => void;
  isFit: boolean;
  /** True while a pan is in progress, so layers can suppress hover work. */
  panning: boolean;
  /**
   * True when panning must win over anything a layer would otherwise do with a press —
   * the hand tool, or space held. Layers check this before claiming a `pointerdown`; it is
   * the only way a modifier can outrank a child, since a child that stops propagation is
   * heard before this component is.
   */
  panMode: boolean;
}

const Ctx = createContext<StageContext | null>(null);

/** The stage a layer is drawn into. Throws outside one, which is always a wiring bug. */
export function useStage(): StageContext {
  const ctx = useContext(Ctx);
  if (ctx === null) throw new Error("useStage must be used inside <ImageStage>.");
  return ctx;
}

export interface ImageStageProps {
  /** The source image's pixel dimensions — the stage's own layout size. */
  image: Box;
  view: StageView | null;
  onView: (view: StageView) => void;
  /** Layers, each `absolute inset-0` and sized by the stage. */
  children: ReactNode;
  /** Rendered floating over the bottom-left, outside the transform. */
  toolbar?: ReactNode;
  /** Rendered floating over the bottom-right, outside the transform. */
  readout?: ReactNode;
  /** Rendered over the top-left — a mode banner, a staleness warning. */
  banner?: ReactNode;
  /** Force panning regardless of where the press lands (a "hand tool"). */
  panTool?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Where the pointer is over the image, in image pixels, or `null` when it is outside. */
  onHover?: (point: Point | null) => void;
  /** A press on the background that was not a pan — how a layer hears "deselect". */
  onBackgroundClick?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  clamp?: ClampOptions;
  /** Keyboard zoom/pan shortcuts. On by default; the stage takes focus to receive them. */
  shortcuts?: boolean;
  label?: string;
}

export function ImageStage({
  image,
  view,
  onView,
  children,
  toolbar,
  readout,
  banner,
  panTool = false,
  className,
  style,
  onHover,
  onBackgroundClick,
  clamp,
  shortcuts = true,
  label = "Image canvas",
}: ImageStageProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panMode = panTool || spaceHeld;

  // Refs for the handlers, which are attached once and must not close over stale values.
  const latest = useRef({ view, box, image, clamp });
  latest.current = { view, box, image, clamp };
  /** The view to come back to when a double-click leaves fit. */
  const previous = useRef<StageView | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const effective = view ?? (box.width > 0 ? initialView(box, image) : { scale: 1, tx: 0, ty: 0 });

  const commit = useCallback(
    (next: StageView) => {
      const { box: b, image: i, clamp: c } = latest.current;
      onView(b.width > 0 ? clampView(next, b, i, c) : next);
    },
    [onView],
  );

  /* The viewport's size is a *dependency* of the view, not just of the layout: fit is a
   * relationship to it, and a pan offset that was legal in a wide window is off-screen in a
   * narrow one. Without this the picture appeared to slide out from under its own overlay
   * whenever the window changed shape. */
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;

    const measure = (width: number, height: number) => {
      if (!(width > 0) || !(height > 0)) return;
      setBox((current) => {
        if (current.width === width && current.height === height) return current;
        const { view: v, image: i, clamp: c } = latest.current;
        const next = { width, height };
        onView(v === null ? initialView(next, i) : preserveCenter(v, current, next, i, c));
        return next;
      });
    };

    const rect = element.getBoundingClientRect();
    measure(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      measure(width, height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onView]);

  /* Attached by hand because React registers `wheel` at the root as **passive**, which makes
   * `preventDefault` in a synthetic handler a no-op — the page would scroll behind the
   * canvas while you zoom, which reads as the zoom being broken. */
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { view: v, box: b, image: i, clamp: c } = latest.current;
      if (v === null || !(b.width > 0)) return;
      const rect = element.getBoundingClientRect();
      const [min, max] = scaleRange(b, i, c);
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);
      const scale = Math.min(max, Math.max(min, v.scale * factor));
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      onView(clampView(zoomAbout(v, scale, anchor), b, i, c));
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [onView]);

  /* Space is a *modifier*, not a command: held, it turns any press into a pan, which is the
   * one gesture that has to work no matter which layer is under the cursor. */
  useEffect(() => {
    if (!shortcuts) return;
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target)) setSpaceHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    const blur = () => setSpaceHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [shortcuts]);

  const clientToImage = useCallback(
    (p: Point): Point => {
      const rect = viewport.current?.getBoundingClientRect();
      const { view: v } = latest.current;
      if (!rect || v === null) return { x: 0, y: 0 };
      return toImage(v, { x: p.x - rect.left, y: p.y - rect.top });
    },
    [],
  );

  const imageToClient = useCallback((p: Point): Point => {
    const rect = viewport.current?.getBoundingClientRect();
    const { view: v } = latest.current;
    if (!rect || v === null) return { x: 0, y: 0 };
    const local = toScreen(v, p);
    return { x: local.x + rect.left, y: local.y + rect.top };
  }, []);

  const fit = useCallback(() => {
    const { box: b, image: i, view: v } = latest.current;
    if (!(b.width > 0)) return;
    if (v !== null && !isFit(v, b, i)) previous.current = v;
    onView(fitView(b, i));
  }, [onView]);

  const zoomTo = useCallback(
    (scale: number, anchor?: Point) => {
      const { view: v, box: b, image: i, clamp: c } = latest.current;
      if (v === null || !(b.width > 0)) return;
      const rect = viewport.current?.getBoundingClientRect();
      const local =
        anchor && rect
          ? { x: anchor.x - rect.left, y: anchor.y - rect.top }
          : { x: b.width / 2, y: b.height / 2 };
      const [min, max] = scaleRange(b, i, c);
      onView(clampView(zoomAbout(v, Math.min(max, Math.max(min, scale)), local), b, i, c));
    },
    [onView],
  );

  const frame = useCallback(
    (rect: Rect, pad?: number) => {
      const { box: b, image: i } = latest.current;
      if (!(b.width > 0)) return;
      onView(frameRect(b, i, rect, pad));
    },
    [onView],
  );

  const atFit = box.width > 0 && isFit(effective, box, image);

  const context = useMemo<StageContext>(
    () => ({
      view: effective,
      setView: commit,
      image,
      box,
      toImage: clientToImage,
      toClient: imageToClient,
      toViewport: (p: Point) => toScreen(effective, p),
      imageLength: (css: number) => imageLengthFor(effective, css),
      frame,
      fit,
      zoomTo,
      isFit: atFit,
      panning,
      panMode,
    }),
    [
      effective,
      commit,
      image,
      box,
      clientToImage,
      imageToClient,
      frame,
      fit,
      zoomTo,
      atFit,
      panning,
      panMode,
    ],
  );

  /*
   * Panning is the *default* reading of a press, and a layer opts out of it by handling the
   * event and stopping propagation — so the stage needs to know nothing about ROI handles or
   * clickable contours, and a layer needs no permission to exist. The predecessor inverted
   * this: it captured every `pointerdown` unconditionally, which is why its consumers had to
   * mount interactive layers outside the transform, where they stopped moving with the image.
   */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      tx: effective.tx,
      ty: effective.ty,
      moved: false,
    };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = drag.current;
    if (!origin) {
      onHover?.(hoverPoint(event, viewport.current, effective, image));
      return;
    }
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!origin.moved && Math.hypot(dx, dy) <= CLICK_SLOP) return;
    origin.moved = true;
    // During a pan the pointer is holding the image, not pointing at a pixel.
    onHover?.(null);
    commit({ scale: effective.scale, tx: origin.tx + dx, ty: origin.ty + dy });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = drag.current;
    drag.current = null;
    setPanning(false);
    if (origin && !origin.moved && event.button === 0) onBackgroundClick?.(event);
  };

  /*
   * Fit ↔ **the view you were just at**, which is the gesture a reader actually wants: a
   * double-click to see the whole part, another to go back to the corner they were working
   * in. Toggling against 1:1 instead (the predecessor's behaviour) throws that place away.
   */
  const onDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(box.width > 0)) return;
    if (atFit) {
      const restore = previous.current;
      if (restore) {
        onView(clampView(restore, box, image, clamp));
      } else {
        zoomTo(1, { x: event.clientX, y: event.clientY });
      }
      return;
    }
    previous.current = effective;
    onView(fitView(box, image));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!shortcuts || isTypingTarget(event.target)) return;
    const [min, max] = scaleRange(box, image, clamp);
    const nudge = 60;
    switch (event.key) {
      case "+":
      case "=":
        zoomTo(Math.min(max, effective.scale * 1.5));
        break;
      case "-":
      case "_":
        zoomTo(Math.max(min, effective.scale / 1.5));
        break;
      case "0":
        fit();
        break;
      case "1":
        zoomTo(1);
        break;
      case "ArrowLeft":
        commit({ ...effective, tx: effective.tx + nudge });
        break;
      case "ArrowRight":
        commit({ ...effective, tx: effective.tx - nudge });
        break;
      case "ArrowUp":
        commit({ ...effective, ty: effective.ty + nudge });
        break;
      case "ArrowDown":
        commit({ ...effective, ty: effective.ty - nudge });
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <Ctx.Provider value={context}>
      <div
        ref={viewport}
        role="application"
        aria-label={label}
        tabIndex={0}
        style={style}
        className={cn(
          "relative h-full w-full overflow-hidden rounded border border-line bg-canvas select-none",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal",
          panning ? "cursor-grabbing" : panMode ? "cursor-grab" : "cursor-default",
          className,
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        // A drag interrupted by a lost capture — a context menu, a browser gesture, the
        // pointer leaving the window — used to leave the drag set, so the next hover panned
        // the image with no button held down.
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerLeave={() => onHover?.(null)}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        {/* One transformed box holding every layer, laid out at the image's own pixel size. */}
        <div
          data-stage
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: image.width,
            height: image.height,
            transform: `translate(${effective.tx}px, ${effective.ty}px) scale(${effective.scale})`,
          }}
        >
          {children}
        </div>

        {banner && <div className="pointer-events-none absolute top-2 left-2 z-10">{banner}</div>}
        {toolbar && <div className="absolute bottom-2 left-2 z-10">{toolbar}</div>}
        {readout && <div className="pointer-events-none absolute right-2 bottom-2 z-10">{readout}</div>}
      </div>
    </Ctx.Provider>
  );
}

function hoverPoint(
  event: { clientX: number; clientY: number },
  element: HTMLDivElement | null,
  view: StageView,
  image: Box,
): Point | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const p = toImage(view, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  if (p.x < 0 || p.y < 0 || p.x >= image.width || p.y >= image.height) return null;
  return p;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
