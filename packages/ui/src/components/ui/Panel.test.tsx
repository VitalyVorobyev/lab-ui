import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it } from "vitest";

import { PageHeader, ReadoutStrip } from "./Panel";

/** Stands in for a router's `<Link>`: an element that renders an anchor from its own props. */
function FakeRouterLink({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a data-router-link href={to} {...rest} />;
}

describe("PageHeader back link", () => {
  it("renders a plain anchor from { href, label }", () => {
    render(<PageHeader title="Run 12" back={{ href: "/runs", label: "Runs" }} />);
    const link = screen.getByRole("link", { name: "← Runs" });
    expect(link.getAttribute("href")).toBe("/runs");
  });

  it("styles the app's own link element and prefixes the arrow", () => {
    render(<PageHeader title="Run 12" back={<FakeRouterLink to="/runs">Runs</FakeRouterLink>} />);
    const link = screen.getByRole("link", { name: "← Runs" });
    expect(link.hasAttribute("data-router-link")).toBe(true);
    expect(link.className).toContain("text-fg-muted");
  });
});

describe("ReadoutStrip links", () => {
  it("renders href items as anchors and link items through the given element", () => {
    render(
      <ReadoutStrip
        items={[
          { label: "run", value: "12", href: "/runs/12" },
          { label: "model", value: "patchcore", link: <FakeRouterLink to="/models/patchcore" /> },
          { value: "plain" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "12" }).getAttribute("href")).toBe("/runs/12");
    const routed = screen.getByRole("link", { name: "patchcore" });
    expect(routed.hasAttribute("data-router-link")).toBe(true);
    expect(routed.getAttribute("href")).toBe("/models/patchcore");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
