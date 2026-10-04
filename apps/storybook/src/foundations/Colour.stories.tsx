import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The semantic colour tokens of `@vitavision/ui/styles.css`, by role. Swatches are the
 * tokens themselves (`bg-*` resolves to `var(--*)`), so the page follows the theme switch.
 */

interface Token {
  name: string;
  swatch: string;
  role: string;
}

const GROUPS: { title: string; tokens: Token[] }[] = [
  {
    title: "Surfaces",
    tokens: [
      { name: "ground", swatch: "bg-ground", role: "The page, held below the panels." },
      { name: "surface", swatch: "bg-surface", role: "Panels and cards." },
      { name: "raised", swatch: "bg-raised", role: "Inputs, table headers, a panel within a panel." },
      { name: "overlay", swatch: "bg-overlay", role: "Popovers, menus, dialogs." },
      { name: "canvas", swatch: "bg-canvas", role: "Behind an image: dark in both themes." },
      { name: "line", swatch: "bg-line", role: "Dividers and panel rings." },
      { name: "line-strong", swatch: "bg-line-strong", role: "Control borders." },
    ],
  },
  {
    title: "Text",
    tokens: [
      { name: "fg", swatch: "bg-fg", role: "Body text and values." },
      { name: "fg-muted", swatch: "bg-fg-muted", role: "Labels, hints, secondary text." },
      { name: "fg-subtle", swatch: "bg-fg-subtle", role: "Placeholders, units, the quietest text." },
    ],
  },
  {
    title: "Signal — the one accent",
    tokens: [
      { name: "signal", swatch: "bg-signal", role: "You can act here: focus, selection, primary action." },
      { name: "signal-strong", swatch: "bg-signal-strong", role: "Its hover and pressed state." },
      { name: "signal-fg", swatch: "bg-signal-fg", role: "Text on a signal fill." },
    ],
  },
  {
    title: "Verdicts — reserved",
    tokens: [
      { name: "normal", swatch: "bg-normal", role: "A pass verdict. Never decoration, never a series." },
      { name: "defect", swatch: "bg-defect", role: "A fail verdict, and destructive actions." },
      { name: "warn", swatch: "bg-warn", role: "Needs attention: a verdict that is not final." },
    ],
  },
];

const meta = {
  title: "Foundations/Colour",
  parameters: {
    docs: {
      description: {
        component: `The chrome is grey so the data can be loud: true-neutral surfaces, one accent
(\`signal\`), and verdict colours used for verdicts only. Components use these names — never a raw
Tailwind palette class or a hex literal (the \`tokensOnly\` rule of \`@vitavision/config-eslint\`
enforces it).`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every token, by role, in the current theme. */
export const Tokens: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
      {GROUPS.map(({ title, tokens }) => (
        <section key={title} aria-label={title} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <ul className="flex flex-col gap-1.5">
            {tokens.map(({ name, swatch, role }) => (
              <li key={name} className="grid grid-cols-[2.5rem_7rem_1fr] items-center gap-3">
                <span aria-hidden className={`h-7 rounded-control ring-1 ring-line ${swatch}`} />
                <code className="text-xs">{name}</code>
                <span className="text-xs text-fg-muted">{role}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  ),
};

/** Each text token on each surface it is allowed on — each pair holds ≥ 4.5:1 in both themes. */
export const TextOnSurfaces: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      {["bg-ground", "bg-surface", "bg-raised", "bg-overlay"].map((surface) => (
        <div key={surface} className={`flex flex-col gap-1 rounded-panel p-3 ring-1 ring-line ${surface}`}>
          <code className="text-[11px] text-fg-subtle">{surface.slice(3)}</code>
          <span className="text-sm text-fg">fg — 0.184 px</span>
          <span className="text-sm text-fg-muted">fg-muted — label</span>
          <span className="text-sm text-fg-subtle">fg-subtle — unit</span>
          <span className="text-sm text-signal">signal — link</span>
        </div>
      ))}
    </div>
  ),
};
