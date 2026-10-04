import type { Meta, StoryObj } from "@storybook/react-vite";
import { Crosshair, GraduationCap, Library, ScanSearch, Settings } from "lucide-react";
import { useState, type AnchorHTMLAttributes } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { StatusDot } from "@vitavision/ui";

import { AppShell } from "./AppShell";
import { NavRail, NavRailItem, type NavRailProps } from "./NavRail";

const change = fn();

/**
 * Stands in for a router's `<Link>`: it runs the `onClick` it is given, then, unless that
 * cancelled the event, navigates client-side (here: nowhere) instead of loading the URL.
 */
function FakeRouterLink({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      data-router-link
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) event.preventDefault();
      }}
      {...rest}
    />
  );
}

/**
 * A rail of four workspaces in a `<nav>`, as `AppShell`'s `rail` slot would put it. Its own
 * items replace `args.children`.
 */
function Rail(args: NavRailProps) {
  return (
    <nav aria-label="Workspaces" className="w-fit rounded-panel border border-line bg-surface">
      <NavRail {...args}>
        <NavRailItem value="library" label="Library" icon={<Library />} />
        <NavRailItem value="teach" label="Teach" icon={<GraduationCap />} />
        <NavRailItem value="find" label="Find" icon={<ScanSearch />} />
        <NavRailItem value="gauge" label="Gauge" icon={<Crosshair />} />
      </NavRail>
    </nav>
  );
}

const meta = {
  title: "workbench/NavRail",
  component: NavRail,
  parameters: {
    docs: {
      description: {
        component: `The workspaces of a studio app as a column down its left edge, one of them current: \`NavRailItem\`s
(\`value\`, \`label\`, \`icon\`, optional \`badge\` and \`disabled\`) in a \`NavRail\`. Controlled with \`value\` /
\`onValueChange\`, or kept by the rail from \`defaultValue\`. \`labels="visible"\` (the default) sets each label
under its icon; \`labels="tooltip"\` draws icon-only buttons and shows the label in a tooltip. With \`asChild\`, an
item renders onto the app's own link — a router's \`<Link to="…" />\`, given without content — so client-side
navigation keeps working; the link keeps its own \`className\`, and its own \`onClick\` runs first (cancelling
the event there keeps the item from being chosen).

**Use** it in \`AppShell\`'s \`rail\` slot for the handful of workspaces an app switches between.

**Don't** use it for the items of one workspace (that is a \`TreeView\` or a list in the navigator), for more
than about seven entries, or for actions (those are buttons in the header or a toolbar).

**Accessibility**: a list of buttons (or links), each its own Tab stop; the current one has
\`aria-current="page"\` and \`data-state="active"\`. Icons are \`aria-hidden\`; with tooltip labels each item is
named by its label (\`aria-label\`). A badge describes its item (\`aria-describedby\`) rather than renaming it.
The rail has no landmark of its own: \`AppShell\`'s \`rail\` slot is already a named \`<nav>\`, so elsewhere
wrap it in a \`<nav aria-label="…">\`.`,
      },
    },
  },
  args: { children: null, defaultValue: "teach", onValueChange: change },
  render: (args) => <Rail {...args} />,
} satisfies Meta<typeof NavRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Labels: Story = {
  play: async ({ canvas }) => {
    change.mockClear();
    const teach = canvas.getByRole("button", { name: "Teach" });
    await expect(teach).toHaveAttribute("aria-current", "page");
    await expect(teach).toHaveAttribute("data-state", "active");
    await expect(canvas.getByText("Library")).toBeVisible();

    const find = canvas.getByRole("button", { name: "Find" });
    await userEvent.click(find);
    await expect(change).toHaveBeenLastCalledWith("find");
    await expect(find).toHaveAttribute("aria-current", "page");
    await expect(teach).not.toHaveAttribute("aria-current");
    await expect(teach).toHaveAttribute("data-state", "inactive");

    // Choosing the current item again is not a change.
    await userEvent.click(find);
    await expect(change).toHaveBeenCalledTimes(1);

    // Every item is a Tab stop.
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Gauge" })).toHaveFocus();
  },
};

export const TooltipLabels: Story = {
  args: { labels: "tooltip" },
  play: async ({ canvas, canvasElement }) => {
    const library = canvas.getByRole("button", { name: "Library" });
    await expect(canvas.queryByText("Library")).toBeNull();
    await expect(library.querySelector("svg")?.closest("[aria-hidden]")).not.toBeNull();
    library.focus();
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole("tooltip");
    await expect(tooltip).toHaveTextContent("Library");
  },
};

const PAGES = [
  { value: "library", label: "Library", icon: <Library /> },
  { value: "teach", label: "Teach", icon: <GraduationCap /> },
  { value: "find", label: "Find", icon: <ScanSearch /> },
];

