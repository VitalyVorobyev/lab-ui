import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { Button, ButtonLink, buttonClasses } from "./Button";
import { DensityProvider } from "./Density";

describe("ButtonLink", () => {
  it("is one anchor, with no button inside it", () => {
    const { container } = render(
      <MemoryRouter>
        <ButtonLink to="/experiments/new" variant="primary" icon={<svg data-testid="icon" />}>
          New experiment
        </ButtonLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "New experiment" });
    expect(link.getAttribute("href")).toBe("/experiments/new");
    expect(container.querySelector("button")).toBeNull();
    expect(link.querySelector("[data-testid=icon]")).not.toBeNull();
  });

  it("looks exactly like the button of the same variant and density", () => {
    render(
      <MemoryRouter>
        <DensityProvider value="compact">
          <Button variant="primary">Go</Button>
          <ButtonLink to="/" variant="primary">
            Go
          </ButtonLink>
        </DensityProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link").className).toBe(screen.getByRole("button").className);
    expect(screen.getByRole("link").className).toBe(
      buttonClasses({ variant: "primary", size: "sm" }),
    );
  });
});
