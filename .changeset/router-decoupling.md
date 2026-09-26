---
"@vitavision/ui": minor
"@vitavision/lab-ui": minor
---

**Breaking:** no router dependency. `react-router` is no longer a peer of `@vitavision/ui` or
`@vitavision/lab-ui`; everything that navigates renders a plain `<a href>` or your own link
element through `asChild` (Radix `Slot`).

- `Button` gains `asChild`: `<Button asChild><Link to="/x">…</Link></Button>`.
- `ButtonLink` takes `href` (a plain anchor) instead of react-router's `LinkProps`; for
  client-side navigation, `<ButtonLink asChild><Link to="/x">…</Link></ButtonLink>`.
- `PageHeader`'s `back` is `{ href, label }` or a link element (`back={<Link to="/runs">Runs</Link>}`),
  replacing `{ to, label }`. New type: `BackLink`.
- `ReadoutItem` takes `href` or `link` (an element, given without children) instead of `to`.
