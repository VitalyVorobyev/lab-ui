/**
 * Where one JSON value differs from another, by dot path: what a form marks as "changed from
 * the baseline".
 *
 * Paths are the ones `getAtPath` reads. A value and its baseline are compared structurally:
 * objects by key (a key missing on one side differs from a key present on the other, even
 * if the present value is `null`), arrays by index when they have the same length, and by
 * the array as a whole when they do not (its elements have no shared identity to match).
 */

import { joinPath } from "./valuePath";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The paths at which `current` differs from `baseline`, deepest first-found, in key order.
 *
 * @param current - The value.
 * @param baseline - What it is compared with.
 * @param path - The path of both, for a recursive call; `""` is the root.
 * @returns Each differing path once; `[""]` when the roots are different kinds of value.
 *   Empty when the values are equal.
 */
export function diffPaths(current: unknown, baseline: unknown, path = ""): string[] {
  if (Object.is(current, baseline)) return [];
  if (isRecord(current) && isRecord(baseline)) {
    const keys = [...new Set([...Object.keys(current), ...Object.keys(baseline)])];
    return keys.flatMap((key) => {
      const inCurrent = Object.hasOwn(current, key);
      const inBaseline = Object.hasOwn(baseline, key);
      const child = joinPath(path, key);
      return inCurrent && inBaseline ? diffPaths(current[key], baseline[key], child) : [child];
    });
  }
  if (Array.isArray(current) && Array.isArray(baseline) && current.length === baseline.length) {
    return current.flatMap((entry, index) => diffPaths(entry, baseline[index], joinPath(path, String(index))));
  }
  return [path];
}

/**
 * How many differing leaves lie at or under each path.
 *
 * @param paths - From `diffPaths`.
 * @returns A map from a path, and each of its ancestors (the root as `""`), to the count of
 *   differing paths at or beneath it.
 */
export function changeCounts(paths: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const path of paths) {
    let at = path;
    for (;;) {
      counts.set(at, (counts.get(at) ?? 0) + 1);
      if (at === "") break;
      const cut = at.lastIndexOf(".");
      at = cut < 0 ? "" : at.slice(0, cut);
    }
  }
  return counts;
}

/**
 * A value as the "was ..." note shows it: short, one line.
 *
 * @param value - The baseline's value at a field.
 * @param limit - The longest text, in characters; a longer one is cut with an ellipsis. Defaults to 40.
 * @returns `unset` for `undefined`, `none` for `null`, `""` quoted, else the value or its JSON.
 */
export function describeValue(value: unknown, limit = 40): string {
  let text: string;
  if (value === undefined) text = "unset";
  else if (value === null) text = "none";
  else if (typeof value === "string") text = value === "" ? '""' : value;
  else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") text = value.toString();
  else text = JSON.stringify(value) ?? "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
