/**
 * One screenshot per story per theme, compared with `maxDiffPixelRatio ≤ 0.001`.
 * Stories come from the built Storybook's own `index.json`, so a new story is covered
 * without touching this file (its baseline is written on the first run).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

interface Entry {
  id: string;
  type: "story" | "docs";
}

const index = JSON.parse(readFileSync(join(import.meta.dirname, "..", "storybook-static", "index.json"), "utf8")) as {
  entries: Record<string, Entry>;
};
const stories = Object.values(index.entries).filter((e) => e.type === "story");

for (const { id } of stories) {
  for (const theme of ["light", "dark"] as const) {
    test(`${id} [${theme}]`, async ({ page }) => {
      await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
      await page.waitForSelector("#storybook-root > *", { state: "attached" });
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${id}--${theme}.png`, { fullPage: true });
    });
  }
}
