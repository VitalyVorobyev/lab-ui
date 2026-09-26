/**
 * What the compositor actually put on screen, read from a Chrome trace.
 *
 * rAF intervals only see the main thread. Chrome rasterizes a transformed DOM/SVG layer on
 * its raster threads, so a page can tick rAF at full rate while the frames it presents are
 * late, partial or checkerboarded. `PipelineReporter` is Chrome's own per-frame verdict
 * (the one its smoothness metrics are built on); this reads it for the measurement window
 * `main.ts` marks with `bench:start` / `bench:end`.
 */

import { percentile } from "./workload";

interface TraceEvent {
  name: string;
  ph: string;
  pid: number;
  ts: number;
  cat?: string;
  args?: { frame_reporter?: { state?: string; checkerboarded_needs_raster?: boolean; checkerboarded_needs_record?: boolean; has_missing_content?: boolean } };
}

export interface FrameReport {
  /** Frames the compositor produced in the window. */
  frames: number;
  presented: number;
  /** Presented without the main thread's update for that frame. */
  partial: number;
  dropped: number;
  /** Presented with tiles still missing (needed raster or record). */
  checkerboarded: number;
  /** p95 interval between presented frames, ms. */
  presentedP95: number;
}

export function frameReport(trace: { traceEvents: TraceEvent[] }): FrameReport | null {
  const events = trace.traceEvents;
  const start = events.find((e) => e.name === "bench:start");
  const end = events.find((e) => e.name === "bench:end");
  if (!start || !end) return null;
  const frames = events
    .filter((e) => e.name === "PipelineReporter" && e.ph === "b" && e.pid === start.pid && e.ts >= start.ts && e.ts <= end.ts)
    .sort((a, b) => a.ts - b.ts);
  const state = (e: TraceEvent) => e.args?.frame_reporter?.state ?? "";
  const presented = frames.filter((e) => state(e).startsWith("STATE_PRESENTED"));
  const intervals: number[] = [];
  for (let i = 1; i < presented.length; i++) intervals.push((presented[i]!.ts - presented[i - 1]!.ts) / 1000);
  intervals.sort((a, b) => a - b);
  return {
    frames: frames.filter((e) => state(e) !== "STATE_NO_UPDATE_DESIRED").length,
    presented: presented.length,
    partial: frames.filter((e) => state(e) === "STATE_PRESENTED_PARTIAL").length,
    dropped: frames.filter((e) => state(e) === "STATE_DROPPED").length,
    checkerboarded: frames.filter((e) => {
      const r = e.args?.frame_reporter;
      return r?.checkerboarded_needs_raster || r?.checkerboarded_needs_record || r?.has_missing_content;
    }).length,
    presentedP95: Math.round(percentile(intervals, 95) * 100) / 100,
  };
}
