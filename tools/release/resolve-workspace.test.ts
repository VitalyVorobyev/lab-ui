import { describe, expect, test } from "bun:test";

import { resolveAll, resolveRange } from "./resolve-workspace";

describe("resolveRange", () => {
  test("follows bun pm pack's rules", () => {
    expect(resolveRange("workspace:^", "0.6.0")).toBe("^0.6.0");
    expect(resolveRange("workspace:~", "0.6.0")).toBe("~0.6.0");
    expect(resolveRange("workspace:*", "0.6.0")).toBe("0.6.0");
    expect(resolveRange("workspace:^0.5.0", "0.6.0")).toBe("^0.5.0");
  });
});

describe("resolveAll", () => {
  test("rewrites dependencies and peers, leaves registry ranges alone", () => {
    const ui = { name: "@vitavision/ui", version: "0.6.0", dependencies: { clsx: "^2.1.1" } };
    const compat = {
      name: "@vitavision/lab-ui",
      version: "0.6.0",
      dependencies: { "@vitavision/ui": "workspace:^" },
      peerDependencies: { react: "^19.2.0" },
    };
    expect(resolveAll([ui, compat])).toHaveLength(1);
    expect(compat.dependencies["@vitavision/ui"]).toBe("^0.6.0");
    expect(compat.peerDependencies.react).toBe("^19.2.0");
    expect(ui.dependencies.clsx).toBe("^2.1.1");
  });

  test("fails on a workspace range with no such package", () => {
    expect(() => resolveAll([{ name: "a", version: "1.0.0", dependencies: { b: "workspace:^" } }])).toThrow(/no workspace package/);
  });
});
