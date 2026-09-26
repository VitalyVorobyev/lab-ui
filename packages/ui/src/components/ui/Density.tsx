/**
 * How much room the chrome takes, as one decision per region rather than per component.
 *
 * The default spacing is written for a page: a form you read through once, where generous
 * padding is what makes it legible. An inspector column beside a canvas is the opposite
 * problem — it is a permanent surface that accumulates tools, and there the same padding is
 * simply less of the instrument on screen. Nesting compounds it: a panel body's `p-4`
 * inside a section's `gap-3` inside a column's own padding is three margins deep before any
 * control appears.
 *
 * `compact` is not "the same design, smaller". It drops the leading and the padding a
 * reading surface needs and keeps the type sizes and hit targets a control needs, so a
 * dense column stays clickable. Below this there is no honest saving left — the next step
 * down is a control too small to hit.
 *
 * The default is `comfortable`, so a consumer that never mentions density gets exactly what
 * it had.
 */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type Density = "comfortable" | "compact";

const Ctx = createContext<Density>("comfortable");

/** The density in force here. Every primitive that has two spacings reads this. */
export function useDensity(): Density {
  return useContext(Ctx);
}

/** Pick one of two values by the density in force — the primitives' own idiom. */
export function byDensity<T>(density: Density, comfortable: T, compact: T): T {
  return density === "compact" ? compact : comfortable;
}

export function DensityProvider({ value, children }: { value: Density; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
