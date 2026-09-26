/**
 * Density is a contract with existing consumers as much as a feature: the default must not
 * move, or every screen in every app reflows on upgrade.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";
import { DensityProvider, byDensity } from "./Density";
import { Panel, Section } from "./Panel";
import { Table } from "./Table";

describe("density", () => {
  it("leaves an unwrapped tree exactly as it was", () => {
    const { container } = render(
      <Panel title="Teach">
        <Button>Build</Button>
      </Panel>,
    );
    expect(container.querySelector("header")!.className).toContain("min-h-11");
    expect(container.querySelector("div.p-4")).not.toBeNull();
    expect(screen.getByRole("button").className).toContain("h-8");
  });

  it("tightens padding and control size under a compact provider", () => {
    const { container } = render(
      <DensityProvider value="compact">
        <Panel title="Teach">
          <Button>Build</Button>
        </Panel>
      </DensityProvider>,
    );
    const header = container.querySelector("header")!;
    expect(header.className).toContain("min-h-8");
    expect(header.className).not.toContain("min-h-11");
    expect(container.querySelector("div.p-2\\.5")).not.toBeNull();
    expect(screen.getByRole("button").className).toContain("h-7");
  });

  it("keeps an explicit size prop winning over the density default", () => {
    render(
      <DensityProvider value="compact">
        <Button size="md">Build</Button>
      </DensityProvider>,
    );
    expect(screen.getByRole("button").className).toContain("h-8");
  });

  it("reaches Section and Table too, so a dense column is dense throughout", () => {
    const { container } = render(
      <DensityProvider value="compact">
        <Section title="Contours">
          <Table
            columns={[{ key: "id", header: "#", cell: (row: { id: number }) => row.id }]}
            rows={[{ id: 12 }]}
            rowKey={(row) => row.id}
          />
        </Section>
      </DensityProvider>,
    );
    expect(container.querySelector("section")!.className).toContain("gap-1.5");
    expect(container.querySelector("table")!.className).toContain("text-[11px]");
    expect(container.querySelector("td")!.className).toContain("py-0.5");
  });

  it("byDensity picks the branch in force", () => {
    expect(byDensity("comfortable", "a", "b")).toBe("a");
    expect(byDensity("compact", "a", "b")).toBe("b");
  });
});
