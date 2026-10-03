import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("@vitavision/config-vitest/dom", () => {
  it("loads no browser provider, so a happy-dom-only app needs no Playwright", () => {
    const source = readFileSync(new URL("./dom.js", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+"@vitest\/browser-playwright"/);
  });

  it("is the same dom() the package root exports", async () => {
    const root = await import("./index.js");
    const entry = await import("./dom.js");
    expect(root.dom).toBe(entry.dom);
    const config = entry.dom({ test: { include: ["x"] } });
    expect(config.test.environment).toBe("happy-dom");
    expect(config.test.include).toContain("x");
  });
});
