/**
 * What a reader gets from the list: one labelled section per group, and per row the keys as
 * caps (alternatives joined by "or") beside the command.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShortcutList } from "./ShortcutList";

describe("ShortcutList", () => {
  it("labels each group by its heading and pairs the keys with the command", () => {
    render(
      <ShortcutList
        aria-label="Shortcuts"
        className="extra"
        groups={[
          { title: "Navigation", shortcuts: [{ keys: ["J", "↓"], description: "Next" }] },
          { title: "Empty", shortcuts: [] },
          { title: "Zoom", shortcuts: [{ keys: ["0"], description: "Fit" }] },
        ]}
      />,
    );
    const root = screen.getByLabelText("Shortcuts");
    expect(root.className).toContain("extra");
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"))).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Empty" })).toBeNull();

    const navigation = screen.getByRole("region", { name: "Navigation" });
    const term = navigation.querySelector("dt")!;
    expect(term.textContent).toBe("Jor↓");
    expect(
      within(term)
        .getAllByText(/^(J|↓)$/)
        .map((key) => key.tagName),
    ).toEqual(["KBD", "KBD"]);
    expect(term.nextElementSibling?.tagName).toBe("DD");
    expect(term.nextElementSibling?.textContent).toBe("Next");

    const zoom = screen.getByRole("region", { name: "Zoom" });
    expect(within(zoom).queryByText("or")).toBeNull();
  });
});
