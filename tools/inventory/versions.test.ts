import { describe, expect, it } from "bun:test";

import { classify, isExactPin, lowerBound, type Baseline } from "./versions";

const baseline: Baseline = {
  packages: {
    react: { version: "19.3.0" },
    typescript: { version: "6.0.3" },
    three: { version: "0.186.1", exact: true },
  },
  replaced: { "react-router-dom": "react-router" },
  exceptions: {},
};

describe("lowerBound", () => {
  it.each([
    ["^19.2.8", [19, 2, 8]],
    ["~6.0.3", [6, 0, 3]],
    ["6.0.3", [6, 0, 3]],
    ["^7", [7, 0, 0]],
    ["^2", [2, 0, 0]],
    [">=1.2", [1, 2, 0]],
    ["1.x", [1, 0, 0]],
    ["^3.0.0 || ^4.0.0", [3, 0, 0]],
    ["19.0.0-rc.1", [19, 0, 0]],
  ] as const)("%s", (spec, want) => {
    expect(lowerBound(spec)).toEqual([...want]);
  });

  it.each(["file:./pkg", "workspace:*", "latest", "github:a/b", "*"])("%s has none", (spec) => {
    expect(lowerBound(spec)).toBeNull();
  });
});

describe("isExactPin", () => {
  it("accepts bare versions only", () => {
    expect(isExactPin("0.186.1")).toBe(true);
    expect(isExactPin("^0.186.1")).toBe(false);
    expect(isExactPin("~0.186.1")).toBe(false);
  });
});

describe("classify", () => {
  it("reads the lower bound against major.minor", () => {
    expect(classify("react", "^19.3.0", baseline)).toBe("ok");
    expect(classify("react", "^19.3.4", baseline)).toBe("ok");
    expect(classify("react", "^19.2.8", baseline)).toBe("behind");
    expect(classify("typescript", "~5.8.3", baseline)).toBe("behind");
    expect(classify("typescript", "^7", baseline)).toBe("ahead");
    expect(classify("typescript", "6.0.1", baseline)).toBe("patch");
  });

  it("demands the exact pin where the baseline does", () => {
    expect(classify("three", "0.186.1", baseline)).toBe("ok");
    expect(classify("three", "^0.186.1", baseline)).toBe("not-exact");
    expect(classify("three", "0.185.1", baseline)).toBe("not-exact");
  });

  it("flags replaced packages whatever their version", () => {
    expect(classify("react-router-dom", "^7.18.2", baseline)).toBe("replaced");
  });

  it("separates untracked and unparsed specs", () => {
    expect(classify("zustand", "^5", baseline)).toBe("untracked");
    expect(classify("react", "workspace:*", baseline)).toBe("unparsed");
  });
});
