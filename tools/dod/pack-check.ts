/**
 * Packaging gates (PLAN §4.4) over every publishable package, on what `npm pack` would ship:
 *
 *     bun tools/dod/pack-check.ts publint   # 0 errors
 *     bun tools/dod/pack-check.ts attw      # 0 problems (ESM-only profile: no CJS entry by design;
 *                                         #   `styles.css` is Tailwind source, not a module)
 *
 * Needs a prior `bun run build`.
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const PACKAGES = ["ui", "forms", "charts", "stage2d", "lab-ui"].map((p) => join(ROOT, "packages", p));
const CONFIGS = readdirSync(join(ROOT, "packages/config")).map((p) => join(ROOT, "packages/config", p));

const tool = process.argv[2];
const commands: Record<string, (dir: string) => string[]> = {
  publint: (dir) => ["publint", "run", dir, "--strict", "--pack", "npm"],
  attw: (dir) => ["attw", "--pack", dir, "--profile", "esm-only", "--exclude-entrypoints", "styles.css", "--format", "table-flipped"],
};
const command = tool ? commands[tool] : undefined;
if (!command) {
  console.error(`usage: pack-check.ts <${Object.keys(commands).join("|")}>`);
  process.exit(2);
}

const targets = tool === "publint" ? [...PACKAGES, ...CONFIGS] : PACKAGES;
let failed = 0;
for (const dir of targets) {
  const [bin, ...args] = command(dir);
  const run = spawnSync("bunx", [bin!, ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } });
  const name = dir.slice(ROOT.length + 1);
  const output = `${run.stdout}${run.stderr}`.trim();
  if (run.status === 0) console.log(`✓ ${name}`);
  else {
    failed++;
    console.log(`✗ ${name}\n${output.replace(/^/gm, "    ")}`);
  }
}
process.exit(failed ? 1 : 0);
