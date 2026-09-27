# @vitavision/three-react

React Three Fiber components over `@vitavision/three`. Per-frame updates go through
`useFrame` and refs, never React state: playback is read from a `PlayheadSource`
(`{ get(): number }`, e.g. `@vitavision/workbench`'s `createPlayhead`) once per rendered
frame.

```bash
bun add @vitavision/three-react @vitavision/three three@0.186.1 @react-three/fiber
```

Peers: `react`, `react-dom`, `three` (`^0.186.0`) and `@react-three/fiber` (`^9.8.1`). No
stylesheet: nothing here is a Tailwind class; the colours are read from the `@vitavision/ui`
tokens at runtime. Built in etendue (`web/packages/three-react`) with `@vitavision/three` and
moved here as PLAN L8-1.

```tsx
<SceneCanvas className="h-full">
  <FrameTree baked={baked} playhead={playhead}>
    <Robot id="ur5e" visuals={manifest.visuals} resolve={meshUrl} />
    <AtFrame name="cam_left">
      <CameraFrustum borderRays={rays} depth={0.12} active onSelect={select} />
    </AtFrame>
    <AtFrame name="board">
      <TargetBoard width={0.25} height={0.175} checker={{ cols: 10, rows: 7 }} />
    </AtFrame>
  </FrameTree>
</SceneCanvas>
```

- `SceneCanvas` — Z-up canvas in vitavision colours: orbit controls, ground grid, lights.
- `FrameTree` / `AtFrame` / `useFrameTree` — a baked scenario as a frame graph; children of
  `AtFrame` live in that frame.
- `Robot`, `CameraFrustum`, `LaserFan`, `TargetBoard`, `LightGizmo`, `FrameAxes`.
- `useSceneColors` — the theme's scene colours, following the `dark` class.

Colours are tokens only: `signal` for selection, `fg-muted` for robots and idle cameras,
`defect` for laser light and X axes, `normal` Y, `signal` Z, `warn` lights.

**Server rendering.** Safe to render on the server: `SceneCanvas` renders its labelled
wrapper and R3F's empty canvas element, and `useSceneColors` returns neutral `gray` (there
is no document to read the tokens from) until the client hydrates. The stories run through the
same axe, SSR and visual harness as every other package, with no opt-outs: the WebGL canvas is
screenshotted like any other story.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
