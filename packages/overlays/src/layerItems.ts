/**
 * What each stage2d layer is given, for each part of a detection: the pure mapping from the
 * normalised `TargetDetection` to the items of `GridLayer`, `AreaSet`, `PointSet` and
 * `EllipseSet`. `TargetOverlay` is these plus the wiring, so this is where the overlay's
 * decisions are, and where they are tested without a DOM.
 *
 * Pure: no React, no DOM.
 */

import type { AreaSetItem, EllipseSetItem, GridNode, PointSetItem } from "@vitavision/stage2d";

import { markerPolygons } from "./lattice";
import {
  isLatticeKind,
  type TargetCircle,
  type TargetCorner,
  type TargetDetection,
  type TargetEdgeBit,
  type TargetEllipse,
  type TargetRing,
} from "./model";

/** The label of a corner: its own, else the lattice index on a board, else the id. */
function cornerLabel(corner: TargetCorner, lattice: boolean): string {
  if (corner.label !== undefined) return corner.label;
  if (lattice && Number.isInteger(corner.i) && Number.isInteger(corner.j)) return `${corner.i},${corner.j}`;
  return String(corner.id);
}

/**
 * The nodes of the corner layer.
 *
 * A corner with an `angle` is a `directed` marker (its edge directions, one or two), any other a
 * `plus`. On a board kind the lattice indices are kept, so `GridLayer` joins neighbours; on any
 * other kind they are `NaN`, which `latticeEdges` reads as "not part of a lattice", so no edge is
 * drawn.
 *
 * @param detection - The detection.
 * @returns One node per corner, in order.
 */
export function cornerNodes(detection: TargetDetection): GridNode[] {
  const lattice = isLatticeKind(detection.kind);
  return (detection.corners ?? []).map((corner): GridNode => {
    const node: GridNode = {
      id: corner.id,
      x: corner.x,
      y: corner.y,
      i: lattice && Number.isInteger(corner.i) ? corner.i! : Number.NaN,
      j: lattice && Number.isInteger(corner.j) ? corner.j! : Number.NaN,
      label: cornerLabel(corner, lattice),
    };
    if (corner.angle !== undefined) {
      node.kind = "directed";
      node.angle = corner.angle;
      if (corner.angle2 !== undefined) node.angle2 = corner.angle2;
    }
    return node;
  });
}

/**
 * The regions of the marker layer: each marker's quad, labelled with its text or its id.
 *
 * @param detection - The detection.
 * @returns One area per marker with a usable quad.
 */
export function markerAreas(detection: TargetDetection): AreaSetItem[] {
  return markerPolygons(detection.markers ?? []).map((polygon) => ({
    id: polygon.id,
    points: polygon.points,
    label: polygon.label ?? String(polygon.id),
  }));
}

/** The label of a circle: its own, else `(i, j)` when it matched a cell. */
function circleLabel(circle: TargetCircle): string | undefined {
  if (circle.label !== undefined) return circle.label;
  return Number.isInteger(circle.i) && Number.isInteger(circle.j) ? `(${circle.i}, ${circle.j})` : undefined;
}

/**
 * The points of the circle layer. Polarity picks the glyph: `circle-white` is a hollow ring,
 * `circle-black` a ring with a dot.
 *
 * @param detection - The detection.
 * @returns One point per circle.
 */
export function circlePoints(detection: TargetDetection): PointSetItem[] {
  return (detection.circles ?? []).map((circle) => {
    const item: PointSetItem = { id: circle.id, x: circle.x, y: circle.y, kind: `circle-${circle.polarity}` };
    const label = circleLabel(circle);
    if (label !== undefined) item.label = label;
    return item;
  });
}

/**
 * The points of the ring layer: a `plus` at each centre, picked anywhere inside the outer ellipse
 * (`pickRadius` is the larger semi-axis), labelled with the ring's text or its id.
 *
 * @param rings - The rings.
 * @returns One point per ring.
 */
export function ringCentres(rings: readonly TargetRing[]): PointSetItem[] {
  return rings.map((ring) => ({
    id: ring.id,
    x: ring.x,
    y: ring.y,
    kind: "plus",
    pickRadius: Math.max(ring.outer.rx, ring.outer.ry),
    label: ring.label ?? String(ring.id),
  }));
}

/**
 * The ellipses of the rings' two edges. The outer is `feature`, the inner `model` (a fitted
 * second edge), and the smaller inner one is told from the outer by size as well as by colour.
 *
 * @param rings - The rings.
 * @returns The outer ellipses, and the inner ones of the rings that have one.
 */
