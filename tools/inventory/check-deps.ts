/**
 * Enforce the layering rules of PLAN §2 over `packages/*` — run in CI.
 *
 *     bun tools/inventory/check-deps.ts
 *
 * Checked, per publishable package:
 *   - runtime `dependencies` come from that layer's allow-list;
 *   - `react` / `react-dom` are peers, never dependencies, and no package peers or depends
 *     on a router;
 *   - every bare import in `src/` is a declared dependency or peer (so nothing works only
 *     because a sibling happened to hoist it), and `src/` never imports a router;
 *   - the manifest is ESM-only, ships `exports` with `types`, and limits `sideEffects` to CSS.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const PACKAGES = join(ROOT, "packages");

const RADIX = /^@radix-ui\//;
const UI_DEPS = [RADIX, "clsx", "tailwind-merge", "lucide-react"];

/** What each layer may depend on at runtime. A string matches exactly; a RegExp by pattern. */
const ALLOWED: Record<string, (string | RegExp)[]> = {
  "@vitavision/ui": UI_DEPS,
  "@vitavision/forms": ["@vitavision/ui"],
  "@vitavision/charts": ["@vitavision/ui"],
  // lucide-react for the toolbar's icons: already in `ui`'s set, so no new third party.
  "@vitavision/stage2d": ["@vitavision/ui", "lucide-react"],
  "@vitavision/lab-ui": ["@vitavision/ui", "@vitavision/forms", "@vitavision/charts", "@vitavision/stage2d"],
};

const ROUTERS = ["react-router", "react-router-dom", "@tanstack/react-router", "wouter"];
const MOTION = ["motion", "framer-motion"];

/**
 * Temporary exceptions, each with the ticket that removes it. An entry here that no longer
 * matches anything is itself an error, so the list cannot outlive its reasons.
 */
const TEMPORARY: { pkg: string; rule: string; until: string }[] = [
  { pkg: "@vitavision/ui", rule: "router:react-router", until: "L1-3 (router decoupling)" },
  { pkg: "@vitavision/lab-ui", rule: "router:react-router", until: "L1-3 (router decoupling)" },
];

interface Manifest {
  name: string;
  private?: boolean;
  type?: string;
  sideEffects?: boolean | string[];
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|stories)\.tsx?$/.test(entry)) yield path;
  }
}

/** The package name of a bare import specifier, or null for a relative one. */
function packageOf(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!;
}

const matches = (name: string, list: (string | RegExp)[]) =>
  list.some((rule) => (typeof rule === "string" ? rule === name : rule.test(name)));

export function check(): string[] {
  const problems: { pkg: string; rule: string; message: string }[] = [];
  const report = (pkg: string, rule: string, message: string) => problems.push({ pkg, rule, message });

  for (const dir of readdirSync(PACKAGES)) {
    const manifestPath = join(PACKAGES, dir, "package.json");
    let manifest: Manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    } catch {
      continue; // `packages/config` is a directory of packages, not one
    }
    const name = manifest.name;
    const allowed = ALLOWED[name];
    if (!allowed) {
      report(name, "unknown", `no layering rule for ${name}: add it to ALLOWED in check-deps.ts`);
      continue;
    }
    const deps = Object.keys(manifest.dependencies ?? {});
    const peers = Object.keys(manifest.peerDependencies ?? {});

    for (const dep of deps) {
      if (dep === "react" || dep === "react-dom") report(name, "react-peer", `${dep} must be a peer dependency`);
      else if (ROUTERS.includes(dep)) report(name, `router:${dep}`, `depends on router ${dep}`);
      else if (MOTION.includes(dep)) report(name, `motion:${dep}`, `depends on motion library ${dep}`);
      else if (!matches(dep, allowed)) report(name, `layer:${dep}`, `dependency ${dep} is outside this layer's allow-list`);
    }
    for (const peer of peers) {
      if (ROUTERS.includes(peer)) report(name, `router:${peer}`, `peers on router ${peer}`);
    }
    for (const needed of ["react", "react-dom"]) {
      if (!peers.includes(needed)) report(name, "react-peer", `${needed} must be declared as a peer`);
    }

    if (manifest.type !== "module") report(name, "esm", `"type" must be "module"`);
    const root = manifest.exports?.["."] as Record<string, string> | undefined;
    if (!root?.types || !root.import) report(name, "exports", `exports["."] needs "types" and "import"`);
    const sideEffects = manifest.sideEffects;
    if (!Array.isArray(sideEffects) || sideEffects.some((s) => !s.endsWith(".css")))
      report(name, "side-effects", `"sideEffects" must list CSS files only`);

    const declared = new Set([...deps, ...peers]);
    for (const file of sourceFiles(join(PACKAGES, dir, "src"))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/g)) {
        const pkg = packageOf(m[1]!);
        if (!pkg) continue;
        const where = file.slice(ROOT.length + 1);
        if (ROUTERS.includes(pkg)) report(name, `router:${pkg}`, `${where} imports ${pkg}`);
        else if (!declared.has(pkg)) report(name, `undeclared:${pkg}`, `${where} imports undeclared ${pkg}`);
      }
      if (/^(?:const|let|var)\s+\w+\s*=\s*(?:window|document)\b/m.test(text))
        report(name, "module-scope-dom", `${file.slice(ROOT.length + 1)} touches window/document at module scope`);
    }
  }

  const out: string[] = [];
  const used = new Set<string>();
  for (const p of problems) {
    const waived = TEMPORARY.find((t) => t.pkg === p.pkg && t.rule === p.rule);
    if (waived) used.add(`${waived.pkg} ${waived.rule}`);
    else out.push(`${p.pkg}: ${p.message}`);
  }
  for (const t of TEMPORARY) {
    if (!used.has(`${t.pkg} ${t.rule}`)) out.push(`stale temporary exception: ${t.pkg} ${t.rule} (was until ${t.until})`);
  }
  return out;
}

if (import.meta.main) {
  const problems = check();
  if (problems.length) {
    console.error(`check-deps: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log("check-deps: every package keeps to its layer.");
}
