import type { Scene } from "../scene";
import type { Box, View } from "../workload";

/**
 * One rendering engine under test. The harness owns the clock; a candidate only renders
 * the view it is given and answers hit-tests.
 */
export interface Candidate {
  /** Human-readable name for the report. */
  label: string;
  /** How this candidate hit-tests, for the report. */
  hitTest: string;
  mount(host: HTMLElement, box: Box, scene: Scene, assets: Assets): Promise<void>;
  /** Render `view`. Must have done its synchronous work (DOM writes, draws) on return. */
  setView(view: View): void;
  /** The index of the point marker under viewport-local `p`, or `-1`. */
  hit(p: { x: number; y: number }, view: View): number;
  destroy(): void;
}

export interface Assets {
  bitmap: ImageBitmap;
  /** An object URL of the same image, for DOM candidates. */
  url: string;
}
