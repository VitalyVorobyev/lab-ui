# @vitavision/config-oxlint

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter) config for the `@vitavision/*`
frontends. It replaces `@vitavision/config-eslint` and bundles:
- the TypeScript rules, type-aware (through `oxlint-tsgolint`, on TypeScript 7);
- the React and hooks rules, including the React Compiler checks;
- the recommended Storybook rules, for `*.stories.*` files;
- `vitavision/tokens-only`, a rule that keeps colour in the design tokens.

```bash
bun add -d @vitavision/config-oxlint oxlint@^1.86.0 oxlint-tsgolint@^7.0.2003 typescript@^7.0.2
```

```jsonc
// .oxlintrc.json
{
  "extends": ["./node_modules/@vitavision/config-oxlint/oxlintrc.json"],
  "ignorePatterns": ["src/generated/**"],
  "overrides": [
    { "files": ["src/editor/**", "src/components/**"], "rules": { "vitavision/tokens-only": "error" } }
  ]
}
```

```jsonc
// package.json
{ "scripts": { "lint": "oxlint --max-warnings 0" } }
```

- **`oxlintrc.json`**
  - The base config. Type-aware rules are on, so a `tsconfig.json` must cover the linted files.
  - `any` is an error, `@ts-expect-error` needs a description, and type imports must use `import type`.
  - React 19 idioms: no `forwardRef`, no `useContext` (use `use`), no `<Context.Provider>`.
  - `extends` takes a path, not a package name. Ignore patterns are relative to the config
    file that declares them, so declare yours in your own `.oxlintrc.json`. Oxlint also skips
    what `.gitignore` lists.
- **`vitavision/tokens-only`**
  - Flags raw Tailwind palette utilities (`bg-gray-500`, `hover:ring-red-400/50`) and hex colour literals (`#1e293b`). Test and story files are skipped.
  - Colour comes from the `@vitavision/ui` tokens instead (`bg-surface`, `text-fg-muted`, `var(--signal)`).
  - Turn it on for the directories that already use the tokens, and grow the list as an app moves over.
- **`./plugin` and `./storybook`** are the two JS plugins the config loads. Their rules use
  the ESLint rule API, so an app still on ESLint can load them while it migrates.

## Moving from `@vitavision/config-eslint`

1. Install the packages above. Remove `eslint`, `typescript-eslint` and `@vitavision/config-eslint`.
2. Replace `eslint.config.js` with the `.oxlintrc.json` above. Each `tokensOnly([...globs])`
   becomes an override that turns on `vitavision/tokens-only` for those globs.
3. Lint with `oxlint --max-warnings 0`. Oxlint honours existing `eslint-disable` comments. Rename
   `@typescript-eslint/x` to `typescript/x` and `@eslint-react/x` to `react/x` in them, or
   switch them to `oxlint-disable`.

A few `@eslint-react` rules have no Oxlint equivalent and are not checked: the leaked
listener, timer and observer checks (`web-api-no-leaked-*`), the context, id and ref naming
conventions, and `no-unnecessary-use-prefix`.

**Accessibility is not linted.** Check it with axe in your component or story tests.

## License

MIT OR Apache-2.0.
