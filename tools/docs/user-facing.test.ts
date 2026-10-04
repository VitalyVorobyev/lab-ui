import { dirname, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { scan, scanText } from "./user-facing";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../..");

describe("scanText", () => {
  test("finds the internal vocabulary", () => {
    const rules = (text: string) => scanText(text).map((f) => f.rule);
    expect(rules("Done in L6-4, see U-5")).toEqual(["plan ticket id"]);
    expect(rules("the PLAN §2 rules")).toEqual(["plan reference"]);
    expect(rules("batched by appearance (ADR-0004)")).toEqual(["ADR number"]);
    expect(rules("gate G5.1 holds")).toEqual(["gate name"]);
    expect(rules("fixes lab-ui#88")).toEqual(["issue reference"]);
    expect(rules("closes (#58)")).toEqual(["issue reference"]);
    expect(rules("found migrating VAL")).toEqual(["internal app"]);
    expect(rules("0 `ae-undocumented`")).toEqual(["process jargon"]);
  });

  test("leaves ordinary text alone", () => {
    expect(scanText("A CSS colour such as `#f2f2f2` or `#235159`, at 1.5 px.")).toEqual([]);
    expect(scanText("`AreaSet` takes `fillRule`; Level 2 is fine, and so is A4 paper.")).toEqual([]);
    expect(scanText("# Heading\n\n- a list")).toEqual([]);
  });

  test("reports 1-based line numbers", () => {
    expect(scanText("fine\nsee PLAN")).toEqual([{ line: 2, rule: "plan reference", text: "see PLAN" }]);
  });
});

test("user-facing text uses no internal terms", () => {
  const findings = scan(ROOT).map((f) => `${f.file}:${f.line} (${f.rule}) ${f.text}`);
  expect(findings).toEqual([]);
});
