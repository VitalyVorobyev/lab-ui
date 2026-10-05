/**
 * Reusable source-image contour overlay and vertex editor for ImageStage.
 *
 * The outline itself takes no pointer events: a press on it reaches whatever is below, and
 * the stage pans from it when nothing is. The editor answers the stage's hit-test instead
 * (nearest segment), which is how a double-click on the outline inserts a vertex without a
 * wide transparent band intercepting every press near the line.
 */

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { arcLengths, deformContour, eraseArc, projectToArc, subPath } from "./contourArc";
import { DraftShape } from "./DraftShape";
import { overlayRole } from "./overlayRole";
import { imageViewBox } from "./stage/view";
import { useStage } from "./stage/ImageStage";
import { CLICK_SLOP } from "./stage/gesture";
import { STAGE_HIT_PRIORITY } from "./stage/hitTest";
import { useStageDrag } from "./stage/StageSurface";
import { useStageHitLayer } from "./stage/useStageHitTest";
import { useScreenPx } from "./stage/useScreenPx";
import type { Point } from "./measureGeometry";
import type { Rect } from "./stage/view";

/** The colour of an erase: its footprint and the stretch it would remove. */
const ERASE = "var(--defect)";

/** An ordered contour, closed or open, drawn in source-image pixel-center coordinates. */
export interface ContourEditorProps {
  /** Ordered vertices; on a closed contour the final vertex connects back to the first. */
  points: Point[];
  /**
   * Whether the last vertex joins the first. Defaults to `true`, a closed polygon; `false`
   * draws an open polyline (a centreline, an edge piece), which keeps at least two vertices
   * where a closed contour keeps three.
   */
  closed?: boolean | undefined;
  /** Receives a complete replacement point list after each edit. */
  onChange: (points: Point[]) => void;
  /** Called at the end of a pointer or keyboard edit; useful for history snapshots. */
  onCommit?: () => void;
  /** Show draggable, keyboard-editable vertices. */
  editable?: boolean;
  /** Accessible name for the contour and its vertices. */
  label?: string;
  /** CSS stroke color. */
  stroke?: string;
  /**
   * The area, in image coordinates, every vertex is kept inside: a drag, a keyboard nudge and
   * an inserted vertex are clamped to it. Defaults to the pixel centres,
   * `{ x: 0, y: 0, width: w - 1, height: h - 1 }`. Pass `{ x: -0.5, y: -0.5, width: w, height: h }`
   * for polygons in the area convention, which may lie exactly on the image border.
   */
  bounds?: Rect | undefined;
  /** The id hit-tests report for this contour, whose items are segment indices. Defaults to a generated one. */
  layerId?: string | undefined;
  /** Rank against other layers in hit-tests. Defaults to `STAGE_HIT_PRIORITY.line`. */
  priority?: number | undefined;
  /**
   * What a press does while `editable`:
   * - `"vertex"` (the default): vertices are dragged, nudged, inserted and deleted.
   * - `"brush"`: a drag pushes the contour with a soft round brush of `brushRadius`, centred
   *   where the press landed; `onChange` follows the drag and `onCommit` ends it.
   * - `"erase"`: a drag along the contour marks a stretch of it, and the release reports what
   *   is left through `onErase`.
   *
   * In `"brush"` and `"erase"` the editor covers the image with its own press target
   * (`data-tool-surface`) and shows the brush's footprint under the pointer; a press whose
   * brush does not reach the contour is declined, so the stage pans.
   */
  mode?: "vertex" | "brush" | "erase" | undefined;
  /** The brush's radius in `"brush"` and `"erase"` mode, in image pixels. Defaults to 20. */
  brushRadius?: number | undefined;
  /**
   * Called when an erase drag is released, with the pieces of the contour that are left (each
   * an open polyline, see `eraseArc`) and the erased stretch as arc lengths: from `start`
   * forward to `end`, past the first vertex of a closed contour when `start > end`. The editor
   * does not change `points` itself. Erasing a stretch of a closed contour leaves **one open
   * piece**: to keep editing it, pass it back as `points` with `closed={false}`.
   */
  onErase?: ((pieces: Point[][], range: { start: number; end: number }) => void) | undefined;
}

