import { describe, expect, it } from "vitest";

import { firstParagraph } from "./firstParagraph";

describe("firstParagraph", () => {
  it("says nothing for no description", () => {
    expect(firstParagraph(undefined)).toBe("");
    expect(firstParagraph(null)).toBe("");
    expect(firstParagraph("")).toBe("");
  });

  it("takes the first paragraph and joins its lines", () => {
    expect(firstParagraph("Number of iterations\nfor the fit.\n\n# Example\n\n```\ncode\n```")).toBe(
      "Number of iterations for the fit.",
    );
  });

  it("strips inline code, emphasis and links but keeps their text", () => {
    expect(firstParagraph("Use `k3` **only** for *wide* lenses, see [the paper](https://x.org/p) or <https://y.org>.")).toBe(
      "Use k3 only for wide lenses, see the paper or https://y.org.",
    );
    expect(firstParagraph("__bold__ and _italic_ text")).toBe("bold and italic text");
  });

  it("unwraps a Rustdoc intra-doc link", () => {
    expect(firstParagraph("Defaults to [`DistortionFixMask::radial_only`] (k1, k2 free).")).toBe(
      "Defaults to DistortionFixMask::radial_only (k1, k2 free).",
    );
  });

  it("unescapes Markdown escapes", () => {
    expect(firstParagraph("Indices to fix (e.g., \\[0\\] to fix the first).")).toBe("Indices to fix (e.g., [0] to fix the first).");
  });

  it("leaves snake_case and a product alone", () => {
    expect(firstParagraph("Sets reference_camera_idx to 2 * 3.")).toBe("Sets reference_camera_idx to 2 * 3.");
    expect(firstParagraph("The _unresolved field.")).toBe("The _unresolved field.");
  });
});
