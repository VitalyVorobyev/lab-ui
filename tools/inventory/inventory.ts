/**
 * The shared reader for `concepts.toml`: the repo list is the one place the inventory
 * scripts (`matrix.ts`, `deps.ts`) learn where each frontend lives.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Repo {
  label?: string;
  root: string;
  frontend: string;
  github: string;
  in_plan: boolean;
  /** `package.json` files to read, relative to `frontend`. Defaults to `["package.json"]`. */
  manifests?: string[];
}

export interface Concept {
  label: string;
  layer: string;
  impl?: Record<string, string[]>;
  uses?: Record<string, string>;
  note?: Record<string, string>;
}

export interface Inventory {
  repos: Record<string, Repo>;
  concepts: Record<string, Concept>;
}

const HERE = dirname(new URL(import.meta.url).pathname);

export function loadInventory(path = join(HERE, "concepts.toml")): Inventory {
  return Bun.TOML.parse(readFileSync(path, "utf8")) as Inventory;
}

export function labelOf(inventory: Inventory, id: string): string {
  return inventory.repos[id]?.label ?? id;
}

/** Short commit SHA of a checkout, suffixed `+dirty` when the tree has local changes. */
export function gitSha(root: string): string {
  const sha = spawnSync("git", ["-C", root, "rev-parse", "--short=10", "HEAD"], { encoding: "utf8" });
  if (sha.status !== 0) return "not a git checkout";
  const dirty = spawnSync("git", ["-C", root, "status", "--porcelain", "--untracked-files=no"], {
    encoding: "utf8",
  });
  return sha.stdout.trim() + (dirty.stdout.trim() ? "+dirty" : "");
}
