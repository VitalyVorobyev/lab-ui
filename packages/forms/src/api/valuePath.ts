/**
 * Reading and writing a JSON value by dot path, without mutating it.
 *
 * A form edits one leaf of a value it does not own: the caller holds the value, the form
 * reports the next one. So an edit must produce a new root that shares every untouched
 * subtree with the old one (cheap to compare, safe to hold in state) and must leave the old
 * root exactly as it was.
 *
 * A path is dot-separated keys, with array indices as numbers: `solver.max_iters`,
 * `cameras.0.id`. A key that itself contains a dot cannot be addressed; the Rust and
 * Python configs these forms are for do not have them.
 */

const INDEX = /^(0|[1-9]\d*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Split a dot path into its segments.
 *
 * @param path - `a.b.0`, or `""` for the root.
 * @returns `["a", "b", "0"]`, or `[]` for the root.
 */
export function splitPath(path: string): string[] {
  return path === "" ? [] : path.split(".");
}

/**
 * Join a parent path and a key.
 *
 * @param parent - A dot path; `""` is the root.
 * @param key - A property key or an array index.
 * @returns The child's path.
 */
export function joinPath(parent: string, key: string): string {
  return parent === "" ? key : `${parent}.${key}`;
}

/**
 * Read the value at a path.
 *
 * @param value - The root value.
 * @param path - Dot path; `""` is the root itself.
 * @returns What is there, or `undefined` where any step of the path is missing.
 */
export function getAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of splitPath(path)) {
    if (Array.isArray(current)) {
      current = INDEX.test(segment) ? (current as unknown[])[Number(segment)] : undefined;
    } else if (isRecord(current) && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function setIn(value: unknown, segments: readonly string[], depth: number, next: unknown): unknown {
  const segment = segments[depth];
  if (segment === undefined) return next;

  const isIndex = INDEX.test(segment);
  if (Array.isArray(value) || (!isRecord(value) && isIndex)) {
    if (!isIndex) return value;
    const list = Array.isArray(value) ? (value as unknown[]) : [];
    const index = Number(segment);
    const updated = setIn(list[index], segments, depth + 1, next);
    if (updated === undefined) {
      // Removing an element; setting a hole is not JSON.
      return index < list.length ? list.filter((_, i) => i !== index) : value;
    }
    if (Object.is(updated, list[index])) return value;
    const copy = list.slice();
    copy[index] = updated;
    return copy;
  }

  const record = isRecord(value) ? value : {};
  const has = Object.hasOwn(record, segment);
  const updated = setIn(has ? record[segment] : undefined, segments, depth + 1, next);
  if (updated === undefined) {
    if (!has) return value;
    const copy = { ...record };
    delete copy[segment];
    return copy;
  }
  if (has && Object.is(updated, record[segment])) return value;
  return { ...record, [segment]: updated };
}

/**
 * Write a value at a path, immutably.
 *
 * Every subtree off the path is shared with the input, the input is never touched, and
 * setting what is already there returns the input itself. Containers that do not exist are
 * created (an array before an index, an object before a key). Keys the path does not
 * mention — including ones a schema does not know about — are kept.
 *
 * @param value - The root value.
 * @param path - Dot path; `""` replaces the root.
 * @param next - The new value. `undefined` removes the key (or array element) instead.
 * @returns The new root.
 */
export function setAtPath(value: unknown, path: string, next: unknown): unknown {
  return setIn(value, splitPath(path), 0, next);
}
