---
"@vitavision/ui": minor
---

New `Progress`: how far a long operation has got, as a count out of a total.

```tsx
<Progress aria-label="Translating" value={412} max={2556} />
<Progress aria-label="Loading the catalog" /> {/* no value: indeterminate */}
```

- **Determinate** with a `value` out of `max` (100 by default), clamped. Screen readers hear "412 of 2,556"; `valueText` replaces it ("412 of 2,556 strings").
- **Indeterminate** without a `value`: a sweeping bar, with no `aria-valuenow`, `aria-valuemax` or `aria-valuetext`. It holds still with reduced motion.
- The bar is in the accent colour, never a verdict colour. The track is thinner in the compact density. `data-state` is `loading`, `complete` or `indeterminate`.
- `progressText(value, max)` gives the same "412 of 2,556" text, for a label printed beside the bar.
- `ProgressBar` is deprecated in favour of `Progress`. It still works as before.
