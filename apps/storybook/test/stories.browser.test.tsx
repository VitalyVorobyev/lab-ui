/**
 * Interaction + accessibility, over every story (PLAN §4.3).
 *
 * Each story is rendered and its `play` run; then axe checks the rendered story in the light
 * theme and again in the dark one (the theme is a class on `<html>`, so the second pass
 * needs no re-render). Only `serious` and `critical` findings fail.
 */

import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { cases } from "./stories";

const BLOCKING = new Set(["serious", "critical"]);

async function violations(root: Element, theme: "light" | "dark"): Promise<string[]> {
  document.documentElement.classList.toggle("dark", theme === "dark");
  // Portalled content (dialogs, tooltips, select menus) lives outside the canvas.
  const result = await axe.run(document.body, { resultTypes: ["violations"] });
  void root;
  return result.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map((v) => `[${theme}] ${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`);
}

let mounted: HTMLElement | null = null;

beforeAll(() => {
  // `transition-colors` would otherwise have axe read a colour halfway between the themes.
  const style = document.createElement("style");
  style.textContent = "*, *::before, *::after { transition: none !important; animation: none !important; }";
  document.head.append(style);
});

afterEach(() => {
  mounted?.remove();
  mounted = null;
  document.documentElement.classList.remove("dark");
});

describe("stories — interaction and axe", () => {
  it("found stories", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const { id, Story } of cases) {
    it(id, async () => {
      mounted = document.createElement("div");
      document.body.append(mounted);
      await Story.run({ canvasElement: mounted });
      const found = [...(await violations(mounted, "light")), ...(await violations(mounted, "dark"))];
      expect(found, found.join("\n")).toEqual([]);
    });
  }
});
