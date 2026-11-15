---
"@vitavision/stage2d": minor
---

`ImageLayer` takes a display `gain` and `gamma`, to read a dark or low-contrast frame without touching its pixels.

```tsx
<ImageLayer src={url} alt={name} gain={2} gamma={1.5} />
```

- Each channel `v` (0 to 1, as encoded in the file) is drawn as `gain × v^(1 / gamma)` and clipped at white: `gamma` above 1 lifts the shadows and mid-tones, as an image editor's levels control does.
- Both tiers (the preview and the full image) go through one SVG filter and carry `data-adjusted` while it applies. At `gain={1}` and `gamma={1}` (the defaults) no filter is rendered, so nothing changes for existing layers.
- It is a display curve only: hit-testing, `valueAt` and anything else that reads the image data see the original values.
- A negative `gain` counts as 0, a non-finite one as 1, and a `gamma` that is not positive as 1.