/**
 * The index of the segment closest to `point`: segment `i` runs from vertex `i` to the next.
 *
 * @param points - The contour's vertices.
 * @param point - The point, in image coordinates.
 * @param closed - Whether the last vertex joins the first, which adds the closing segment
 *   (index `points.length - 1`). Defaults to `true`.
 * @returns The segment's index; 0 for a contour with no segment.
 */
export function nearestContourSegment(points: Point[], point: Point, closed = true): number {
  return nearestSegment(points, point, closed).index;
}

/** The closest segment and its distance from `point`. */
function nearestSegment(points: Point[], point: Point, closed: boolean): { index: number; distance: number } {
  let nearest = 0;
  let distance = Infinity;
  const segments = closed ? points.length : points.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
    if (d < distance) { distance = d; nearest = i; }
  }
  return { index: nearest, distance: Math.sqrt(distance) };
}

/**
 * Edit contour vertices over an ImageStage using its shared source-image transform.
 *
 * - **Vertices.** Each vertex is a focusable button: drag it (once the pointer has moved
 *   3 screen pixels, so a jittery click edits nothing), nudge it with the arrow keys (Shift for
 *   a tenth of a pixel), delete it with Delete or Backspace (a closed contour keeps three
 *   vertices, an open one two), or insert one after it with Insert.
 * - **Open or closed.** `closed` (the default) draws a polygon; `closed={false}` an open
 *   polyline with no segment from the last vertex back to the first.
 * - **Outline.** The outline takes no presses, so a press on it reaches the layers below, or
 *   pans. While `editable` in `"vertex"` mode, the contour answers the stage's hit-test
 *   (`STAGE_HIT_PRIORITY.line` by default, segment indices as ids), and a double-click near the
 *   outline inserts a vertex on the nearest segment; the stage's double-click to fit does not
 *   run then.
 * - **Brush and erase.** In `"brush"` mode a drag pushes the contour with a soft round brush
 *   (`deformContour`, from the contour as it was at the press, held inside `bounds`); in
 *   `"erase"` mode a drag along the contour previews the stretch it removes, dashed, and the
 *   release calls `onErase`. Both start only past the click slop. The vertex handles are
 *   hidden in these modes.
 *
 * The SVG carries `data-mode` while editable; the tool surface is `data-tool-surface`, and the
 * stretch an erase would remove is `data-erase-preview`.
 */