function RoutedRail() {
  const [value, setValue] = useState("library");
  return (
    <nav aria-label="Workspaces" className="w-fit rounded-panel border border-line bg-surface">
      <NavRail value={value} onValueChange={setValue}>
        {PAGES.map((page) => (
          <NavRailItem key={page.value} {...page} asChild>
            <FakeRouterLink to={`/${page.value}`} className="data-[state=active]:font-semibold" />
          </NavRailItem>
        ))}
      </NavRail>
    </nav>
  );
}

/** Items as the app's own links (here a stand-in for a router's `<Link>`), through `asChild`. */
export const RouterLinks: Story = {
  render: () => <RoutedRail />,
  play: async ({ canvas }) => {
    const library = canvas.getByRole("link", { name: "Library" });
    await expect(library).toHaveAttribute("href", "/library");
    await expect(library).toHaveAttribute("data-router-link");
    await expect(library).toHaveAttribute("aria-current", "page");
    // The link's own class is kept beside the item's.
    await expect(library).toHaveClass("data-[state=active]:font-semibold", "rounded-control");
    const find = canvas.getByRole("link", { name: "Find" });
    await userEvent.click(find);
    await expect(find).toHaveAttribute("aria-current", "page");
    await expect(library).not.toHaveAttribute("aria-current");
  },
};

export const Disabled: Story = {
  render: () => (
    <nav aria-label="Workspaces" className="w-fit rounded-panel border border-line bg-surface">
      <NavRail defaultValue="library" onValueChange={change}>
        <NavRailItem value="library" label="Library" icon={<Library />} />
        <NavRailItem value="gauge" label="Gauge" icon={<Crosshair />} disabled />
        <NavRailItem value="settings" label="Settings" icon={<Settings />} disabled asChild>
          <FakeRouterLink to="/settings" />
        </NavRailItem>
      </NavRail>
    </nav>
  ),
  play: async ({ canvas }) => {
    change.mockClear();
    const gauge = canvas.getByRole("button", { name: "Gauge" });
    await expect(gauge).toBeDisabled();
    await expect(gauge).toHaveAttribute("data-disabled");
    const settings = canvas.getByRole("link", { name: "Settings" });
    await expect(settings).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(settings);
    await expect(change).not.toHaveBeenCalled();
    await expect(settings).not.toHaveAttribute("aria-current");
  },
};

/** A count (over 99 as "99+") or any mark, on the icon's corner; it describes the item. */
export const Badge: Story = {
  render: () => (
    <nav aria-label="Workspaces" className="w-fit rounded-panel border border-line bg-surface">
      <NavRail defaultValue="library">
        <NavRailItem value="library" label="Library" icon={<Library />} badge={3} />
        <NavRailItem value="find" label="Find" icon={<ScanSearch />} badge={128} />
        <NavRailItem
          value="gauge"
          label="Gauge"
          icon={<Crosshair />}
          badge={<StatusDot tone="defect" className="rounded-full bg-surface p-0.5" />}
        />
      </NavRail>
    </nav>
  ),
  play: async ({ canvas }) => {
    // The count describes the item; the name stays the label.
    await expect(canvas.getByRole("button", { name: "Library" })).toHaveAccessibleDescription("3");
    await expect(canvas.getByRole("button", { name: "Find" })).toHaveAccessibleDescription("99+");
    await expect(canvas.getByRole("button", { name: "Gauge" }).querySelector('[data-tone="defect"]')).not.toBeNull();
  },
};

function ShellWithRail() {
  const [value, setValue] = useState("teach");
  return (
    <div style={{ width: 900, height: 360 }} className="overflow-hidden rounded-panel border border-line">
      <AppShell
        className="h-full"
        rail={
          <NavRail value={value} onValueChange={setValue} labels="tooltip">
            {PAGES.map((page) => (
              <NavRailItem key={page.value} {...page} />
            ))}
          </NavRail>
        }
        left={<div className="p-3 text-sm">Navigator</div>}
        main={<div className="grid h-full place-items-center text-sm text-fg-muted">{value}</div>}
      />
    </div>
  );
}

/** In `AppShell`'s `rail` slot, which is the `<nav>` landmark. */
export const InAppShell: Story = {
  render: () => <ShellWithRail />,
  play: async ({ canvas }) => {
    const rail = canvas.getByRole("navigation", { name: "Workspaces" });
    await expect(within(rail).getByRole("list")).toBeInTheDocument();
    await userEvent.click(within(rail).getByRole("button", { name: "Find" }));
    await expect(canvas.getByRole("main")).toHaveTextContent("find");
  },
};
