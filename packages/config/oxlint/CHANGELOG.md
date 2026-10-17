# @vitavision/config-oxlint

## 0.1.0

### Minor Changes

- 79c4fae: New package: the shared lint config moves from ESLint to [Oxlint](https://oxc.rs/docs/guide/usage/linter), and this package replaces `@vitavision/config-eslint`. It works with TypeScript 7, which typescript-eslint does not support.
  
  ```bash
  bun add -d @vitavision/config-oxlint oxlint@^1.86.0 oxlint-tsgolint@^7.0.2003 typescript@^7.0.2
  ```
  
  ```jsonc
  // .oxlintrc.json
  {
    "extends": ["./node_modules/@vitavision/config-oxlint/oxlintrc.json"],
    "overrides": [{ "files": ["src/editor/**"], "rules": { "vitavision/tokens-only": "error" } }]
  }
  ```
  
  - **The same checks.** The TypeScript rules (type-aware, through `oxlint-tsgolint`), the React and hooks rules with the React Compiler checks, and the recommended Storybook rules for `*.stories.*` files. `any` is an error, `@ts-expect-error` needs a description and type imports use `import type`.
  - **`vitavision/tokens-only`** replaces `tokensOnly(globs)`: turn the rule on in an `overrides` entry for the directories that use the design tokens. It skips test and story files itself.
  - **React 19 idioms:** no `forwardRef`, no `useContext` (use `use`), no `<Context.Provider>` (render `<Context>`). `forwardRef` and `useContext` are now errors rather than warnings.
  - **Moving from `@vitavision/config-eslint`:** remove `eslint`, `typescript-eslint` and `@vitavision/config-eslint`, replace `eslint.config.js` with the `.oxlintrc.json` above, and lint with `oxlint --max-warnings 0`. Existing `eslint-disable` comments keep working; rename `@typescript-eslint/` to `typescript/` and `@eslint-react/` to `react/` in them.
  - **Not checked any more:** `@eslint-react`'s leaked listener, timer and observer checks and its naming-convention rules, which Oxlint does not have. An app that needs them can stay on `@vitavision/config-eslint` 0.1 (ESLint 10, TypeScript 6) for now.
