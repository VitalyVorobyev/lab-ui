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
    const forms = {
      name: "@vitavision/forms",
      version: "0.6.0",
      dependencies: { "@vitavision/ui": "workspace:^" },
      peerDependencies: { react: "^19.2.0" },
    };
    expect(resolveAll([ui, forms])).toHaveLength(1);
    expect(forms.dependencies["@vitavision/ui"]).toBe("^0.6.0");
    expect(forms.peerDependencies.react).toBe("^19.2.0");
    expect(ui.dependencies.clsx).toBe("^2.1.1");
  });

  test("fails on a workspace range with no such package", () => {
    expect(() => resolveAll([{ name: "a", version: "1.0.0", dependencies: { b: "workspace:^" } }])).toThrow(/no workspace package/);
  });
});
