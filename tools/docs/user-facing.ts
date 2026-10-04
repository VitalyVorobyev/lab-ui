/**
 * User-facing text must not use the project's internal vocabulary.
 *
 *     bun test tools/docs
 *
 * Package users read the READMEs, the Storybook site, the CHANGELOGs (written from
 * `.changeset/*.md`), TSDoc in their editor and the npm description. None of them know what
 * "L6-4", "PLAN §2", "ADR-0004" or "G5.1" mean, so those words never appear there. Dev docs
 * (CLAUDE.md, CONTRIBUTING.md, docs/) may use them.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { Glob } from "bun";

/** One kind of internal term, and why a reader would not understand it. */
export interface Rule {
  name: string;
  pattern: RegExp;
}

export const RULES: Rule[] = [
  { name: "plan ticket id", pattern: /\b(?:L\d{1,2}-\d+[a-z]?|U-\d+|P\d-\d+|W-\d)\b/ },
  { name: "plan reference", pattern: /\bPLAN\b|§/ },
  { name: "ADR number", pattern: /\bADR[- ]?\d/ },
  { name: "gate name", pattern: /\bG\d+\.\d+\b/ },
  { name: "issue reference", pattern: /\b[a-z][\w-]*#\d+\b|(?:^|[\s(])#\d{1,4}\b/ },
  {
    name: "internal app",
    pattern:
      /\b(?:VAL|vm-lab|caliperbench|CaliperBench|etendue|calibration-rs|calib-targets-rs|vision-metrology|visual-anomaly-lab|anomaly-lab)\b|\blab apps?\b/,
  },
  {
    name: "process jargon",
    pattern: /ae-undocumented|Definition of Done|\bDoD\b|promotion rule|docs\/(?:measurements|plan|adrs)|visual-language\.md|visual-language §/,
  },
];

/** The files package users read. Globs are relative to the repository root. */
export const USER_FACING: string[] = [".changeset/*.md"];

/** Files a glob above matches but that are not user-facing. */
const NOT_USER_FACING = new Set([".changeset/README.md"]);

/** A line of user-facing text that uses an internal term. */
export interface Finding {
  file: string;
  line: number;
  rule: string;
  text: string;
}

/** Every internal term in `text`, with its 1-based line number. */
export function scanText(text: string): { line: number; rule: string; text: string }[] {
  const found: { line: number; rule: string; text: string }[] = [];
  text.split("\n").forEach((content, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(content)) found.push({ line: index + 1, rule: rule.name, text: content.trim() });
    }
  });
  return found;
}

/** Scan every user-facing file under `root`. */
export function scan(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const pattern of USER_FACING) {
    for (const path of new Glob(pattern).scanSync({ cwd: root, dot: true })) {
      const file = relative(root, join(root, path));
      if (NOT_USER_FACING.has(file)) continue;
      for (const hit of scanText(readFileSync(join(root, file), "utf8"))) findings.push({ file, ...hit });
    }
  }
  return findings;
}
