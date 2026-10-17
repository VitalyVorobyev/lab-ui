---
"@vitavision/ui": minor
---

`Textarea` grows with its content, shows an invalid state, and is set in the sans face unless you ask for mono.

```tsx
<Field label="German" error={error}>
  <Textarea minRows={2} maxRows={8} value={text} onValueChange={setText} />
</Field>
```

- **Growing:** with `minRows` and/or `maxRows` it starts `minRows` tall (also in a server render), follows its content and scrolls past `maxRows`. It also refits when a controlled `value` changes or its width changes. Without them it is `rows` tall and resizable, as before.
- **Invalid:** `invalid` sets `aria-invalid`, `data-invalid` and a border in the defect colour. Inside a `Field` with an `error` it is on without the prop.
- **`onValueChange`** is called with the text on every edit, alongside the native `onChange`.
- **Breaking:** the text is now IBM Plex Sans by default; it used to always be mono. Pass `mono` to keep the old look, for JSON, code or lists. The props type is exported as `TextareaProps`.
