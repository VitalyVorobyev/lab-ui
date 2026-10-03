/**
 * The pre-release check (PLAN L1-6): what a consumer gets from `npm install`, exercised
 * outside the workspace.
 *
 *     bun run build && bun tools/dod/consumer.ts
 *
 * Packs every publishable package, installs the tarballs into a fresh app in a temp
 * directory (so nothing resolves back into the workspace), then
 *   1. server-renders a component from each package;
 *   2. builds the app with Vite + Tailwind v4 from `@import "@vitavision/*\/styles.css"`
 *      alone — no `@source` of its own — and checks the packages' classes were generated.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const PACKAGES = ["ui", "forms", "charts", "stage2d", "workbench", "three", "three-react"];
const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { devDependencies: Record<string, string> };
// The 3D peers at the versions the 3D packages are built and tested against (ADR-0002 pins three exactly).
const threeReact = JSON.parse(readFileSync(join(ROOT, "packages/three-react/package.json"), "utf8")) as {
  devDependencies: Record<string, string>;
};

function run(cmd: string, args: string[], cwd: string): string {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}:\n${result.stdout}${result.stderr}`);
  return result.stdout;
}

const dir = mkdtempSync(join(tmpdir(), "vv-consumer-"));
try {
  const tgz = join(dir, "tgz");
  mkdirSync(tgz);
  const tarball: Record<string, string> = {};
  for (const p of PACKAGES) {
    run("bun", ["pm", "pack", "--destination", tgz, "--quiet"], join(ROOT, "packages", p));
    const file = readdirSync(tgz).find((f) => f.startsWith(`vitavision-${p}-`) && !Object.values(tarball).includes(join(tgz, f)));
    if (!file) throw new Error(`no tarball for ${p}`);
    tarball[`@vitavision/${p}`] = `file:${join(tgz, file)}`;
  }

  const app = join(dir, "app");
  mkdirSync(join(app, "src"), { recursive: true });
  const v = (name: string) => root.devDependencies[name] ?? "latest";
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify({
      name: "consumer",
      private: true,
      type: "module",
      dependencies: {
        ...tarball,
        react: v("react"),
        "react-dom": v("react-dom"),
        three: threeReact.devDependencies["three"],
        "@react-three/fiber": threeReact.devDependencies["@react-three/fiber"],
      },
      overrides: tarball,
      devDependencies: { vite: v("vite"), "@vitejs/plugin-react": v("@vitejs/plugin-react"), tailwindcss: "4.3.3", "@tailwindcss/vite": "4.3.3" },
    }),
  );
  run("bun", ["install"], app);

  // 1. Server render, one component per package.
  writeFileSync(
    join(app, "ssr.tsx"),
    `import { renderToString } from "react-dom/server";
import { Button, NumberInput, Panel, TooltipProvider, VectorInput } from "@vitavision/ui";
import { SchemaForm, describeFields } from "@vitavision/forms";
import { LineChart } from "@vitavision/charts";
import { MeasureOverlay } from "@vitavision/stage2d";
import { PlaybackBar, SplitPane, createPlayhead } from "@vitavision/workbench";
import { FrameTreeRuntime, GIZMO_LAYER, normalizeColor } from "@vitavision/three";
const I = { rotation: [0, 0, 0, 1], translation: [0, 0, 0] };
const runtime = new FrameTreeRuntime({ dt: 0.1, frames: ["world", "cam"], samples: [{ t: 0, world_se3_frame: [I, I] }] });
if (runtime.frame("cam")?.name !== "cam") throw new Error("three: frame tree failed");
// Server-safe: with no document the colour normaliser passes values through.
if (GIZMO_LAYER !== 1 || normalizeColor(" teal ") !== "teal") throw new Error("three: layers/theme failed");
const fields = describeFields({ properties: { sigma: { type: "number", default: 2 } } });
const html = renderToString(
  <TooltipProvider>
    <Panel title="p"><Button variant="primary">Go</Button></Panel>
    <NumberInput aria-label="f" unit="mm" defaultValue={16} />
    <VectorInput aria-label="t" value={[0, 1, 2]} unit="m" />
    <SchemaForm fields={fields} values={{}} onChange={() => {}} />
    <LineChart series={[{ label: "a", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }]} label="c" />
    <svg><MeasureOverlay nativeWidth={10} nativeHeight={10} primitives={[]} strokeScale={1} /></svg>
    <SplitPane><div>a</div><PlaybackBar playhead={createPlayhead(10, 0.1)} playing={false} onPlayingChange={() => {}} /></SplitPane>
  </TooltipProvider>,
);
if (!html.includes("Go") || !html.includes("data-unit") || !html.includes('role="separator"')) throw new Error("render failed");
console.log("ssr ok", html.length);
`,
  );
  console.log(run("bun", ["ssr.tsx"], app).trim());

  // 2. Tailwind finds the packages' classes from their stylesheets alone.
  writeFileSync(join(app, "index.html"), `<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>`);
  writeFileSync(
    join(app, "src", "styles.css"),
    `@import "tailwindcss";\n@import "@vitavision/ui/fonts.css";\n@import "@vitavision/ui/styles.css";\n@import "@vitavision/forms/styles.css";\n@import "@vitavision/charts/styles.css";\n@import "@vitavision/stage2d/styles.css";\n@import "@vitavision/workbench/styles.css";\n`,
  );
  // `three-react` is checked here, in the bundler, not in the Bun server render above:
  // @react-three/fiber 9 ships no `exports` map, so Bun's runtime takes its CommonJS build,
  // whose `require("three")` Bun cannot load (three's CJS entry re-requires its ESM build).
  // Its stories' server render runs in the Storybook harness (Vitest, Node).
  writeFileSync(
    join(app, "src", "main.tsx"),
    `import "./styles.css";\nimport { Button } from "@vitavision/ui";\nimport { SceneCanvas, SceneColorsProvider, SensorImage } from "@vitavision/three-react";\nexport const b = [Button, SceneCanvas, SceneColorsProvider, SensorImage];\n`,
  );
  writeFileSync(
    join(app, "vite.config.js"),
    `import tailwindcss from "@tailwindcss/vite"; import react from "@vitejs/plugin-react"; export default { plugins: [react(), tailwindcss()] };`,
  );
  run("bunx", ["vite", "build", "--logLevel", "error"], app);
  const css = readdirSync(join(app, "dist", "assets")).find((f) => f.endsWith(".css"))!;
  const text = readFileSync(join(app, "dist", "assets", css), "utf8");
  // `.h-dvh` and `.cursor-col-resize` occur only in workbench (AppShell, SplitPane).
  for (const cls of [".rounded-control", ".bg-signal", ".text-fg-muted", ".h-dvh", ".cursor-col-resize"]) {
    if (!text.includes(cls)) throw new Error(`generated CSS lacks ${cls}: a package's @source is not reaching Tailwind`);
  }
  // 3. The fonts resolve from the packed package: the build emits the woff2 files.
  const fonts = readdirSync(join(app, "dist", "assets")).filter((f) => f.endsWith(".woff2"));
  if (!fonts.some((f) => f.startsWith("IBMPlexMono-Regular-Latin1")) || !fonts.some((f) => f.startsWith("ibm-plex-sans-latin-wght"))) {
    throw new Error(`fonts.css did not resolve its files: ${fonts.join(", ") || "none"}`);
  }
  console.log(`css ok (${text.length} bytes), ${fonts.length} font files`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
