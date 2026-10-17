/**
 * Property tests for `segmentText`: laws that hold for any string and any spans, not just the
 * examples in `highlightSpans.test.ts`.
 *
 * Inputs come from a seeded PRNG, so a failure reproduces exactly; the failing input is in the
 * assertion message.
 */

import { describe, expect, it } from "vitest";

import { HIGHLIGHT_KINDS, segmentText, type HighlightSpan } from "./highlightSpans";

const RUNS = 1000;

/** mulberry32 — small, fast, and good enough to spread test inputs. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = "ab %1<>/{}é\n";

function anyCase(random: () => number): { text: string; spans: HighlightSpan[] } {
  const length = Math.floor(random() * 30);
  const text = Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
  const spans = Array.from({ length: Math.floor(random() * 6) }, () => ({
    start: Math.floor(random() * (length + 6)) - 3,
    end: Math.floor(random() * (length + 6)) - 3,
    kind: HIGHLIGHT_KINDS[Math.floor(random() * HIGHLIGHT_KINDS.length)]!,
  }));
  return { text, spans };
}

describe("segmentText laws", () => {
  it("reassembles the text exactly, in contiguous non-empty runs", () => {
    const random = prng(11);
    for (let run = 0; run < RUNS; run++) {
      const { text, spans } = anyCase(random);
      const segments = segmentText(text, spans);
      const msg = JSON.stringify({ text, spans });
      expect(segments.map((s) => s.text).join(""), msg).toBe(text);
      let at = 0;
      for (const s of segments) {
        expect(s.start, msg).toBe(at);
        expect(s.end, msg).toBeGreaterThan(s.start);
        expect(s.text, msg).toBe(text.slice(s.start, s.end));
        at = s.end;
      }
      expect(at, msg).toBe(text.length);
    }
  });

  it("marks a character exactly when a (clamped) span covers it", () => {
    const random = prng(12);
    for (let run = 0; run < RUNS; run++) {
      const { text, spans } = anyCase(random);
      const segments = segmentText(text, spans);
      for (let i = 0; i < text.length; i++) {
        const segment = segments.find((s) => s.start <= i && i < s.end)!;
        const covering = spans.filter((span) => Math.max(0, span.start) <= i && i < Math.min(text.length, span.end));
        expect(segment.spans, JSON.stringify({ text, spans, i })).toEqual(covering);
      }
    }
  });
});
