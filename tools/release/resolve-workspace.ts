/**
 * Replace `workspace:` ranges in the publishable manifests with real versions — run by
 * `bun run release` just before `changeset publish`.
 *
 *     bun tools/release/resolve-workspace.ts
 *
 * Under bun, changesets publishes with plain `npm publish`, which (unlike `bun pm pack` or
 * `pnpm publish`) copies `workspace:^` into the registry manifest verbatim, and no client
 * can install that. This rewrites the manifests in place, the way `bun pm pack` does:
 * `workspace:^` → `^<version>`, `workspace:~` → `~<version>`, `workspace:*` → `<version>`,
 * and any other `workspace:<range>` → `<range>`. Release CI discards the working tree
 * afterwards; run locally, revert with `git checkout packages`.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const FIELDS = ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"] as const;

type Manifest = { name: string; version: string } & Partial<Record<(typeof FIELDS)[number], Record<string, string>>>;

/** The range `npm publish` should carry for `spec`, given the sibling's current version. */
export function resolveRange(spec: string, version: string): string {
  const range = spec.slice("workspace:".length);
  if (range === "^" || range === "~") return `${range}${version}`;
  if (range === "*" || range === "") return version;
  return range;
}

/** Every manifest under packages/ (one level, plus packages/config/*). */
export function manifestPaths(root = ROOT): string[] {
  const dirs = [
    ...readdirSync(join(root, "packages")).map((d) => join(root, "packages", d)),
    ...readdirSync(join(root, "packages", "config")).map((d) => join(root, "packages", "config", d)),
  ];
  return dirs.map((d) => join(d, "package.json")).filter((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  });
}

/** Rewrite `manifests` in memory; returns the names of the fields changed, as `pkg: dep`. */
export function resolveAll(manifests: Manifest[]): string[] {
  const versions = new Map(manifests.map((m) => [m.name, m.version]));
  const changed: string[] = [];
  for (const m of manifests) {
    for (const field of FIELDS) {
      const deps = m[field];
      if (!deps) continue;
      for (const [dep, spec] of Object.entries(deps)) {
        if (!spec.startsWith("workspace:")) continue;
        const version = versions.get(dep);
        if (!version) throw new Error(`${m.name}: ${dep} is ${spec} but no workspace package has that name`);
        deps[dep] = resolveRange(spec, version);
        changed.push(`${m.name}: ${dep} ${spec} → ${deps[dep]}`);
      }
    }
  }
  return changed;
}

if (import.meta.main) {
  const paths = manifestPaths();
  const manifests = paths.map((p) => JSON.parse(readFileSync(p, "utf8")) as Manifest);
  const changed = resolveAll(manifests);
  const touched = new Set(changed.map((c) => c.slice(0, c.indexOf(":"))));
  paths.forEach((p, i) => {
    if (touched.has(manifests[i]!.name)) writeFileSync(p, `${JSON.stringify(manifests[i], null, 2)}\n`);
  });
  for (const c of changed) console.log(c);
  console.log(`resolve-workspace: ${changed.length} range(s) resolved.`);
}
