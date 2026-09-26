/**
 * Classify a declared dependency spec against the §3 baseline.
 *
 * Deliberately not a semver implementation: the question is only "is what this repo
 * *declares* at the baseline", read from the lower bound of the range, which is what a
 * reader of the `package.json` sees and what an upgrade PR changes.
 */

export interface BaselineEntry {
  version: string;
  exact?: boolean;
  note?: string;
}

export interface Baseline {
  packages: Record<string, BaselineEntry>;
  replaced: Record<string, string>;
  exceptions: Record<string, string>;
}

export type Status =
  | "ok" // lower bound at the baseline's major.minor
  | "patch" // same major.minor, lower patch: not a deviation
  | "behind" // older major or minor
  | "ahead" // newer major or minor than the baseline allows
  | "not-exact" // baseline demands an exact pin
  | "replaced" // the package itself is off the baseline
  | "untracked" // not in the baseline
  | "unparsed"; // file:, workspace:, git, tags — nothing to compare

/** Statuses that count against the "0 deviations" gate. */
export const DEVIATIONS: ReadonlySet<Status> = new Set(["behind", "ahead", "not-exact", "replaced"]);

/** `[major, minor, patch]` of a range's lower bound, or `null` when it has none. */
export function lowerBound(spec: string): [number, number, number] | null {
  const first = spec.split("||")[0]!.trim().split(/\s+/)[0]!;
  const match = /^(?:\^|~|>=|=|v)?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(?:[-+].*)?$/.exec(first);
  if (!match) return null;
  const part = (s: string | undefined) => (s === undefined || s === "x" || s === "*" ? 0 : Number(s));
  return [Number(match[1]), part(match[2]), part(match[3])];
}

/** Whether a spec is a bare version, `1.2.3`, with no range operator. */
export function isExactPin(spec: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(spec.trim());
}

export function classify(name: string, spec: string, baseline: Baseline): Status {
  if (name in baseline.replaced) return "replaced";
  const entry = baseline.packages[name];
  if (!entry) return "untracked";
  const found = lowerBound(spec);
  const want = lowerBound(entry.version);
  if (!found || !want) return "unparsed";
  if (entry.exact) return isExactPin(spec) && spec.trim() === entry.version ? "ok" : "not-exact";
  const [fMaj, fMin, fPatch] = found;
  const [wMaj, wMin, wPatch] = want;
  if (fMaj !== wMaj) return fMaj < wMaj ? "behind" : "ahead";
  if (fMin !== wMin) return fMin < wMin ? "behind" : "ahead";
  return fPatch < wPatch ? "patch" : "ok";
}
