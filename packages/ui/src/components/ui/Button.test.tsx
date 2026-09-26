import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it } from "vitest";

import { Button, ButtonLink, buttonClasses } from "./Button";
import { DensityProvider } from "./Density";

/** Stands in for a router's `<Link>`: an element that renders an anchor from its own props. */
function FakeRouterLink({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a data-router-link href={to} {...rest} />;
}

describe("ButtonLink", () => {
  it("is one anchor, with no button inside it", () => {
    const { container } = render(
      <ButtonLink href="/experiments/new" variant="primary" icon={<svg data-testid="icon" />}>
        New experiment
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "New experiment" });
    expect(link.getAttribute("href")).toBe("/experiments/new");
    expect(container.querySelector("button")).toBeNull();
    expect(link.querySelector("[data-testid=icon]")).not.toBeNull();
  });

  it("looks exactly like the button of the same variant and density", () => {
    render(
      <DensityProvider value="compact">
        <Button variant="primary">Go</Button>
        <ButtonLink href="/" variant="primary">
          Go
        </ButtonLink>
      </DensityProvider>,
    );
    expect(screen.getByRole("link").className).toBe(screen.getByRole("button").className);
    expect(screen.getByRole("link").className).toBe(
      buttonClasses({ variant: "primary", size: "sm" }),
    );
  });

  it("renders onto a router's link with asChild, keeping the link's own props", () => {
    const { container } = render(
      <ButtonLink asChild variant="primary" icon={<svg data-testid="icon" />}>
        <FakeRouterLink to="/runs">Runs</FakeRouterLink>
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Runs" });
    expect(link.hasAttribute("data-router-link")).toBe(true);
    expect(link.getAttribute("href")).toBe("/runs");
    expect(link.className).toBe(buttonClasses({ variant: "primary", size: "md" }));
    expect(link.querySelector("[data-testid=icon]")).not.toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });
});

describe("Button asChild", () => {
  it("styles the child instead of rendering a button", () => {
    const { container } = render(
      <Button asChild variant="ghost" className="w-full">
        <FakeRouterLink to="/settings">Settings</FakeRouterLink>
      </Button>,
    );
    expect(container.querySelector("button")).toBeNull();
    const link = screen.getByRole("link", { name: "Settings" });
    expect(link.className).toBe(buttonClasses({ variant: "ghost", size: "md", className: "w-full" }));
  });
});