export function ringEllipses(rings: readonly TargetRing[]): { outer: EllipseSetItem[]; inner: EllipseSetItem[] } {
  const outer: EllipseSetItem[] = [];
  const inner: EllipseSetItem[] = [];
  for (const ring of rings) {
    outer.push({ id: ring.id, x: ring.x, y: ring.y, rx: ring.outer.rx, ry: ring.outer.ry, angle: ring.outer.angle, role: "feature" });
    if (ring.inner) {
      inner.push({ id: ring.id, x: ring.x, y: ring.y, rx: ring.inner.rx, ry: ring.inner.ry, angle: ring.inner.angle, role: "model" });
    }
  }
  return { outer, inner };
}

/** Opacity of a dot at confidence 0 and at confidence 1: a weak bit is visible, a sure one is solid. */
const BIT_OPACITY_MIN = 0.35;

/**
 * The dots of the edge-bit layer: bit 1 is a solid `feature` circle, bit 0 a dashed `model`
 * one, and the opacity runs from 35 % at confidence 0 to 100 % at confidence 1.
 *
 * @param bits - The edge bits.
 * @returns One ellipse (a circle) per bit.
 */
export function edgeBitEllipses(bits: readonly TargetEdgeBit[]): EllipseSetItem[] {
  return bits.map((bit) => ({
    id: bit.id,
    x: bit.x,
    y: bit.y,
    rx: bit.radius,
    ry: bit.radius,
    role: bit.bit === 1 ? "feature" : "model",
    dashed: bit.bit === 0,
    opacity: BIT_OPACITY_MIN + (1 - BIT_OPACITY_MIN) * Math.min(1, Math.max(0, bit.confidence)),
  }));
}

/**
 * The ellipse of a 2×2 position covariance: `scale` standard deviations along each principal
 * axis.
 *
 * The semi-axes are `scale · √λ` for the matrix's two eigenvalues `λ₁ ≥ λ₂`, and `angle` is the
 * direction of the eigenvector of `λ₁` (radians, clockwise on screen, in `(-π/2, π/2]`). At
 * `scale = 1` this is the 1σ ellipse: the curve `dᵀ Σ⁻¹ d = 1`.
 *
 * @param cov - The covariance `[xx, xy, yy]`, image pixels squared.
 * @param scale - The gain applied to both semi-axes. Defaults to 1.
 * @returns The ellipse, or `null` when the matrix is not finite and positive definite, or the
 *   scale is not a finite positive number: there is no ellipse to draw.
 */
export function covarianceEllipse(cov: readonly [xx: number, xy: number, yy: number], scale = 1): TargetEllipse | null {
  const [xx, xy, yy] = cov;
  if (!Number.isFinite(xx + xy + yy) || !(Number.isFinite(scale) && scale > 0)) return null;
  const det = xx * yy - xy * xy;
  // Positive definite: a positive diagonal and a positive determinant.
  if (!(xx > 0 && yy > 0 && det > 0)) return null;
  const mean = 0.5 * (xx + yy);
  const spread = Math.hypot(0.5 * (xx - yy), xy);
  const major = mean + spread;
  // λ₁λ₂ = det: the smaller eigenvalue from the product rather than from `mean - spread`.
  const minor = det / major;
  const half = 0.5 * Math.atan2(2 * xy, xx - yy);
  // `atan2(-0, x < 0)` is -π: keep the axis in (-π/2, π/2].
  const angle = half <= -Math.PI / 2 ? half + Math.PI : half;
  return { rx: scale * Math.sqrt(major), ry: scale * Math.sqrt(minor), angle };
}

/**
 * The ellipses of the uncertainty layer: each corner's position covariance as a 1σ ellipse,
 * both semi-axes multiplied by `scale`, centred on the corner and sharing its id, in the `model`
 * role. A corner with no covariance, or one that is not positive definite, has none.
 *
 * @param corners - The corners.
 * @param scale - The gain on the semi-axes. A detector's σ is a fraction of a pixel, so it is
 *   drawn magnified; print the gain beside the image ("ellipses ×40").
 * @returns One ellipse per corner with a drawable covariance, in order.
 */
export function uncertaintyEllipses(corners: readonly TargetCorner[], scale: number): EllipseSetItem[] {
  const out: EllipseSetItem[] = [];
  for (const corner of corners) {
    if (!corner.cov) continue;
    const ellipse = covarianceEllipse(corner.cov, scale);
    if (ellipse) out.push({ id: corner.id, x: corner.x, y: corner.y, ...ellipse, role: "model" });
  }
  return out;
}
