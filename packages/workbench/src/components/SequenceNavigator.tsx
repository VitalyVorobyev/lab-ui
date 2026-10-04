/*
 * Which item of an ordered set is current — a frame of a capture, a page of a scan — as a
 * strip of thumbnails with previous/next and `[` / `]`.
 *
 * A capture is an ordered set and a person steps through it one item at a time, which a
 * dropdown hides and a library page makes a round trip. The strip keeps the neighbours in
 * view, and the keys work from anywhere on the screen.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Button, Kbd, StatusDot, cn, focusRing, type Tone } from "@vitavision/ui";

import { stepIndex } from "./sequence";

/**
 * A per-item status — "not found" in a batch run, "rejected" by a reviewer — drawn as a dot in
 * the thumbnail's corner and said in words in the item's name.
 */
export interface SequenceItemStatus {
  /** The dot's colour, by meaning; also the item's `data-status`. */
  tone: Tone;
  /** The status in words, appended to the item's name and tooltip: `"frame_0003.bmp, not found"`. */
  label: string;
}

/** One item of a `SequenceNavigator`. */
export interface SequenceItem {
  /** Its identity, unique in the sequence. */
  id: string;
  /** Its name: the thumbnail's alt text and tooltip. */
  label: string;
  /** A thumbnail URL, loaded lazily. Without it, the default rendering is the label. */
  thumbnail?: string | undefined;
  /** A status, drawn as a dot in the thumbnail's corner over any thumbnail rendering. */
  status?: SequenceItemStatus | undefined;
}

/** Props of `SequenceNavigator`. */
export interface SequenceNavigatorProps {
  /** The items, in order. */
  items: readonly SequenceItem[];
  /** The current item's id, or `null` for none. */
  value: string | null;
  /** Called with the id of the item chosen by click, by previous/next, or by `[` / `]`. */
  onValueChange: (id: string) => void;
  /** Draws an item's thumbnail, e.g. one whose URL must be fetched. Defaults to a lazy `<img>`. */
  renderThumbnail?: ((item: SequenceItem) => ReactNode) | undefined;
  /** Step with `[` and `]` from anywhere outside a text field. Defaults to true. */
  keys?: boolean | undefined;
  /** Wrap from the last item to the first. Defaults to false. */
  wrap?: boolean | undefined;
  /** Names the strip (`aria-label`). */
  "aria-label": string;
  /** Merged with the row's own classes through `cn`. */
  className?: string | undefined;
}

/**
 * A horizontal strip of thumbnails between previous and next buttons, with the position
 * ("3 / 50").
 *
 * The current thumbnail carries `aria-current="true"` and `data-current`, has an outline,
 * and is scrolled into view when it changes. An item with a `status` shows a dot in its
 * corner, carries `data-status` (the tone) and is named `"label, status"`. `[` and `]` step
 * from anywhere outside a text field. Thumbnails load lazily, so a capture of thousands of
 * frames opens at once. The strip is as wide as its thumbnails, so previous and next stay
 * beside a short sequence; a long one scrolls.
 */
export function SequenceNavigator({
  items,
  value,
  onValueChange,
  renderThumbnail,
  keys = true,
  wrap = false,
  "aria-label": ariaLabel,
  className,
}: SequenceNavigatorProps) {
  const index = items.findIndex((item) => item.id === value);
  const listRef = useRef<HTMLOListElement>(null);

  const step = (delta: 1 | -1) => {
    const next = stepIndex(items.length, index, delta, wrap);
    const item = next === null ? undefined : items[next];
    if (item && item.id !== value) onValueChange(item.id);
  };
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  useEffect(() => {
    if (!keys) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === "[") stepRef.current(-1);
      else if (event.key === "]") stepRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys]);

  useEffect(() => {
    listRef.current?.querySelector("[data-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const atStart = !wrap && index <= 0;
  const atEnd = !wrap && (index < 0 || index >= items.length - 1);

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <Button
        size="sm"
        variant="ghost"
        icon={<ChevronLeft />}
        aria-label="Previous"
        aria-keyshortcuts={keys ? "[" : undefined}
        disabled={items.length < 2 || atStart}
        onClick={() => step(-1)}
      />
      <ol ref={listRef} aria-label={ariaLabel} className="flex min-w-0 gap-1 overflow-x-auto py-1">
        {items.map((item) => {
          const current = item.id === value;
          const { status } = item;
          const name = status ? `${item.label}, ${status.label}` : item.label;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                title={name}
                aria-label={name}
                aria-current={current ? "true" : undefined}
                data-current={current ? "" : undefined}
                data-status={status?.tone}
                onClick={() => {
                  if (!current) onValueChange(item.id);
                }}
                className={cn(
                  "relative block h-10 w-14 overflow-hidden rounded-control border border-line bg-raised text-fg",
                  "data-current:ring-2 data-current:ring-signal",
                  focusRing,
                )}
              >
                {renderThumbnail ? (
                  renderThumbnail(item)
                ) : item.thumbnail ? (
                  <img src={item.thumbnail} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <span className={cn("block truncate px-1 font-mono text-[10px]", status && "pr-3")}>{item.label}</span>
                )}
                {status && (
                  // The surface-coloured backing keeps the dot legible over any thumbnail.
                  <StatusDot tone={status.tone} className="absolute top-0.5 right-0.5 rounded-full bg-surface p-0.5" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <Button
        size="sm"
        variant="ghost"
        icon={<ChevronRight />}
        aria-label="Next"
        aria-keyshortcuts={keys ? "]" : undefined}
        disabled={items.length < 2 || atEnd}
        onClick={() => step(1)}
      />
      <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
        {index >= 0 ? index + 1 : "–"} / {items.length}
      </span>
      {keys && (
        <span className="hidden shrink-0 items-center gap-0.5 text-xs text-fg-muted sm:flex" aria-hidden>
          <Kbd>[</Kbd>
          <Kbd>]</Kbd>
        </span>
      )}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
