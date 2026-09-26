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
  use,
  useCallback,
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

import { cn } from "@vitavision/ui";
import type { Point } from "../measureGeometry";
import {
  clampView,
  fitView,
  frameRect,
  imageLengthFor,
  initialView,
  insideImage,
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
/** The view before the viewport has been measured — nothing is on screen yet. */
const UNMEASURED_VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** What `useStage` returns: the transform of the enclosing `ImageStage`, and its controls. */
export interface StageContext {
  /** The view in effect — the controlled `view`, or the opening view while that is `null`. */
  view: StageView;
  /** Set a view, clamped to the legal range for the current viewport. */
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
  /** Whether the view is (indistinguishably) fit. */
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

const ImageStageContext = createContext<StageContext | null>(null);

/**
 * The stage a layer is drawn into: its view, the coordinate conversions, and the zoom
 * controls.
 *
 * @throws `Error` outside an `ImageStage`, which is always a wiring bug.
 */
export function useStage(): StageContext {
  const ctx = use(ImageStageContext);
  if (ctx === null) throw new Error("useStage must be used inside <ImageStage>.");
  return ctx;
}

/** Props of `ImageStage`. */
export interface ImageStageProps {
  /** The source image's pixel dimensions — the stage's own layout size. */
  image: Box;
  /**
   * The view (controlled). `null` opens at a sensible view — 1:1 if the image fits,
   * otherwise fit — reported through `onView` once the viewport is measured. A non-null
   * view is kept on first measure, only clamped to the legal range.
   */
  view: StageView | null;
  /** Called with every view change: gestures, keys, toolbar, and viewport resizes. */
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
  /** Merged onto the viewport with `cn`. */
  className?: string;
  /** Inline style for the viewport. */
  style?: CSSProperties;
  /** Where the pointer is over the image, in image pixels, or `null` when it is outside. */
  onHover?: (point: Point | null) => void;
  /** A press on the background that was not a pan — how a layer hears "deselect". */
  onBackgroundClick?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** The legal scale range; see `clampView`. */
  clamp?: ClampOptions;
  /** Keyboard zoom/pan shortcuts. On by default; the stage takes focus to receive them. */
  shortcuts?: boolean;
  /**
   * Whether the arrow keys pan. On by default, and worth turning off in an app where the
   * arrows have a better job — stepping through a list of findings, say. The zoom keys
   * (`+`, `-`, `0`, `1`) are unaffected, and dragging still pans either way.
   */
  panKeys?: boolean;
  /** The viewport's accessible name. Defaults to "Image canvas". */
  label?: string;
}

/**
 * A pannable, zoomable viewport over a stack of layers laid out at the image's own pixel
 * size, so an overlay drawn in image coordinates stays registered with the photograph at
 * any zoom and window size. Layers read the transform through `useStage`.
 *
 * State is exposed on the viewport as `data-fit` (the view is fit), `data-panning` (a drag
 * is in progress) and `data-pan-mode` (the hand tool is on or space is held), each present
 * or absent.
 */
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
  panKeys = true,
  label = "Image canvas",
}: ImageStageProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });
  // The measured size, readable synchronously — `setBox`'s updater must stay pure, and the
  // resize handler needs the *previous* box to re-anchor the view against.
  const measuredRef = useRef<Box>({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panMode = panTool || spaceHeld;

  // What the handlers attached once (and the stable callbacks below) read: the props and
  // box of the last commit, so none of them closes over stale values.
  const latestRef = useRef({ view, box, image, clamp, onView });
  useLayoutEffect(() => {
    latestRef.current = { view, box, image, clamp, onView };
  });
  /** The view to come back to when a double-click leaves fit. */
  const previousRef = useRef<StageView | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const effective = useMemo(
    () => view ?? (box.width > 0 ? initialView(box, image) : UNMEASURED_VIEW),
    [view, box, image],
  );

  const commit = useCallback((next: StageView) => {
    const { box: b, image: i, clamp: c, onView: report } = latestRef.current;
    report(b.width > 0 ? clampView(next, b, i, c) : next);
  }, []);

  /*
   * The viewport, measured and observed from the moment it mounts (a callback ref with a
   * cleanup, so the subscription lives exactly as long as the element).
   *
   * Its size is a *dependency* of the view, not just of the layout: fit is a relationship to
   * it, and a pan offset that was legal in a wide window is off-screen in a narrow one.
   * Without this the picture appeared to slide out from under its own overlay whenever the
   * window changed shape.
   *
   * The wheel listener is attached here by hand because React registers `wheel` at the root
   * as **passive**, which makes `preventDefault` in a synthetic handler a no-op — the page
   * would scroll behind the canvas while you zoom, which reads as the zoom being broken.
   */
  const attachViewport = useCallback((element: HTMLDivElement | null) => {
    viewportRef.current = element;
    if (!element) return;

    const measure = ({ width, height }: Box) => {
      if (!(width > 0) || !(height > 0)) return;
      const current = measuredRef.current;
      if (current.width === width && current.height === height) return;
      const next = { width, height };
      measuredRef.current = next;
      setBox(next);
      const { view: v, image: i, clamp: c, onView: report } = latestRef.current;
      if (v === null) report(initialView(next, i));
      // The first measurement: there is no previous viewport to re-anchor against, so the
      // caller's view is kept — only made legal for this one.
      else if (!(current.width > 0)) report(clampView(v, next, i, c));
      else report(preserveCenter(v, current, next, i, c));
    };

    // Synchronously, so the first paint already has the right view — and as the *content*
    // box, which is what the observer reports; measuring the border box here re-anchored
    // the view by the border's width as soon as the observer's first report arrived.
    measure(contentSize(element));
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect);
    });
    observer.observe(element);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { view: v, box: b, image: i, clamp: c, onView: report } = latestRef.current;
      if (v === null || !(b.width > 0)) return;
      const origin = viewportOrigin(element);
      const [min, max] = scaleRange(b, i, c);
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);
      const scale = Math.min(max, Math.max(min, v.scale * factor));
      const anchor = { x: event.clientX - origin.x, y: event.clientY - origin.y };
      report(clampView(zoomAbout(v, scale, anchor), b, i, c));
    };
    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", onWheel);
      viewportRef.current = null;
    };
  }, []);

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

  const clientToImage = useCallback((p: Point): Point => {
    const element = viewportRef.current;
    const { view: v } = latestRef.current;
    if (!element || v === null) return { x: 0, y: 0 };
    const origin = viewportOrigin(element);
    return toImage(v, { x: p.x - origin.x, y: p.y - origin.y });
  }, []);

  const imageToClient = useCallback((p: Point): Point => {
    const element = viewportRef.current;
    const { view: v } = latestRef.current;
    if (!element || v === null) return { x: 0, y: 0 };
    const origin = viewportOrigin(element);
    const local = toScreen(v, p);
    return { x: local.x + origin.x, y: local.y + origin.y };
  }, []);

  const fit = useCallback(() => {
    const { box: b, image: i, view: v, onView: report } = latestRef.current;
    if (!(b.width > 0)) return;
    if (v !== null && !isFit(v, b, i)) previousRef.current = v;
    report(fitView(b, i));
  }, []);

  const zoomTo = useCallback((scale: number, anchor?: Point) => {
    const { view: v, box: b, image: i, clamp: c, onView: report } = latestRef.current;
    const element = viewportRef.current;
    if (v === null || !(b.width > 0) || !element) return;
    const origin = viewportOrigin(element);
    const local = anchor
      ? { x: anchor.x - origin.x, y: anchor.y - origin.y }
      : { x: b.width / 2, y: b.height / 2 };
    const [min, max] = scaleRange(b, i, c);
    report(clampView(zoomAbout(v, Math.min(max, Math.max(min, scale)), local), b, i, c));
  }, []);

  const frame = useCallback((rect: Rect, pad?: number) => {
    const { box: b, image: i, onView: report } = latestRef.current;
    if (!(b.width > 0)) return;
    report(frameRect(b, i, rect, pad));
  }, []);

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
    dragRef.current = {
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
    const origin = dragRef.current;
    if (!origin) {
      onHover?.(hoverPoint(event, viewportRef.current, effective, image));
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
    const origin = dragRef.current;
    dragRef.current = null;
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
      const restore = previousRef.current;
      if (restore) {
        onView(clampView(restore, box, image, clamp));
      } else {
        zoomTo(1, { x: event.clientX, y: event.clientY });
      }
      return;
    }
    previousRef.current = effective;
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
        if (!panKeys) return;
        commit({ ...effective, tx: effective.tx + nudge });
        break;
      case "ArrowRight":
        if (!panKeys) return;
        commit({ ...effective, tx: effective.tx - nudge });
        break;
      case "ArrowUp":
        if (!panKeys) return;
        commit({ ...effective, ty: effective.ty + nudge });
        break;
      case "ArrowDown":
        if (!panKeys) return;
        commit({ ...effective, ty: effective.ty - nudge });
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <ImageStageContext value={context}>
      <div
        ref={attachViewport}
        role="application"
        aria-label={label}
        tabIndex={0}
        style={style}
        data-fit={atFit ? "" : undefined}
        data-panning={panning ? "" : undefined}
        data-pan-mode={panMode ? "" : undefined}
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

        {/* One row, not two corners: as separate absolute boxes the toolbar and the readout
            overlapped as soon as the canvas was narrower than their combined width, which is
            an ordinary window on a two-column workbench. `justify-between` keeps them apart
            and lets the readout be the one that gives up room. */}
        {(toolbar || readout) && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex items-end justify-between gap-2">
            <div className="pointer-events-auto shrink-0">{toolbar}</div>
            <div className="min-w-0 truncate">{readout}</div>
          </div>
        )}
      </div>
    </ImageStageContext>
  );
}

function hoverPoint(
  event: { clientX: number; clientY: number },
  element: HTMLDivElement | null,
  view: StageView,
  image: Box,
): Point | null {
  if (!element) return null;
  const origin = viewportOrigin(element);
  const p = toImage(view, { x: event.clientX - origin.x, y: event.clientY - origin.y });
  return insideImage(p, image) ? p : null;
}

/**
 * Where viewport-local `(0, 0)` is in client coordinates: the *padding* box's corner, which
 * is where the absolutely positioned stage sits — not the border box's, which is what
 * `getBoundingClientRect` reports. The difference is the border's width, a whole image
 * pixel at 100% between the cursor and the pixel reported under it.
 */
function viewportOrigin(element: HTMLElement): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + element.clientLeft, y: rect.top + element.clientTop };
}

/** The element's content-box size, the box `ResizeObserver` reports as `contentRect`. */
function contentSize(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return {
    width:
      rect.width -
      px(style.borderLeftWidth) -
      px(style.borderRightWidth) -
      px(style.paddingLeft) -
      px(style.paddingRight),
    height:
      rect.height -
      px(style.borderTopWidth) -
      px(style.borderBottomWidth) -
      px(style.paddingTop) -
      px(style.paddingBottom),
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
