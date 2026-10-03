/**
 * Screen-constant geometry for a layer inside an `ImageStage`.
 */

import { useStage } from "./ImageStage";

/**
 * A function from screen pixels to image pixels at the current zoom. A stroke, handle or
 * label drawn `px(1.5)` wide stays 1.5 screen pixels at every zoom (the overlay grammar's
 * rule).
 *
 * @returns `px(css)`.
 */
export function useScreenPx(): (css: number) => number {
  return useStage().imageLength;
}
