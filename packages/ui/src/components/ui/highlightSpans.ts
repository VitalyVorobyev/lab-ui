/*
 * The model behind `HighlightedText`: spans over a string, cut into the runs that render
 * alike, and spans found by regular expressions. Pure, so it is tested without a DOM.
 *
 * Offsets are UTF-16 code-unit indices, as `String.prototype.slice` and `RegExp` use them.
 */

/** What a highlighted span is. Each kind has its own shape on screen, not only its own colour. */
export type HighlightKind = "placeholder" | "tag" | "protected-term" | "mismatch";

/** A highlighted range of the text: `[start, end)` in UTF-16 code units. */
export interface HighlightSpan {
  /** The offset of the span's first code unit. */
  start: number;
  /** The offset just past the span's last code unit. */
  end: number;
  /** What the span is; it decides the span's shape and its default label. */
  kind: HighlightKind;
  /**
   * What a screen reader hears after the span, instead of the kind's default label: say
   * *why* it is marked ("missing from the translation").
   */
  label?: string | undefined;
}

/** A run of the text covered by one set of spans; two spans side by side are two runs. */
export interface TextSegment {
  /** The run's characters. */
  text: string;
  /** Where the run starts in the whole text. */
  start: number;
  /** Where it ends. */
  end: number;
  /** The spans covering the run, in their order in the input. Empty for plain text. */
  spans: HighlightSpan[];
}

/** The kinds in the order their styles stack: a later one wins where two would clash. */
export const HIGHLIGHT_KINDS: readonly HighlightKind[] = ["tag", "protected-term", "placeholder", "mismatch"];

/**
 * Cuts `text` into runs that are each covered by one fixed set of spans. Spans are clamped
 * to the text; empty, inverted and non-finite ones are dropped. Overlapping spans are kept:
 * the overlap is a run covered by both.
 *
 * @param text - The string, shown as text.
 * @param spans - The highlights, in any order.
 * @returns The runs, in order, together covering the whole text.
 */
export function segmentText(text: string, spans: readonly HighlightSpan[]): TextSegment[] {
  const length = text.length;
  const clamp = (offset: number) => Math.floor(Math.max(0, Math.min(length, offset)));
  const valid = spans
    .map((span) => ({ span, start: clamp(span.start), end: clamp(span.end) }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start);
  const cuts = new Set<number>([0, length]);
  for (const { start, end } of valid) {
    cuts.add(start);
    cuts.add(end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: TextSegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const start = points[i]!;
    const end = points[i + 1]!;
    const covering = valid.filter((v) => v.start <= start && v.end >= end).map((v) => v.span);
    segments.push({ text: text.slice(start, end), start, end, spans: covering });
  }
  return segments;
}

/** A pattern whose matches become spans of one kind. */
export interface HighlightRule {
  /** Matched against the whole text, every match (the `g` flag is added if missing). */
  pattern: RegExp;
  /** The kind every match gets. */
  kind: HighlightKind;
  /** The spans' `label`, if they need one. */
  label?: string | undefined;
}

/**
 * Spans for every match of every rule: `%1`, `<b>`, a glossary term. Empty matches are
 * skipped. The result is sorted by start, then longest first.
 *
 * @param text - The string to search.
 * @param rules - Each pattern and the kind its matches get.
 * @returns The spans, ready for `HighlightedText`.
 *
 * @example
 * ```ts
 * findSpans("Open %1 in <b>ParamsManager</b>", [
 *   { pattern: /%\d+/, kind: "placeholder" },
 *   { pattern: /<\/?[a-z][^>]*>/i, kind: "tag" },
 *   { pattern: /\bParamsManager\b/, kind: "protected-term" },
 * ]);
 * ```
 */
export function findSpans(text: string, rules: readonly HighlightRule[]): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  for (const rule of rules) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    for (const match of text.matchAll(new RegExp(rule.pattern.source, flags))) {
      if (match[0] === "") continue;
      const start = match.index;
      spans.push({ start, end: start + match[0].length, kind: rule.kind, ...(rule.label === undefined ? {} : { label: rule.label }) });
    }
  }
  return spans.sort((a, b) => a.start - b.start || b.end - a.end);
}
