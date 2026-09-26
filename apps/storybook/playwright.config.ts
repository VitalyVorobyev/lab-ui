import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression over every story, in both themes (PLAN §4.3). macOS only: font
 * rasterisation differs by OS, so baselines are only comparable on the OS that made them —
 * CI runs this job on a macOS runner and nowhere else.
 */
export default defineConfig({
  testDir: "visual",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "visual-report" }]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled", caret: "hide" } },
  use: { baseURL: "http://127.0.0.1:6007", ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
  webServer: {
    command: "bun visual/serve.ts",
    url: "http://127.0.0.1:6007/index.json",
    reuseExistingServer: !process.env["CI"],
  },
});