export function ContourEditor({
  points,
  closed = true,
  onChange,
  onCommit,
  editable = false,
  label = "Contour",
  stroke = "var(--signal)",
  bounds,
  layerId,
  priority = STAGE_HIT_PRIORITY.line,
  mode = "vertex",
  brushRadius = 20,
  onErase,
}: ContourEditorProps) {
  const stage = useStage();
  const px = useScreenPx();
  const startDrag = useStageDrag();
  // Where the brush's footprint is drawn: under a hovering mouse or pen, and during a gesture.
  const [footprint, setFootprint] = useState<Point | null>(null);
  // The stretch an erase drag would remove, as arc lengths.
  const [erasing, setErasing] = useState<{ start: number; end: number } | null>(null);
  const draggingRef = useRef<{ index: number; client: Point } | null>(null);
  const movedRef = useRef(false);
  const [selected, setSelected] = useState<number | null>(null);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const radius = stage.imageLength(5);
  const hairline = stage.imageLength(1.5);

  function clamp(point: Point): Point {
    const area = bounds ?? { x: 0, y: 0, width: stage.image.width - 1, height: stage.image.height - 1 };
    return {
      x: Math.max(area.x, Math.min(area.x + area.width, point.x)),
      y: Math.max(area.y, Math.min(area.y + area.height, point.y)),
    };
  }

  /** Replace one vertex; returns whether anything changed, so no-op edits add no history. */
  function move(index: number, point: Point): boolean {
    const current = points[index];
    const target = clamp(point);
    if (!current || (current.x === target.x && current.y === target.y)) return false;
    const next = [...points];
    next[index] = target;
    onChange(next);
    return true;
  }

  /** Insert `point` (clamped) after vertex `index`, and select it. */
  function insert(index: number, point: Point) {
    onChange([...points.slice(0, index + 1), clamp(point), ...points.slice(index + 1)]);
    setSelected(index + 1);
    onCommit?.();
  }

  /** The fewest vertices the contour keeps: a closed one is a polygon, an open one a line. */
  const fewest = closed ? 3 : 2;
  // The outline answers the stage's hit-test rather than owning a press target: a press on it
  // goes to whatever is below, and a double-click near it inserts a vertex.
  const active = editable && mode === "vertex" && points.length >= fewest;
  const tool = editable && mode !== "vertex";
  useStageHitLayer({
    layerId,
    priority,
    pick: (point, hitRadius) => {
      if (!active) return null;
      const hit = nearestSegment(points, point, closed);
      return hit.distance <= hitRadius ? { id: hit.index, dist: hit.distance } : null;
    },
    onDoubleClick: active
      ? (id, point) => {
          insert(Number(id), point);
        }
      : undefined,
  });

  function pointerDown(event: PointerEvent<SVGCircleElement>, index: number) {
    if (!editable || stage.panMode || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = { index, client: { x: event.clientX, y: event.clientY } };
    movedRef.current = false;
    setSelected(index);
  }

  function pointerMove(event: PointerEvent<SVGCircleElement>) {
    const drag = draggingRef.current;
    if (drag === null) return;
    event.stopPropagation();
    // A jittery click is not an edit: the vertex stays until the pointer leaves the click slop.
    if (!movedRef.current && Math.hypot(event.clientX - drag.client.x, event.clientY - drag.client.y) <= CLICK_SLOP) return;
    movedRef.current = true;
    move(drag.index, stage.toImage({ x: event.clientX, y: event.clientY }));
  }

  function pointerUp(event: PointerEvent<SVGCircleElement>) {
    if (draggingRef.current === null) return;
    event.stopPropagation();
    draggingRef.current = null;
    if (movedRef.current) onCommit?.();
  }

  function keyDown(event: KeyboardEvent<SVGCircleElement>, index: number) {
    if (!editable || stage.panMode) return;
    const delta = event.shiftKey ? 0.1 : 1;
    const p = points[index];
    if (!p) return;
    const shift: Record<string, Point> = {
      ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 },
      ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta },
    };
    if (shift[event.key]) {
      event.preventDefault();
      event.stopPropagation();
      if (move(index, { x: p.x + shift[event.key]!.x, y: p.y + shift[event.key]!.y })) onCommit?.();
    } else if ((event.key === "Delete" || event.key === "Backspace") && points.length > fewest) {
      event.preventDefault();
      event.stopPropagation();
      onChange(points.filter((_, i) => i !== index));
      setSelected(null);
      onCommit?.();
    } else if (event.key === "Insert" && points.length >= fewest) {
      event.preventDefault();
      event.stopPropagation();
      // Midway to the next vertex; past an open contour's last vertex there is none, so midway
      // to the one before it.
      const after = !closed && index === points.length - 1 ? index - 1 : index;
      const a = points[after]!;
      const b = points[(after + 1) % points.length]!;
      insert(after, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }

  /**
   * A press on the tool surface: a brush push or an erase, from where it landed. Declined (the
   * stage pans) when the brush does not reach the contour.
   */
  function toolDown(event: PointerEvent<SVGRectElement>) {
    if (stage.panMode || event.button !== 0 || points.length === 0) return;
    const from = stage.toImage({ x: event.clientX, y: event.clientY });
    const hit = projectToArc(points, from, closed);
    if (hit.distance > brushRadius) return;
    const client = { x: event.clientX, y: event.clientY };
    const touch = event.pointerType === "touch";
    let moved = false;
    /** Whether the pointer has left the click slop: before that, the press edits nothing. */
    const past = (e: globalThis.PointerEvent) =>
      moved || (moved = Math.hypot(e.clientX - client.x, e.clientY - client.y) > CLICK_SLOP);
    setFootprint(from);
    if (mode === "brush") {
      const snapshot = points;
      let changed = false;
      startDrag(event, {
        onMove: (p, e) => {
          if (!touch) setFootprint(p);
          if (!past(e)) return;
          changed = true;
          onChange(deformContour(snapshot, from, { x: p.x - from.x, y: p.y - from.y }, brushRadius, closed).map(clamp));
        },
        onEnd: () => {
          if (touch) setFootprint(null);
          if (changed) onCommit?.();
        },
        onCancel: () => {
          setFootprint(null);
          if (changed) onChange(snapshot);
        },
      });
      return;
    }
    const snapshot = points;
    const start = hit.s;
    let range: { start: number; end: number } | null = null;
    startDrag(event, {
      onMove: (p, e) => {
        if (!touch) setFootprint(p);
        if (!past(e)) return;
        range = stretchBetween(snapshot, start, projectToArc(snapshot, p, closed).s, closed);
        setErasing(range);
      },
      onEnd: () => {
        if (touch) setFootprint(null);
        setErasing(null);
        if (range && range.start !== range.end) onErase?.(eraseArc(snapshot, range.start, range.end, closed), range);
      },
      onCancel: () => {
        setFootprint(null);
        setErasing(null);
      },
    });
  }

  const preview = erasing ? subPath(points, erasing.start, erasing.end, closed) : null;

  return (
    <>
      <svg
        viewBox={imageViewBox(stage.image)}
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        role={editable ? undefined : "img"}
        aria-label={label}
        data-mode={editable ? mode : undefined}
      >
        {tool && (
          <rect
            data-tool-surface=""
            x={-0.5}
            y={-0.5}
            width={stage.image.width}
            height={stage.image.height}
            fill="transparent"
            className="pointer-events-auto"
            style={{ cursor: stage.panMode ? undefined : "crosshair" }}
            onPointerDown={toolDown}
            onPointerMove={(event) => {
              if (event.pointerType !== "touch" && !stage.panMode) setFootprint(stage.toImage({ x: event.clientX, y: event.clientY }));
            }}
            onPointerLeave={() => setFootprint(null)}
            onDoubleClick={(event) => {
              if (!stage.panMode) event.stopPropagation();
            }}
          />
        )}
        {closed ? (
          <polygon points={line} fill="none" stroke={stroke} strokeWidth={hairline} />
        ) : (
          <polyline points={line} fill="none" stroke={stroke} strokeWidth={hairline} strokeLinejoin="round" />
        )}
        {preview && (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={toAttribute(preview)} stroke={overlayRole("halo")} strokeWidth={px(4)} />
            <polyline data-erase-preview="" points={toAttribute(preview)} stroke={ERASE} strokeWidth={px(2.5)} strokeDasharray={`${px(6)} ${px(4)}`} />
          </g>
        )}
        {editable && mode === "vertex" && points.map((point, index) => (
          // The contour API is an ordered point list without vertex IDs; indices are stable across drag edits.
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <circle key={index} cx={point.x} cy={point.y} r={selected === index ? radius * 1.3 : radius} fill="var(--surface)" stroke={stroke} strokeWidth={hairline} className="pointer-events-auto cursor-move" tabIndex={0} role="button" aria-label={`${label} point ${index + 1}`} onPointerDown={(event) => pointerDown(event, index)} onPointerMove={pointerMove} onPointerUp={pointerUp} onLostPointerCapture={pointerUp} onDoubleClick={(event) => { if (!stage.panMode) event.stopPropagation(); }} onKeyDown={(event) => keyDown(event, index)} onFocus={() => setSelected(index)} />
        ))}
      </svg>
      {tool && footprint && (
        <DraftShape shape={{ kind: "brush", x: footprint.x, y: footprint.y, diameter: 2 * brushRadius }} stroke={mode === "erase" ? ERASE : undefined} />
      )}
    </>
  );
}

/**
 * The stretch from arc length `a` to `b` as `{ start, end }`, running forward. On a closed
 * contour, the shorter way round: a drag back across the first vertex erases the few pixels
 * it covered, not the rest of the contour.
 */
function stretchBetween(points: readonly Point[], a: number, b: number, closed: boolean): { start: number; end: number } {
  if (!closed) return { start: Math.min(a, b), end: Math.max(a, b) };
  const total = arcLengths(points, true).at(-1) ?? 0;
  if (!(total > 0)) return { start: a, end: b };
  const forward = (((b - a) % total) + total) % total;
  return forward <= total / 2 ? { start: a, end: b } : { start: b, end: a };
}

function toAttribute(points: readonly Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}
