import { type ComputeFunction, createPortal, useFrame, useThree } from "@react-three/fiber";
import { type BakedScenarioLike, FrameTreeRuntime } from "@vitavision/three";
import { createContext, type ReactNode, use, useEffect, useMemo, useRef } from "react";

const RuntimeContext = createContext<FrameTreeRuntime | null>(null);

/** Where playback is: read once per rendered frame, never through React state. */
export interface PlayheadSource {
  /** The sample index to show. */
  get(): number;
}

/** Props of {@link FrameTree}. */
export interface FrameTreeProps {
  /** The baked scenario to show. A new object builds a new runtime. */
  baked: BakedScenarioLike;
  /** The sample to show, read every rendered frame. Omit to stay at sample 0. */
  playhead?: PlayheadSource | undefined;
  /** Called with the runtime once it is built (e.g. to read poses for an inspector). */
  onRuntime?: ((runtime: FrameTreeRuntime) => void) | undefined;
  /** Scene content; place it in frames with {@link AtFrame}. */
  children?: ReactNode;
}

/**
 * Mounts a `FrameTreeRuntime` (`@vitavision/three`) for `baked` and poses it at `playhead.get()` on every
 * rendered frame (`useFrame`), so playback never re-renders React.
 */
export function FrameTree({ baked, playhead, onRuntime, children }: FrameTreeProps) {
  const runtime = useMemo(() => new FrameTreeRuntime(baked), [baked]);
  // Held in a ref so an inline callback is called once per runtime, not on every render.
  const onRuntimeRef = useRef(onRuntime);
  useEffect(() => {
    onRuntimeRef.current = onRuntime;
  }, [onRuntime]);
  useEffect(() => {
    onRuntimeRef.current?.(runtime);
  }, [runtime]);
  useFrame(() => {
    if (playhead) runtime.apply(playhead.get());
  });
  return (
    <RuntimeContext value={runtime}>
      <primitive object={runtime.root} />
      {children}
    </RuntimeContext>
  );
}

/** The runtime of the enclosing {@link FrameTree}. */
export function useFrameTree(): FrameTreeRuntime {
  const runtime = use(RuntimeContext);
  if (!runtime) throw new Error("useFrameTree must be used inside <FrameTree>");
  return runtime;
}

/** Props of {@link AtFrame}. */
export interface AtFrameProps {
  /** Frame name, e.g. `"cam_left"` or `"ur5e/tool0"`. */
  name: string;
  /** Content, expressed in that frame. */
  children?: ReactNode;
}

/**
 * Renders `children` in frame `name` of the enclosing {@link FrameTree}: they move with it.
 * Renders nothing for an unknown frame.
 */
export function AtFrame({ name, children }: AtFrameProps) {
  const frame = useFrameTree().frame(name);
  // A portal raycasts its objects with a raycaster of its own, on layer 0 only: give it the
  // enclosing one's layers on every event, so gizmos in a frame are picked on the layers the
  // viewport enables (`GIZMO_LAYER` in `SceneCanvas`).
  const compute = useThree((s) => s.events.compute);
  const portalState = useMemo(
    () => ({
      events: {
        compute: ((event, state, previous) => {
          compute?.(event, state, previous);
          if (previous) state.raycaster.layers.mask = previous.raycaster.layers.mask;
        }) satisfies ComputeFunction,
      },
    }),
    [compute],
  );
  return frame ? createPortal(children, frame, portalState) : null;
}
