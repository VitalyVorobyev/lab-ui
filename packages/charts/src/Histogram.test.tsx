import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Histogram } from "./Histogram";

function noNaN(container: HTMLElement) {
  for (const element of container.querySelectorAll("*")) {
    for (const attribute of element.getAttributeNames()) {
      expect(element.getAttribute(attribute)).not.toMatch(/NaN|undefined|Infinity/);
    }
  }
}

describe("Histogram", () => {
  it("bins raw values into one bars path", () => {
    const { container, getByRole } = render(<Histogram label="Scores" values={[1, 2, 2, 3, 9]} bins={4} />);
    expect(getByRole("img", { name: "Scores" })).toBeTruthy();
    expect(container.querySelectorAll("path[data-bars]")).toHaveLength(1);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
    noNaN(container);
  });

  it("takes pre-binned counts over a domain", () => {
    const { container } = render(<Histogram label="Luminance" counts={[0, 5, 9, 1]} domain={[0, 256]} />);
    expect(container.querySelector("path[data-bars]")?.getAttribute("d")?.match(/M/g)).toHaveLength(3);
    noNaN(container);
  });

  it("draws a finite threshold as one dashed rule, and none otherwise", () => {
    const at = render(<Histogram label="h" counts={[1, 2, 3, 4]} domain={[0, 4]} threshold={1} />).container;
    const rule = at.querySelector("line[data-threshold]");
    expect(rule?.getAttribute("stroke-dasharray")).toBe("3 2");
    expect(rule?.getAttribute("x1")).toBe(rule?.getAttribute("x2"));
    const none = render(<Histogram label="h" counts={[1, 2]} domain={[0, 2]} threshold={Number.NaN} />).container;
    expect(none.querySelector("line[data-threshold]")).toBeNull();
    noNaN(none);
  });

  it("appends the unit to the x title", () => {
    const { getByText } = render(<Histogram label="h" values={[1, 2]} xLabel="luminance" unit="DN" />);
    expect(getByText("luminance (DN)")).toBeTruthy();
  });

  it("titles the axis with the unit alone when there is no x label", () => {
    const { getByText } = render(<Histogram label="h" values={[1, 2]} unit="px" />);
    expect(getByText("(px)")).toBeTruthy();
  });

  it("highlights the bin under the cursor as its own path, and not a bin outside the domain", () => {
    const counts = [1, 2, 3, 4];
    const inside = render(<Histogram label="h" counts={counts} domain={[0, 4]} cursor={2.5} />);
    expect(inside.container.querySelector("[data-cursor-bin]")?.getAttribute("data-cursor-bin")).toBe("2");
    expect(inside.container.querySelector("path[data-bars]")?.getAttribute("d")?.match(/M/g)).toHaveLength(3);
    inside.unmount();

    for (const cursor of [-1, 99, Number.NaN, null]) {
      const outside = render(<Histogram label="h" counts={counts} domain={[0, 4]} cursor={cursor} />);
      expect(outside.container.querySelector("[data-cursor-bin]")).toBeNull();
      outside.unmount();
    }
  });

  it("draws no highlight on an empty bin", () => {
    const { container } = render(<Histogram label="h" counts={[0, 3]} domain={[0, 2]} cursor={0.5} />);
    expect(container.querySelector("[data-cursor-bin]")).toBeNull();
  });

  it("renders empty input, all-zero counts and a single value without NaN", () => {
    for (const props of [
      { values: [] },
      { values: [Number.NaN, Infinity] },
      { values: [3, 3, 3] },
      { counts: [0, 0, 0], domain: [0, 1] as [number, number] },
      { counts: [], domain: [0, 1] as [number, number] },
      { counts: [1, 2], domain: [5, 5] as [number, number] },
    ]) {
      for (const logY of [false, true]) {
        const { container, unmount } = render(<Histogram label="h" logY={logY} cursor={0.5} {...props} />);
        expect(container.querySelector("svg")).toBeTruthy();
        noNaN(container);
        unmount();
      }
    }
  });

  it("keeps a bin of one visible on a log axis", () => {
    const { container } = render(<Histogram label="h" counts={[1, 1000]} domain={[0, 2]} logY />);
    const d = container.querySelector("path[data-bars]")?.getAttribute("d") ?? "";
    const first = /^M[\d.]+ [\d.]+V([\d.]+)/.exec(d);
    expect(Number(first?.[1])).toBeLessThan(Number(/^M[\d.]+ ([\d.]+)V/.exec(d)?.[1]));
  });

  it("adds the pointer layer only when asked to", () => {
    const plain = render(<Histogram label="h" values={[1, 2]} />);
    expect(plain.container.querySelector("[data-plot-target]")).toBeNull();
    plain.unmount();
    const live = render(<Histogram label="h" values={[1, 2]} onPick={() => undefined} />);
    expect(live.container.querySelector("[data-plot-target]")).toBeTruthy();
  });
});
