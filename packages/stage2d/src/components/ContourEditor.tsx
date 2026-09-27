/** Reusable source-image contour overlay and vertex editor for ImageStage. */

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { imageViewBox } from "./stage/view";
import { useStage } from "./stage/ImageStage";
import type { Point } from "./measureGeometry";

export interface ContourEditorProps {
  points: Point[];
  onChange: (points: Point[]) => void;
  /** Called at the end of a pointer or keyboard edit; useful for history snapshots. */
  onCommit?: () => void;
  editable?: boolean;
  label?: string;
  stroke?: string;
}

export function nearestContourSegment(points: Point[], point: Point): number {
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
  return nearest;
}

export function ContourEditor({ points, onChange, onCommit, editable = false, label = "Contour", stroke = "var(--signal)" }: ContourEditorProps) {
  const stage = useStage();
  const draggingRef = useRef<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const radius = stage.imageLength(5);
  const hairline = stage.imageLength(1.5);

  function move(index: number, point: Point) {
    const next = [...points];
    next[index] = {
      x: Math.max(0, Math.min(stage.image.width - 1, point.x)),
      y: Math.max(0, Math.min(stage.image.height - 1, point.y)),
    };
    onChange(next);
  }

  function pointerDown(event: PointerEvent<SVGCircleElement>, index: number) {
    if (!editable || stage.panMode || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = index;
    setSelected(index);
  }

  function pointerMove(event: PointerEvent<SVGCircleElement>) {
    if (draggingRef.current === null) return;
    event.stopPropagation();
    move(draggingRef.current, stage.toImage({ x: event.clientX, y: event.clientY }));
  }

  function pointerUp(event: PointerEvent<SVGCircleElement>) {
    if (draggingRef.current === null) return;
    event.stopPropagation();
    draggingRef.current = null;
    onCommit?.();
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
      move(index, { x: p.x + shift[event.key]!.x, y: p.y + shift[event.key]!.y });
      onCommit?.();
    } else if ((event.key === "Delete" || event.key === "Backspace") && points.length > 3) {
      event.preventDefault();
      event.stopPropagation();
      onChange(points.filter((_, i) => i !== index));
      setSelected(null);
      onCommit?.();
    }
  }

  return (
    <svg viewBox={imageViewBox(stage.image)} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-label={label}>
      <polygon points={line} fill="none" stroke={stroke} strokeWidth={hairline} />
      {editable && points.length >= 3 && (
        <polygon points={line} fill="none" stroke="transparent" strokeWidth={stage.imageLength(12)} className="pointer-events-auto" aria-label={`Add point to ${label}`} onDoubleClick={(event) => {
          if (stage.panMode) return;
          event.stopPropagation();
          const point = stage.toImage({ x: event.clientX, y: event.clientY });
          const index = nearestContourSegment(points, point);
          onChange([...points.slice(0, index + 1), point, ...points.slice(index + 1)]);
          setSelected(index + 1);
          onCommit?.();
        }} />
      )}
      {editable && points.map((point, index) => (
        // The contour API is an ordered point list without vertex IDs; indices are stable across drag edits.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <circle key={index} cx={point.x} cy={point.y} r={selected === index ? radius * 1.3 : radius} fill="var(--surface)" stroke={stroke} strokeWidth={hairline} className="pointer-events-auto cursor-move" tabIndex={0} role="button" aria-label={`${label} point ${index + 1}`} onPointerDown={(event) => pointerDown(event, index)} onPointerMove={pointerMove} onPointerUp={pointerUp} onLostPointerCapture={pointerUp} onKeyDown={(event) => keyDown(event, index)} onFocus={() => setSelected(index)} />
      ))}
    </svg>
  );
}
