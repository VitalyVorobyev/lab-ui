/**
 * `SegmentedControl` and `ToggleChip` at `size="md"` are exactly as tall as the
 * comfortable-density `Input` and `Button` beside them, and `sm` is the toolbar size they
 * have always had.
 *
 * Heights only exist with the real Tailwind CSS, which the package-level story tests do not
 * load, so they are measured here (the `browser` project), not in the stories' `play`.
 */

import "../src/styles.css";

import { Button, Input, SegmentedControl, ToggleChip } from "@vitavision/ui";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

let host: HTMLElement | null = null;
let root: Root | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

/** Renders `node` and resolves with the host once React has committed. */
async function mount(node: React.ReactNode): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(node);
  const container = host;
  await expect.poll(() => container.firstElementChild).not.toBeNull();
  return container;
}

/** The outer height, in CSS pixels, of the one element matching `selector`. */
function heightOf(container: HTMLElement, selector: string): number {
  const el = container.querySelector(selector);
  if (el === null) throw new Error(`no element matches ${selector}`);
  return el.getBoundingClientRect().height;
}

const OPTIONS = [
  { value: "small", label: "Small" },
  { value: "large", label: "Large" },
];

describe("SegmentedControl size", () => {
  it("md is 32px, the height of a comfortable Input and Button", async () => {
    const c = await mount(
      <div className="flex items-center gap-2">
        <SegmentedControl value="small" options={OPTIONS} onValueChange={() => {}} size="md" aria-label="Size" />
        <Input aria-label="Name" />
        <Button size="md">Apply</Button>
      </div>,
    );
    expect(heightOf(c, "[role=radiogroup]")).toBe(32);
    expect(heightOf(c, "input:not([type=radio])")).toBe(32);
    expect(heightOf(c, "button")).toBe(32);
    // Every segment fills the strip's content box: 32 - 2px border - 4px padding.
    expect(heightOf(c, "label")).toBe(26);
  });

  it("sm, and no size at all, keep the toolbar height", async () => {
    const c = await mount(
      <div className="flex flex-col items-start gap-2">
        <div data-case="omitted">
          <SegmentedControl value="small" options={OPTIONS} onValueChange={() => {}} aria-label="Size" />
        </div>
        <div data-case="sm">
          <SegmentedControl value="small" options={OPTIONS} onValueChange={() => {}} size="sm" aria-label="Size" />
        </div>
      </div>,
    );
    expect(heightOf(c, "[data-case=omitted] [role=radiogroup]")).toBe(30);
    expect(heightOf(c, "[data-case=sm] [role=radiogroup]")).toBe(30);
  });
});

describe("ToggleChip size", () => {
  it("md is 32px, the height of a comfortable Input and Button", async () => {
    const c = await mount(
      <div className="flex items-center gap-2">
        <ToggleChip checked onCheckedChange={() => {}} swatch="#f59e0b" size="md">
          Caliper boxes
        </ToggleChip>
        <Input aria-label="Name" />
        <Button size="md">Apply</Button>
      </div>,
    );
    expect(heightOf(c, "[role=switch]")).toBe(32);
    expect(heightOf(c, "input")).toBe(32);
    expect(heightOf(c, "button:not([role=switch])")).toBe(32);
  });

  it("sm, and no size at all, keep the toolbar height", async () => {
    const c = await mount(
      <div className="flex flex-col items-start gap-2">
        <div data-case="omitted">
          <ToggleChip checked onCheckedChange={() => {}} swatch="#f59e0b">
            Caliper boxes
          </ToggleChip>
        </div>
        <div data-case="sm">
          <ToggleChip checked onCheckedChange={() => {}} swatch="#f59e0b" size="sm">
            Caliper boxes
          </ToggleChip>
        </div>
      </div>,
    );
    expect(heightOf(c, "[data-case=omitted] [role=switch]")).toBe(26);
    expect(heightOf(c, "[data-case=sm] [role=switch]")).toBe(26);
  });
});
