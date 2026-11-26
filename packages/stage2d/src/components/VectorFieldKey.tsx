/**
 * The reference length of a `VectorField`: an arrow of a round length with its value, so a
 * reader can turn arrow lengths back into data units.
 */

import { cn } from "@vitavision/ui";

import { useStage } from "./stage/ImageStage";
import { arrowPath, niceLength, type ArrowStyle, type VectorScale } from "./vectorGeometry";
import { useVectorScale } from "./VectorField";

/** Props of `VectorFieldKey`. */
export interface VectorFieldKeyProps {
  /** The field's `vectors`: the scale of an automatic `scale` depends on them. */
  vectors: ArrayLike<number>;
  /** The field's `scale`, so the key is drawn at exactly the field's scale. Defaults as `VectorField` does. */
  scale?: VectorScale | undefined;
  /**
   * The length the key shows, in data units. Defaults to the largest 1, 2 or 5 times a power of
   * ten that is at most the field's reference vector.
   */
  length?: number | undefined;
  /** The data unit, written after the value (`px`, `m/s`). */
  unit?: string | undefined;
  /** Formats the value. Defaults to at most 3 significant figures, without trailing zeros. */
  format?: ((value: number) => string) | undefined;
  /**
   * Draw without its own dark chip, for a place that has one already: the `extra` of a
   * `StageReadout`. Off by default.
   */
  bare?: boolean | undefined;
  /** Merged onto the key with `cn`. */
  className?: string | undefined;
}

const KEY_ARROW: ArrowStyle = { head: 5, headWidth: 0.7, minLength: 1 };
/** The key is not drawn wider than this, in screen pixels. */
const MAX_WIDTH = 160;

/**
 * An arrow of a known length and its value ("0.1 px"). Pass it as `ImageStage`'s `readout`, or
 * as the `extra` of a `StageReadout` with `bare`; it reads the stage's zoom through `useStage`, so it stays
 * true as the view changes, and draws nothing while the field has no scale or the arrow would
 * be wider than 160 screen pixels.
 *
 * On its own it is drawn in the readout's light-on-dark chip, so it sits on the image like the readout does.
 */
export function VectorFieldKey({
  vectors,
  scale,
  length,
  unit,
  format = (value) => String(Number(value.toPrecision(3))),
  bare = false,
  className,
}: VectorFieldKeyProps) {
  const stage = useStage();
  const { reference, perUnit } = useVectorScale(vectors, scale);
  const value = length ?? niceLength(reference);
  const width = value * perUnit * stage.view.scale;
  if (!(value > 0) || !(width >= 1) || width > MAX_WIDTH) return null;
  const pad = 1;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 align-middle font-mono text-[10px] tabular-nums",
        !bare && "rounded-control bg-black/60 px-1.5 py-0.5 text-white",
        className,
      )}
      data-vector-key=""
      title={`Arrow length: ${unit ? `${format(value)} ${unit}` : format(value)}`}
    >
      <svg
        aria-hidden
        width={width + 2 * pad}
        height={10}
        viewBox={`${-pad} -5 ${width + 2 * pad} 10`}
        className="shrink-0 overflow-visible"
      >
        <path
          d={arrowPath(0, 0, width, 0, 1, KEY_ARROW)}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
      <span>{unit ? `${format(value)} ${unit}` : format(value)}</span>
    </span>
  );
}
