/**
 * Every story renders on the server (PLAN §4.3, F5): `renderToString` in Node with no
 * console error or warning — a hydration mismatch, a missing key and a `window` reference
 * all surface here first.
 */

import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cases } from "./stories";

let logged: string[] = [];

beforeEach(() => {
  logged = [];
  const capture = (level: string) => (...args: unknown[]) => {
    logged.push(`${level}: ${args.map(String).join(" ").slice(0, 300)}`);
  };
  vi.spyOn(console, "error").mockImplementation(capture("error"));
  vi.spyOn(console, "warn").mockImplementation(capture("warn"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stories — server render", () => {
  for (const { id, Story } of cases) {
    it(id, () => {
      const html = renderToString(<Story />);
      expect(html.length).toBeGreaterThan(0);
      expect(logged, logged.join("\n")).toEqual([]);
    });
  }
});
