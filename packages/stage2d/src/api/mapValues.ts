/**
 * The numbers behind a picture.
 *
 * A rendered anomaly map or false-colour measurement overlay answers "is this region
 * hotter than that one" or "roughly where does the edge fall". The next question — *how
 * hot, in the units a metric is computed in* or *at what subpixel coordinate* — cannot be
 * answered from the picture: a colormap clips at both ends and quantizes to 256 entries,
 * and alpha is a gamma of the normalized value, so the inverse is multi-valued.
 *
 * So the values arrive as values, in a fixed 24-byte-header format that is deliberately
 * **not** `.npy` — there is no dtype string to parse and no shape tuple. This module
 * decodes them and indexes them. **It never draws.** Colour range and colormap stay wherever
 * the values were produced.
 */

const MAGIC = 0x56414d31; // "VAM1", read big-endian so the constant is legible.
const HEADER_SIZE = 24;

export interface ValuePlane {
  width: number;
  height: number;
  /**
   * The integer decimation applied upstream. `1` means every source pixel is here;
   * anything more means the readout is sampled, and a caller should say so rather than
   * presenting an approximate number as exact.
   */
  stride: number;
  /**
   * How many planes are in `values`, stored one after another.
   *
   * Read from the header rather than assumed: a mono anomaly map is one plane, an RGB
   * source is three, and nothing here may encode which — channel count is data.
   */
  channels: number;
  values: Float32Array;
}

export class PlaneFormatError extends Error {}

export function decodePlane(buffer: ArrayBuffer): ValuePlane {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new PlaneFormatError("a value plane is at least a 24-byte header");
  }
  const header = new DataView(buffer);
  if (header.getUint32(0, false) !== MAGIC) {
    throw new PlaneFormatError("not a value plane — wrong magic");
  }

  const width = header.getUint32(4, true);
  const height = header.getUint32(8, true);
  const stride = header.getUint32(12, true);
  const channels = header.getUint32(16, true);
  const expected = width * height * channels;

  if (buffer.byteLength - HEADER_SIZE < expected * 4) {
    throw new PlaneFormatError(`a ${width}x${height}x${channels} plane needs ${expected} values`);
  }
  return {
    width,
    height,
    stride,
    channels,
    values: new Float32Array(buffer, HEADER_SIZE, expected),
  };
}

/**
 * The value at a normalized position, or `null` outside the plane.
 *
 * `u` and `v` are fractions of the source frame. A stored anomaly map or model-input plane
 * is expected to already be projected into that frame, so crop and letterbox geometry is
 * resolved once upstream rather than reconstructed here. NaN marks an uncovered pixel.
 */
export function valueAt(plane: ValuePlane, u: number, v: number, channel = 0): number | null {
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
  if (channel < 0 || channel >= plane.channels) return null;
  const x = Math.min(plane.width - 1, Math.floor(u * plane.width));
  const y = Math.min(plane.height - 1, Math.floor(v * plane.height));
  // Plane-major, so one channel is a single offset rather than a stride walk.
  const value = plane.values[channel * plane.width * plane.height + y * plane.width + x];
  return value !== undefined && Number.isFinite(value) ? value : null;
}

/** Every channel at one position, in order — one number for mono, three for RGB. */
export function valuesAt(plane: ValuePlane, u: number, v: number): number[] {
  const out: number[] = [];
  for (let channel = 0; channel < plane.channels; channel += 1) {
    const value = valueAt(plane, u, v, channel);
    if (value !== null) out.push(value);
  }
  return out;
}

/** Where a value sits in a range, as a fraction — `null` for a degenerate range. */
export function fractionOf(
  value: number,
  range: { low: number; high: number } | null | undefined,
): number | null {
  if (!range || range.high <= range.low) return null;
  return (value - range.low) / (range.high - range.low);
}

export async function fetchPlane(url: string): Promise<ValuePlane> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching values`);
  return decodePlane(await response.arrayBuffer());
}
