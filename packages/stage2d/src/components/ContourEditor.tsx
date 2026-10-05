/**
 * Reusable source-image contour overlay and vertex editor for ImageStage.
 *
 * The outline itself takes no pointer events: a press on it reaches whatever is below, and
 * the stage pans from it when nothing is. The editor answers the stage's hit-test instead
 * (nearest segment), which is how a double-click on the outline inserts a vertex without a
 * wide transparent band intercepting every press near the line.
 */

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { imageViewBox } from "./stage/view";
import { useStage } from "./stage/ImageStage";
import { CLICK_SLOP } from "./stage/gesture";
import { STAGE_HIT_PRIORITY } from "./stage/hitTest";
import { useStageHitLayer } from "./stage/useStageHitTest";
import type { Point } from "./measureGeometry";
import type { Rect } from "./stage/view";

/** An ordered, closed contour drawn in source-image pixel-center coordinates. */
export interface ContourEditorProps {
  /** Ordered vertices; the final vertex connects back to the first. */
  points: Point[];
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
}

/** Return the index of the closest segment, with the last vertex joined to the first. */
export function nearestContourSegment(points: Point[], point: Point): number {
  return nearestSegment(points, point).index;
}

/** The closest segment (the last vertex joined to the first) and its distance from `point`. */
function nearestSegment(points: Point[], point: Point): { index: number; distance: number } {
  let nearest = 0;
  let distance = Infinity;
  for (let i = 0; i < points.length; i++) {
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
 *   a tenth of a pixel), delete it with Delete or Backspace, or insert one after it with Insert.
 * - **Outline.** The outline takes no presses, so a press on it reaches the layers below, or
 *   pans. While `editable`, the contour answers the stage's hit-test (`STAGE_HIT_PRIORITY.line`
 *   by default, segment indices as ids), and a double-click near the outline inserts a vertex
 *   on the nearest segment; the stage's double-click to fit does not run then.
 */
export function ContourEditor({
  points,
  onChange,
  onCommit,
  editable = false,
  label = "Contour",
  stroke = "var(--signal)",
  bounds,
  layerId,
  priority = STAGE_HIT_PRIORITY.line,
}: ContourEditorProps) {
  const stage = useStage();
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

  // The outline answers the stage's hit-test rather than owning a press target: a press on it
  // goes to whatever is below, and a double-click near it inserts a vertex.
  const active = editable && points.length >= 3;
  useStageHitLayer({
    layerId,
    priority,
    pick: (point, hitRadius) => {
      if (!active) return null;
      const hit = nearestSegment(points, point);
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
    } else if ((event.key === "Delete" || event.key === "Backspace") && points.length > 3) {
      event.preventDefault();
      event.stopPropagation();
      onChange(points.filter((_, i) => i !== index));
      setSelected(null);
      onCommit?.();
    } else if (event.key === "Insert" && points.length >= 3) {
      event.preventDefault();
      event.stopPropagation();
      const next = points[(index + 1) % points.length]!;
      insert(index, { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 });
    }
  }

  return (
    <svg viewBox={imageViewBox(stage.image)} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" role={editable ? undefined : "img"} aria-label={label}>
      <polygon points={line} fill="none" stroke={stroke} strokeWidth={hairline} />
      {editable && points.map((point, index) => (
        // The contour API is an ordered point list without vertex IDs; indices are stable across drag edits.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <circle key={index} cx={point.x} cy={point.y} r={selected === index ? radius * 1.3 : radius} fill="var(--surface)" stroke={stroke} strokeWidth={hairline} className="pointer-events-auto cursor-move" tabIndex={0} role="button" aria-label={`${label} point ${index + 1}`} onPointerDown={(event) => pointerDown(event, index)} onPointerMove={pointerMove} onPointerUp={pointerUp} onLostPointerCapture={pointerUp} onDoubleClick={(event) => { if (!stage.panMode) event.stopPropagation(); }} onKeyDown={(event) => keyDown(event, index)} onFocus={() => setSelected(index)} />
      ))}
    </svg>
  );
}
