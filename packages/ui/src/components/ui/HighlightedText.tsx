/*
 * A string with marked spans: the placeholders, tags and protected terms of a UI string, and
 * where a translation does not match its source.
 *
 * The string is only ever text. It is cut into runs and each run is a React text child, so
 * `<b>` in a string is shown as the four characters `<b>`, never parsed. There is no
 * `dangerouslySetInnerHTML` here, nor anywhere in the package.
 *
 * Each kind differs in shape, not only in colour (a box, a mono face, an underline style),
 * and a screen reader hears the kind after the span. That label is selection-proof: a reader
 * copying the string gets the string.
 */

import type { ComponentProps } from "react";

import { cn } from "./cn";
import { HIGHLIGHT_KINDS, segmentText, type HighlightKind, type HighlightSpan } from "./highlightSpans";

/** What a screen reader hears after a span of each kind, by default. */
const LABELS: Record<HighlightKind, string> = {
  placeholder: "placeholder",
  tag: "markup",
  "protected-term": "protected term",
  mismatch: "mismatch",
};

/** The look of each kind; listed in `HIGHLIGHT_KINDS` order, so a later kind wins a clash. */
const STYLES: Record<HighlightKind, string> = {
  // Code-like, in a quiet box.
  tag: "rounded-sm bg-raised px-px font-mono text-fg-muted",
  // Read as a name: a dotted underline, the face unchanged.
  "protected-term": "underline decoration-fg-subtle decoration-dotted decoration-1 underline-offset-[3px]",
  // A slot the code fills: mono, outlined.
  placeholder: "rounded-sm bg-raised px-px font-mono text-fg ring-1 ring-line-strong ring-inset",
  // A verdict the app made: a wavy underline and a tint, in the defect colour.
  mismatch: "bg-defect/12 text-fg underline decoration-defect decoration-wavy decoration-1 underline-offset-[3px]",
};

/** Props of `HighlightedText`: the text, its spans, and every `<span>` prop but `children`. */
export type HighlightedTextProps = Omit<ComponentProps<"span">, "children"> & {
  /** The string. Shown as text, whitespace and line breaks kept; markup in it is not interpreted. */
  text: string;
  /** The ranges to mark, in UTF-16 offsets, in any order; overlaps are allowed. `findSpans` builds them from patterns. */
  spans?: readonly HighlightSpan[] | undefined;
  /**
   * What a screen reader hears after a span of each kind: "placeholder", "markup",
   * "protected term" and "mismatch" by default. `null` silences a kind. A span's own `label` wins.
   */
  labels?: Partial<Record<HighlightKind, string | null>> | undefined;
};

/**
 * A string with highlighted spans: placeholders (`%1`, `{count}`), markup tags (`<b>`),
 * protected terms (`ParamsManager`) and mismatches, each drawn in its own shape. The caller
 * supplies the spans, or finds them with `findSpans`.
 *
 * The text is rendered as text, never as HTML. Each span is a `<mark>` with `data-kind` (the
 * kinds covering it, space-separated), followed by its label for screen readers ("%1,
 * placeholder"), which a copy of the text leaves out.
 */
export function HighlightedText({ text, spans = [], labels, className, ...rest }: HighlightedTextProps) {
  const segments = segmentText(text, spans);
  return (
    <span {...rest} className={cn("break-words whitespace-pre-wrap", className)}>
      {segments.map((segment) => {
        if (segment.spans.length === 0) return segment.text;
        const kinds = HIGHLIGHT_KINDS.filter((kind) => segment.spans.some((span) => span.kind === kind));
        const said = segment.spans
          .map((span) => span.label ?? (labels?.[span.kind] === undefined ? LABELS[span.kind] : labels[span.kind]))
          .filter((label): label is string => typeof label === "string" && label !== "");
        return (
          <mark
            key={segment.start}
            data-kind={kinds.join(" ")}
            className={cn("bg-transparent text-inherit", ...kinds.map((kind) => STYLES[kind]))}
          >
            {segment.text}
            {said.length > 0 && <span className="sr-only select-none">{`, ${[...new Set(said)].join(", ")}`}</span>}
          </mark>
        );
      })}
    </span>
  );
}
