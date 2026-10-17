/**
 * The counts in words, which are the bar's accessible name: what a reader hears instead of the
 * colours.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breakdown, type BreakdownSegment, breakdownText } from "./Breakdown";

const SEGMENTS: BreakdownSegment[] = [
  { value: 412, tone: "normal", label: "done" },
  { value: 20, tone: "warn", label: "to check" },
  { value: 3, tone: "defect", label: "problems" },
];

describe("breakdownText", () => {
  it("lists the counts in order, then the total", () => {
    expect(breakdownText(SEGMENTS)).toBe("412 done, 20 to check, 3 problems of 435");
    expect(breakdownText(SEGMENTS, { total: 2_556 })).toBe("412 done, 20 to check, 3 problems of 2,556");
  });

  it("names the rest only with a remainder label, and only when there is a rest", () => {
    expect(breakdownText(SEGMENTS, { total: 566, remainderLabel: "to do" })).toBe("412 done, 20 to check, 3 problems, 131 to do of 566");
    expect(breakdownText(SEGMENTS, { remainderLabel: "to do" })).toBe("412 done, 20 to check, 3 problems of 435");
  });

  it("leaves out zero, negative and non-finite counts", () => {
    const odd: BreakdownSegment[] = [
      { value: 0, tone: "normal", label: "done" },
      { value: -4, tone: "warn", label: "to check" },
      { value: Number.NaN, tone: "defect", label: "problems" },
      { value: 5, tone: "neutral", label: "skipped" },
    ];
    expect(breakdownText(odd)).toBe("5 skipped of 5");
  });

  it("counts a total below the sum, or not a number, as the sum", () => {
    expect(breakdownText(SEGMENTS, { total: 10 })).toBe("412 done, 20 to check, 3 problems of 435");
    expect(breakdownText(SEGMENTS, { total: Number.POSITIVE_INFINITY })).toBe("412 done, 20 to check, 3 problems of 435");
  });

  it("reads 0 with nothing to count", () => {
    expect(breakdownText([])).toBe("0 of 0");
    expect(breakdownText([], { total: 566 })).toBe("0 of 566");
  });
});

describe("Breakdown", () => {
  it("is named by its counts unless the caller names it", () => {
    const { rerender } = render(<Breakdown segments={SEGMENTS} total={566} remainderLabel="to do" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("412 done, 20 to check, 3 problems, 131 to do of 566");

    rerender(<Breakdown segments={SEGMENTS} aria-label="Strings" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Strings");

    rerender(<Breakdown segments={SEGMENTS} aria-labelledby="elsewhere" />);
    expect(screen.getByRole("img").hasAttribute("aria-label")).toBe(false);
  });

  it("draws a segment per non-zero count, plus the rest as track", () => {
    render(<Breakdown segments={[...SEGMENTS, { value: 0, tone: "neutral", label: "skipped" }]} total={566} className="w-40" />);
    const bar = screen.getByRole("img");
    expect(bar.className).toContain("w-40");
    expect(bar.children).toHaveLength(4);
    expect((bar.children[0] as HTMLElement).style.flexGrow).toBe("412");
    expect((bar.children[3] as HTMLElement).style.flexGrow).toBe("131");
    expect(bar.children[3]!.hasAttribute("data-tone")).toBe(false);
  });
});
