/**
 * VWAP
 *
 * Volume-weighted average price — a single cumulative line. Input is a
 * series of `{ t, price, volume }` sorted ascending by t. By default
 * VWAP is cumulative across the whole input (the typical "session VWAP"
 * shape if the consumer slices to a session).
 *
 *   vwap_i = sum(price_k * volume_k, k=0..i) / sum(volume_k, k=0..i)
 *
 * `reset` is an optional ascending list of timestamps at which to restart
 * accumulation — useful for plotting daily VWAP across multiple sessions
 * in one overlay.
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';
import type { Point } from '../core/primitives.js';

export interface VWAPSample {
  t: number;
  price: number;
  volume: number;
}

export interface VWAPOptions extends OverlayOptions {
  color?: string;
  lineWidth?: number;
  /** Ascending list of timestamps at which to reset accumulation. */
  resets?: number[];
}

export class VWAP extends OverlayBase<VWAPSample[]> {
  color: string;
  lineWidth: number;
  resets: number[];

  constructor(adapter: Adapter, options: VWAPOptions) {
    super(adapter, options);
    this.color = options.color ?? '#a78bfa';
    this.lineWidth = options.lineWidth ?? 1.5;
    this.resets = options.resets ?? [];
  }

  setResets(resets: number[]): this {
    this.resets = resets;
    this.adapter.invalidate();
    return this;
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const data = this.data;
    if (!data || data.length === 0) return;
    const vwap = computeVWAP(data, this.resets);

    // Walk vwap. Each reset boundary breaks the polyline into a new run
    // so we don't visually connect two sessions.
    let run: Point[] = [];
    const flush = (): void => {
      if (run.length > 1)
        ctx.polyline(run, { stroke: this.color, lineWidth: this.lineWidth });
      run = [];
    };
    let resetIx = 0;
    for (let i = 0; i < data.length; i++) {
      const t = data[i]!.t;
      while (resetIx < this.resets.length && t >= this.resets[resetIx]!) {
        flush();
        resetIx++;
      }
      const v = vwap[i]!;
      if (isNaN(v)) continue;
      const p = this.adapter.toPixel(t, v);
      if (isFinite(p.x) && isFinite(p.y)) run.push(p);
    }
    flush();
  }
}

/**
 * Returns a parallel array of cumulative VWAP values. NaN where volume
 * is zero or where the running sum is zero (first sample with vol=0).
 */
export function computeVWAP(data: VWAPSample[], resets: number[] = []): number[] {
  const n = data.length;
  const out = new Array<number>(n).fill(NaN);
  if (n === 0) return out;
  let pv = 0;
  let v = 0;
  let resetIx = 0;
  for (let i = 0; i < n; i++) {
    const s = data[i]!;
    while (resetIx < resets.length && s.t >= resets[resetIx]!) {
      pv = 0;
      v = 0;
      resetIx++;
    }
    pv += s.price * s.volume;
    v += s.volume;
    out[i] = v > 0 ? pv / v : NaN;
  }
  return out;
}
