---
"@vitavision/ui": minor
---

New `HighlightedText`: a string with its placeholders, markup tags, protected terms and mismatches marked, such as a UI string next to its translation.

```tsx
const spans = findSpans(source, [
  { pattern: /%\d+/, kind: "placeholder" },
  { pattern: /<\/?[a-z][^>]*>/i, kind: "tag" },
  { pattern: /\bParamsManager\b/, kind: "protected-term" },
]);
<HighlightedText text={source} spans={spans} />
```

- **Spans** are `{ start, end, kind, label? }` in UTF-16 offsets, in any order. Overlaps are allowed. The kinds are `placeholder`, `tag`, `protected-term` and `mismatch`.
- **`findSpans(text, rules)`** builds spans from regular expressions. It finds every match, skips empty ones and sorts the result.
- **Text only:** the string is never parsed as HTML. `<b>` shows as the characters `<b>`. Whitespace and line breaks are kept.
- **Accessible:** each kind has its own shape: an outlined mono box, a mono face on a quiet box, a dotted underline, or a wavy underline with a tint. None is told apart by colour alone. Each span is a `<mark>`, followed by its kind for screen readers ("%1, placeholder"). That label is left out when the text is copied. `labels` renames or silences a kind, and a span's `label` says why it is marked.
