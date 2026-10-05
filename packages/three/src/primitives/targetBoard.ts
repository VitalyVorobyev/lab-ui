import {
  BufferGeometry,
  type ColorRepresentation,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from "three";

import { GIZMO_LAYER } from "../layers";

const NO_RAYCAST: Object3D["raycast"] = () => undefined;

// Physical albedos, not theme colours: a printed board looks the same in every theme.
/** Light colour of a board when none is given: white paper. */
const PAPER = 0xf2f2f2;
/** Dark-square colour of a board when none is given: black ink. */
const INK = 0x1a1a1a;

/** Options of {@link TargetBoard}. */
export interface TargetBoardOptions {
  /** Extent along local X, metres. */
  width: number;
  /** Extent along local Y, metres. */
  height: number;
  /**
   * Light (paper) colour: the board's physical albedo, what a sensor sees. Default `0xf2f2f2`.
   * A printed board is white whatever the viewer's theme, so this is a fixed colour.
   */
  color?: ColorRepresentation | undefined;
  /** Dark-square (ink) colour, fixed like {@link TargetBoardOptions.color}. Default `0x1a1a1a`. */
  edgeColor?: ColorRepresentation | undefined;
  /**
   * Outline colour. The outline is a viewer-only gizmo on {@link GIZMO_LAYER}, so it may follow
   * the theme and selection. Default: the dark-square colour.
   */
  outlineColor?: ColorRepresentation | undefined;
  /**
   * Draw a checkerboard of `cols × rows` squares (columns along X), the dark square at the
   * −X/−Y corner. Omit for a plain surface.
   */
  checker?: { cols: number; rows: number } | undefined;
}

/**
 * A planar target: a `width × height` rectangle centred on the local origin in the `z = 0`
 * plane, facing +Z (the target frame), optionally with a checkerboard pattern.
 *
 * The surface and squares are physical (the default layer): a sensor image shows them in
 * their fixed colours. The outline is on {@link GIZMO_LAYER}: only a viewport that enables
 * that layer draws it, so it can carry emphasis without changing what a sensor sees.
 */
export class TargetBoard extends Group {
  readonly #base: MeshBasicMaterial;
  readonly #dark: MeshBasicMaterial;
  readonly #edge: LineBasicMaterial;
  readonly #outline: LineLoop;
  #active = false;

  constructor({ width, height, color = PAPER, edgeColor = INK, outlineColor = edgeColor, checker }: TargetBoardOptions) {
    super();
    const w = width / 2;
    const h = height / 2;
    const base = new BufferGeometry();
    base.setAttribute("position", new Float32BufferAttribute([-w, -h, 0, w, -h, 0, w, h, 0, -w, -h, 0, w, h, 0, -w, h, 0], 3));
    this.#base = new MeshBasicMaterial({ color, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1 });
    this.#dark = new MeshBasicMaterial({ color: edgeColor, side: DoubleSide });
    this.#edge = new LineBasicMaterial({ color: outlineColor });
    this.add(new Mesh(base, this.#base));

    if (checker && checker.cols > 0 && checker.rows > 0) {
      const sx = width / checker.cols;
      const sy = height / checker.rows;
      const squares: number[] = [];
      for (let r = 0; r < checker.rows; r++) {
        for (let c = 0; c < checker.cols; c++) {
          if ((r + c) % 2 !== 0) continue;
          const x0 = -w + c * sx;
          const y0 = -h + r * sy;
          const x1 = x0 + sx;
          const y1 = y0 + sy;
          squares.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
        }
      }
      const dark = new BufferGeometry();
      dark.setAttribute("position", new Float32BufferAttribute(squares, 3));
      this.add(new Mesh(dark, this.#dark));
    }

    const outline = new BufferGeometry();
    outline.setAttribute("position", new Float32BufferAttribute([-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0], 3));
    this.#outline = new LineLoop(outline, this.#edge);
    this.#outline.layers.set(GIZMO_LAYER);
    // Lines are hit within a world-unit threshold: picks must land on the surface instead.
    this.#outline.raycast = NO_RAYCAST;
    this.add(this.#outline);
  }

  /** Whether the board is drawn emphasised (selected). */
  get active(): boolean {
    return this.#active;
  }

  /**
   * Draw the board emphasised or not: while active the outline ignores depth and is drawn
   * after the opaque geometry, so a selected board stays findable behind other objects.
   */
  setActive(value: boolean): void {
    this.#active = value;
    this.#edge.depthTest = !value;
    this.#edge.needsUpdate = true;
    this.#outline.renderOrder = value ? 1 : 0;
  }

  /** Make the whole board translucent (`1` = opaque). */
  setOpacity(opacity: number): void {
    for (const m of [this.#base, this.#dark]) {
      m.opacity = opacity;
      m.transparent = opacity < 1;
      m.depthWrite = opacity >= 1;
      m.needsUpdate = true;
    }
  }

  /**
   * Change the light (paper) and dark-square (ink) colours; an omitted one returns to its
   * default, as in {@link TargetBoardOptions}. The outline keeps its own colour.
   */
  setColors(color: ColorRepresentation = PAPER, edgeColor: ColorRepresentation = INK): void {
    this.#base.color.set(color);
    this.#dark.color.set(edgeColor);
  }

  /** Change the outline colour, e.g. to the accent while selected. */
  setOutlineColor(color: ColorRepresentation): void {
    this.#edge.color.set(color);
  }
}
