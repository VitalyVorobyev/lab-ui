import { fireEvent, render, screen } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@vitavision/ui";

import { NavRail, NavRailItem } from "./NavRail";

const ICON = <svg data-testid="icon" />;

describe("NavRail", () => {
  it("keeps the current item from defaultValue when uncontrolled", () => {
    const change = vi.fn();
    render(
      <NavRail defaultValue="b" onValueChange={change}>
        <NavRailItem value="a" label="A" icon={ICON} />
        <NavRailItem value="b" label="B" icon={ICON} />
      </NavRail>,
    );
    const a = screen.getByRole("button", { name: "A" });
    const b = screen.getByRole("button", { name: "B" });
    expect(b.getAttribute("aria-current")).toBe("page");
    expect(b.dataset["state"]).toBe("active");
    expect(a.hasAttribute("aria-current")).toBe(false);
    expect(a.dataset["state"]).toBe("inactive");

    fireEvent.click(a);
    expect(change).toHaveBeenCalledWith("a");
    expect(a.getAttribute("aria-current")).toBe("page");
    expect(b.hasAttribute("aria-current")).toBe(false);

    // The current item again is not a change.
    fireEvent.click(a);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("follows value when controlled, and starts with none current without a default", () => {
    const change = vi.fn();
    const { rerender } = render(
      <NavRail>
        <NavRailItem value="a" label="A" icon={ICON} />
      </NavRail>,
    );
    expect(screen.getByRole("button", { name: "A" }).hasAttribute("aria-current")).toBe(false);

    rerender(
      <NavRail value="a" onValueChange={change}>
        <NavRailItem value="a" label="A" icon={ICON} />
        <NavRailItem value="b" label="B" icon={ICON} />
      </NavRail>,
    );
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(change).toHaveBeenCalledWith("b");
    // Controlled: the rail waits for the new value.
    expect(screen.getByRole("button", { name: "A" }).getAttribute("aria-current")).toBe("page");
  });

  it("renders onto the child with asChild, merging className, onClick and aria-current", () => {
    const change = vi.fn();
    const own = vi.fn();
    render(
      <NavRail value="a" onValueChange={change}>
        <NavRailItem value="a" label="A" icon={ICON} asChild className="item-class">
          <a href="/a" className="link-class" />
        </NavRailItem>
        <NavRailItem value="b" label="B" icon={ICON} asChild>
          <a href="/b" onClick={own}>
            ignored
          </a>
        </NavRailItem>
      </NavRail>,
    );
    const a = screen.getByRole("link", { name: "A" });
    expect(a.getAttribute("href")).toBe("/a");
    expect(a.getAttribute("aria-current")).toBe("page");
    expect(a.dataset["state"]).toBe("active");
    expect(a.classList.contains("item-class")).toBe(true);
    expect(a.classList.contains("link-class")).toBe(true);
    expect(a.classList.contains("rounded-control")).toBe(true);
    expect(a.querySelector('[data-testid="icon"]')?.closest("[aria-hidden]")).not.toBeNull();

    // The child's own content is replaced by the icon and label; its own onClick runs too.
    const b = screen.getByRole("link", { name: "B" });
    expect(b.textContent).toBe("B");
    expect(b.hasAttribute("aria-current")).toBe(false);
    fireEvent.click(b);
    expect(own).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith("b");
  });

  it("does not choose the item when the child's own onClick cancels the event", () => {
    const change = vi.fn();
    render(
      <NavRail onValueChange={change}>
        <NavRailItem value="a" label="A" icon={ICON} asChild>
          <a href="#a" onClick={(event: MouseEvent<HTMLAnchorElement>) => event.preventDefault()} />
        </NavRailItem>
      </NavRail>,
    );
    fireEvent.click(screen.getByRole("link", { name: "A" }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "A" }).hasAttribute("aria-current")).toBe(false);
  });

  it("cancels a disabled link's click and keeps a disabled button out of reach", () => {
    const change = vi.fn();
    render(
      <NavRail onValueChange={change}>
        <NavRailItem value="a" label="A" icon={ICON} disabled />
        <NavRailItem value="b" label="B" icon={ICON} disabled asChild>
          <a href="#b" />
        </NavRailItem>
      </NavRail>,
    );
    const a = screen.getByRole("button", { name: "A" });
    expect(a).toHaveProperty("disabled", true);
    const b = screen.getByRole("link", { name: "B" });
    expect(b.getAttribute("aria-disabled")).toBe("true");
    const click = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    b.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(change).not.toHaveBeenCalled();
  });

  it("names icon-only items by their label, and describes an item by its badge", () => {
    render(
      <TooltipProvider>
        <NavRail labels="tooltip">
          <NavRailItem value="a" label="Library" icon={ICON} badge={7} />
          <NavRailItem value="b" label="Find" icon={ICON} badge={1000} />
          <NavRailItem value="c" label="Gauge" icon={ICON} />
        </NavRail>
      </TooltipProvider>,
    );
    const library = screen.getByRole("button", { name: "Library" });
    expect(library.getAttribute("aria-label")).toBe("Library");
    expect(library.textContent).toBe("7");
    const badge = document.getElementById(library.getAttribute("aria-describedby") ?? "");
    expect(badge?.textContent).toBe("7");
    const find = screen.getByRole("button", { name: "Find" });
    expect(document.getElementById(find.getAttribute("aria-describedby") ?? "")?.textContent).toBe("99+");
    expect(screen.getByRole("button", { name: "Gauge" }).hasAttribute("aria-describedby")).toBe(false);
  });

  it("must be inside a NavRail", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<NavRailItem value="a" label="A" icon={ICON} />)).toThrow(/inside a NavRail/);
    error.mockRestore();
  });
});
