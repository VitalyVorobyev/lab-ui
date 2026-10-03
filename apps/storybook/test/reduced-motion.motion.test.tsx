/**
 * `prefers-reduced-motion: reduce` must make motion *synchronous*, not merely short
 * (lab-ui issue #48).
 *
 * This file runs in the `motion` Vitest project, whose Chromium context is started with
 * `reducedMotion: "reduce"`, so the media query in `@vitavision/ui/styles.css` really
 * matches here (the first test asserts that, so a harness regression cannot make the rest
 * pass vacuously).
 */

import "../src/styles.css";

import { Dialog, Tooltip, TooltipProvider } from "@vitavision/ui";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

let host: HTMLElement | null = null;
let root: Root | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

/** Renders `node` and resolves with its first button once React has committed. */
async function mount(node: React.ReactNode): Promise<HTMLButtonElement> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(node);
  const container = host;
  await expect.poll(() => container.querySelector("button")).not.toBeNull();
  return container.querySelector("button") as HTMLButtonElement;
}

describe("prefers-reduced-motion: reduce", () => {
  it("is in effect for the page", () => {
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  });

  it("reads a transitioned property's new value in the same tick", () => {
    // What mermaid does: set a style, measure at once. A transition, however short, leaves
    // the old value in the computed style until the next frame.
    const el = document.createElement("div");
    el.style.cssText = "transition: all 200ms; width: 100px; height: 10px";
    document.body.append(el);
    expect(getComputedStyle(el).width).toBe("100px");

    el.style.width = "300px";
    expect(getComputedStyle(el).width).toBe("300px");
    expect(el.getBoundingClientRect().width).toBe(300);

    el.style.transition = "width 200ms 50ms"; // a delay must not defer it either
    el.style.width = "50px";
    expect(getComputedStyle(el).width).toBe("50px");
    el.remove();
  });

  it("starts no transition at all", () => {
    const el = document.createElement("div");
    el.style.cssText = "transition: opacity 200ms; opacity: 1";
    document.body.append(el);
    void getComputedStyle(el).opacity;
    el.style.opacity = "0";
    expect(el.getAnimations()).toEqual([]);
    el.remove();
  });
});

describe("animations under reduced motion", () => {
  it("still end, and fire animationend, at once", async () => {
    // What Radix `Presence` waits for before unmounting an element with an exit animation.
    const style = document.createElement("style");
    style.textContent = "@keyframes test-fade { from { opacity: 0 } to { opacity: 1 } }";
    document.head.append(style);
    const el = document.createElement("div");
    el.style.animation = "test-fade 5s infinite";
    document.body.append(el);
    const ended = new Promise<string>((resolve) => el.addEventListener("animationend", (e) => resolve(e.animationName), { once: true }));
    await expect(Promise.race([ended, new Promise((r) => setTimeout(() => r("timeout"), 1000))])).resolves.toBe("test-fade");
    expect(getComputedStyle(el).opacity).toBe("1");
    el.remove();
    style.remove();
  });
});

describe("Radix enter/exit under reduced motion", () => {
  beforeAll(() => {
    // The package ships no exit animation of its own, but a consumer may add one
    // (`data-[state=closed]:animate-out`). Radix `Presence` then holds the node until
    // `animationend`, so this rule stands in for that: collapsing the duration must not
    // leave a closing overlay mounted forever.
    const style = document.createElement("style");
    style.textContent = `
      @keyframes test-exit { from { opacity: 1 } to { opacity: 0 } }
      [data-state="closed"] { animation: test-exit 200ms both; }
    `;
    document.head.append(style);
  });

  function StatefulDialog() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Dialog open={open} onOpenChange={setOpen} title="Reduced motion" footer={<button onClick={() => setOpen(false)}>Done</button>} />
      </>
    );
  }

  it("Dialog opens and unmounts", async () => {
    const opener = await mount(<StatefulDialog />);
    opener.click();
    await expect.poll(() => document.querySelector('[role="dialog"]')).not.toBeNull();

    [...document.querySelectorAll("button")].find((b) => b.textContent === "Done")?.click();
    await expect.poll(() => document.querySelector('[role="dialog"]'), { timeout: 1000 }).toBeNull();
  });

  it("Tooltip opens on focus and unmounts on blur", async () => {
    const target = await mount(
      <TooltipProvider>
        <Tooltip content="Explanation">
          <button type="button">Target</button>
        </Tooltip>
      </TooltipProvider>,
    );
    // Radix opens a tooltip on keyboard focus only; a bare .focus() carries no pointer.
    target.focus();
    await expect.poll(() => document.querySelector('[role="tooltip"]')).not.toBeNull();

    target.blur();
    await expect.poll(() => document.querySelector('[role="tooltip"]'), { timeout: 1000 }).toBeNull();
  });
});
