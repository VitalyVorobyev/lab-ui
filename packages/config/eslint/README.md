# @vitavision/config-eslint

Shared ESLint flat config for the `@vitavision/*` frontends. It bundles:
- typescript-eslint, type-aware;
- React rules (`@eslint-react`) and the hooks rules;
- Storybook rules;
- `tokensOnly`, a rule that keeps colour in the design tokens.

```bash
bun add -d @vitavision/config-eslint eslint@^10.11.0 typescript@^6.0.3
```

```js
// eslint.config.js
import { recommended, tokensOnly } from "@vitavision/config-eslint";

export default [
  ...recommended({ tsconfigRootDir: import.meta.dirname }),
  tokensOnly(["src/editor/**", "src/components/**"]),
];
```

- **`recommended({ tsconfigRootDir })`**
  - The base config.
  - `any` is an error.
  - `@ts-expect-error` needs a description.
  - Type imports must use `import type`.
- **`tokensOnly(globs)`**
  - In the given directories (tests and stories excepted), flags raw Tailwind palette utilities (`bg-gray-500`, `hover:ring-red-400/50`) and hex colour literals (`#1e293b`).
  - Colour comes from the `@vitavision/ui` tokens instead (`bg-surface`, `text-fg-muted`, `var(--signal)`).
  - List the directories that already use the tokens and grow the list as an app moves over.
- **`plugin`** exposes the rule as `vitavision/tokens-only`, so you can configure it yourself.

**Accessibility is not linted.** `eslint-plugin-jsx-a11y` does not run on ESLint 10. Check
accessibility with axe in your component or story tests instead.

## License

MIT OR Apache-2.0.
