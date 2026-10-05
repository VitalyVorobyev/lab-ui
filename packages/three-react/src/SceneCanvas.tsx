import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GIZMO_LAYER, Z_UP, setLayer } from "@vitavision/three";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { GridHelper, Vector3 } from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { useSceneColors } from "./colors";
import { dollyEye, orbitEye } from "./keyboardOrbit";

/** Props of {@link SceneCanvas}. */
export interface SceneCanvasProps {
  /** Scene content. */
  children?: ReactNode;
  /** Initial eye position in world coordinates (metres). */
  eye?: readonly [number, number, number];
  /** Initial orbit target. */
  target?: readonly [number, number, number];
  /** The world's up axis. Default +Z; `[0, -1, 0]` suits a camera-frame (CV) scene. */
  up?: readonly [number, number, number];
  /** Vertical field of view in degrees. Default 45. */
  fov?: number;
  /** Near and far clip distances in metres. Default `[0.01, 100]`. */
  clip?: readonly [number, number];
  /** Ground grid size in metres, `0` for none. The grid lies in the plane normal to `up`. */
  grid?: number;
  /** Called when a click hits nothing. */
  onPointerMissed?: (() => void) | undefined;
  /** Class of the wrapping element (size it; the canvas fills it). */
  className?: string;
  /** Accessible name of the view. Default "3D scene". */
  label?: string;
  /**
   * Keyboard camera control, on by default: the view is a tab stop, and while it has focus the
   * arrow keys orbit (Left and Right about the up axis, Up and Down over the target; 5° a press,
   * 15° with Shift), `+` and `-` zoom, and `0` returns to the opening view. `false` leaves the
   * view to the pointer: no tab stop and no key handling.
   */
  keyboard?: boolean;
}

/** One arrow-key step, and one with Shift, in radians. */
const STEP = (5 * Math.PI) / 180;
const SHIFT_STEP = (15 * Math.PI) / 180;
/** Distance factor of one zoom key press. */
const ZOOM = 1.2;

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

/**
 * A Z-up 3D viewport in the theme's scene colours: orbit controls, a ground grid in the world XY
 * plane, and ambient plus key lighting. Everything inside is in world coordinates (metres).
 *
 * The wrapper is a `group` announced as a "3D view" and named by `label`. With `keyboard`
 * (the default) it is focusable and describes its keys to assistive technology; the camera
 * then moves with the arrow keys, `+`, `-` and `0` as well as with the pointer.
 */
export function SceneCanvas({
  children,
  eye = [1.6, -1.4, 1.1],
  target = [0.3, 0, 0.3],
  up = [Z_UP.x, Z_UP.y, Z_UP.z],
  fov = 45,
  clip = [0.01, 100],
  grid = 2,
  onPointerMissed,
  className,
  label = "3D scene",
  keyboard = true,
}: SceneCanvasProps) {
  const colors = useSceneColors();
  const controlsRef = useRef<ThreeOrbitControls | null>(null);
  const hintId = useId();

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const controls = controlsRef.current;
    // Keys pressed on content inside the view (an HTML overlay's input) and browser shortcuts
    // (Ctrl/Cmd with `+`, `-`, `0` zoom the page) are not the camera's.
    if (!controls || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const camera = controls.object;
    const step = event.shiftKey ? SHIFT_STEP : STEP;
    const polar = [controls.minPolarAngle, controls.maxPolarAngle] as const;
    const distance = [controls.minDistance, controls.maxDistance] as const;
    const orbit = (dAzimuth: number, dPolar: number) =>
      camera.position.copy(orbitEye(camera.position, controls.target, camera.up, dAzimuth, dPolar, polar));
    const dolly = (factor: number) => camera.position.copy(dollyEye(camera.position, controls.target, factor, distance));
    switch (event.key) {
      case "ArrowLeft":
        orbit(-step, 0);
        break;
      case "ArrowRight":
        orbit(step, 0);
        break;
      case "ArrowUp":
        orbit(0, -step);
        break;
      case "ArrowDown":
        orbit(0, step);
        break;
      case "+":
      case "=":
        dolly(1 / ZOOM);
        break;
      case "-":
      case "_":
        dolly(ZOOM);
        break;
      case "0":
        controls.reset();
        break;
      default:
        return;
    }
    controls.update();
    event.preventDefault();
  };

  return (
    <div
      className={className}
      role="group"
      aria-roledescription="3D view"
      aria-label={label}
      {...(keyboard ? { tabIndex: 0, "aria-describedby": hintId, onKeyDown } : {})}
    >
      {keyboard && (
        <span id={hintId} style={VISUALLY_HIDDEN}>
          Arrow keys orbit, with Shift in larger steps; plus and minus zoom; 0 resets the view.
        </span>
      )}
      <Canvas
        camera={{ position: [...eye], up: [...up], near: clip[0], far: clip[1], fov }}
        dpr={[1, 2]}
        {...(onPointerMissed ? { onPointerMissed } : {})}
        style={{ background: colors.background }}
        onCreated={({ camera, raycaster }) => {
          // The viewport shows gizmos and picks through them; sensor views see only the world.
          camera.layers.enable(GIZMO_LAYER);
          raycaster.layers.enable(GIZMO_LAYER);
        }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[2, -3, 4]} intensity={1.8} />
        {grid > 0 && <Grid size={grid} up={up} />}
        <OrbitControls target={target} controlsRef={controlsRef} />
        {children}
      </Canvas>
    </div>
  );
}

function Grid({ size, up }: { size: number; up: readonly [number, number, number] }) {
  const colors = useSceneColors();
  const [ux, uy, uz] = up;
  const grid = useMemo(() => {
    const g = new GridHelper(size, Math.round(size * 10), colors.lineStrong, colors.line);
    // GridHelper lies in the XZ plane (normal +Y); turn its normal onto `up`.
    g.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(ux, uy, uz).normalize());
    setLayer(g, GIZMO_LAYER);
    return g;
  }, [size, ux, uy, uz, colors.line, colors.lineStrong]);
  useEffect(() => () => grid.dispose(), [grid]);
  return <primitive object={grid} />;
}

function OrbitControls({
  target,
  controlsRef,
}: {
  target: readonly [number, number, number];
  /** Where the keyboard handler outside the canvas finds the controls. */
  controlsRef: RefObject<ThreeOrbitControls | null>;
}) {
  const camera = useThree((s) => s.camera);
  const element = useThree((s) => s.gl.domElement);
  const controls = useMemo(() => {
    const c = new ThreeOrbitControls(camera, element);
    c.enableDamping = true;
    return c;
  }, [camera, element]);
  const [tx, ty, tz] = target;
  useEffect(() => {
    controls.target.set(tx, ty, tz);
    // `0` returns to the opening eye looking at the current target.
    controls.target0.set(tx, ty, tz);
    controls.update();
  }, [controls, tx, ty, tz]);
  useEffect(() => {
    // The view `0` returns to: the opening eye and target (applied by the effect above).
    controls.saveState();
    controlsRef.current = controls;
    return () => {
      if (controlsRef.current === controls) controlsRef.current = null;
    };
  }, [controls, controlsRef]);
  useEffect(() => {
    // StrictMode runs the cleanup and then this effect again on the same memoised controls,
    // and `dispose()` removes their listeners: reconnect (a no-op when already connected).
    controls.connect(element);
    return () => controls.dispose();
  }, [controls, element]);
  useFrame(() => controls.update());
  return null;
}
