import { describe, expect, it } from "vitest";

import { findSpans, segmentText, type HighlightSpan } from "./highlightSpans";

const runs = (text: string, spans: HighlightSpan[]) => segmentText(text, spans).map((s) => [s.text, s.spans.map((span) => span.kind)]);

describe("segmentText", () => {
  it("cuts the text at the spans' edges", () => {
    expect(runs("Open %1 now", [{ start: 5, end: 7, kind: "placeholder" }])).toEqual([
      ["Open ", []],
      ["%1", ["placeholder"]],
      [" now", []],
    ]);
  });

  it("keeps an overlap as a run covered by both spans", () => {
    expect(
      runs("ab%2cd", [
        { start: 2, end: 4, kind: "placeholder" },
        { start: 0, end: 4, kind: "mismatch" },
      ]),
    ).toEqual([
      ["ab", ["mismatch"]],
      ["%2", ["placeholder", "mismatch"]],
      ["cd", []],
    ]);
  });

  it("keeps two spans side by side as two runs", () => {
    expect(
      runs("%1%2", [
        { start: 0, end: 2, kind: "placeholder" },
        { start: 2, end: 4, kind: "placeholder" },
      ]),
    ).toEqual([
      ["%1", ["placeholder"]],
      ["%2", ["placeholder"]],
    ]);
  });

  it("clamps spans to the text and drops empty, inverted and non-finite ones", () => {
    expect(
      runs("abc", [
        { start: -3, end: 1, kind: "tag" },
        { start: 2, end: 99, kind: "tag" },
        { start: 2, end: 2, kind: "mismatch" },
        { start: 3, end: 1, kind: "mismatch" },
        { start: Number.NaN, end: 2, kind: "mismatch" },
      ]),
    ).toEqual([
      ["a", ["tag"]],
      ["b", []],
      ["c", ["tag"]],
    ]);
  });

  it("gives no runs for an empty string", () => {
    expect(segmentText("", [{ start: 0, end: 3, kind: "tag" }])).toEqual([]);
  });
});

describe("findSpans", () => {
  const text = "Open %1 in <b>ParamsManager</b>, %1 again";
  it("finds every match of every rule, sorted", () => {
    const spans = findSpans(text, [
      { pattern: /%\d+/, kind: "placeholder" },
      { pattern: /<\/?[a-z][^>]*>/i, kind: "tag" },
      { pattern: /\bParamsManager\b/, kind: "protected-term", label: "do not translate" },
    ]);
    expect(spans.map((s) => [text.slice(s.start, s.end), s.kind])).toEqual([
      ["%1", "placeholder"],
      ["<b>", "tag"],
      ["ParamsManager", "protected-term"],
      ["</b>", "tag"],
      ["%1", "placeholder"],
    ]);
    expect(spans[2]!.label).toBe("do not translate");
    expect(spans[0]).not.toHaveProperty("label");
  });

  it("keeps the pattern's own flags and skips empty matches", () => {
    expect(findSpans("A a", [{ pattern: /a/gi, kind: "tag" }])).toHaveLength(2);
    expect(findSpans("abc", [{ pattern: /x*/, kind: "tag" }])).toEqual([]);
  });

  it("orders spans that start together longest first", () => {
    const spans = findSpans("{count}", [
      { pattern: /\{/, kind: "tag" },
      { pattern: /\{\w+\}/, kind: "placeholder" },
    ]);
    expect(spans.map((s) => s.kind)).toEqual(["placeholder", "tag"]);
  });
});
