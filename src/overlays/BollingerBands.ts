/**
 * BollingerBands
 *
 * Three lines (upper, mid, lower) from a price series. Mid = SMA over
 * `window` bars. Upper/lower = mid ± `stddev * standardDeviations`,
 * where stddev is the population standard deviation over the same window.
 *
 * Input: `{ t, v }[]` — sorted ascending by `t`.
 *
 * Bars before the window is satisfied are emitted as NaN — drawing skips
 * them so the lines visually start at index `window-1`.
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';
import type { Point } from '../core/primitives.js';

export interface BollingerSample {
  t: number;
  v: number;
}

export interface BollingerBandsOptions extends OverlayOptions {
  /** Lookback in bars. Default 20. */
  window?: number;
  /** Multiplier for std deviation. Default 2. */
  standardDeviations?: number;
  midColor?: string;
  bandColor?: string;
  /** Fill between upper and lower. Set to `null` to disable. */
  fill?: string | null;
  lineWidth?: number;
}

export class BollingerBands extends OverlayBase<BollingerSample[]> {
  window: number;
  standardDeviations: number;
  midColor: string;
  bandColor: string;
  fill: string | null;
  lineWidth: number;

  constructor(adapter: Adapter, options: BollingerBandsOptions) {
    super(adapter, options);
    this.window = options.window ?? 20;
    this.standardDeviations = options.standardDeviations ?? 2;
    this.midColor = options.midColor ?? '#f59e0b';
    this.bandColor = options.bandColor ?? 'rgba(245,158,11,0.5)';
    this.fill = options.fill ?? 'rgba(245,158,11,0.08)';
    this.lineWidth = options.lineWidth ?? 1;
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const data = this.data;
    if (!data || data.length === 0) return;
    const { upper, mid, lower } = computeBands(data, this.window, this.standardDeviations);
    const ups: Point[] = [];
    const mids: Point[] = [];
    const lows: Point[] = [];
    for (let i = 0; i < data.length; i++) {
      if (isNaN(mid[i]!)) continue;
      const t = data[i]!.t;
      const u = this.adapter.toPixel(t, upper[i]!);
      const m = this.adapter.toPixel(t, mid[i]!);
      const l = this.adapter.toPixel(t, lower[i]!);
      if (isFinite(u.x) && isFinite(u.y)) ups.push(u);
      if (isFinite(m.x) && isFinite(m.y)) mids.push(m);
      if (isFinite(l.x) && isFinite(l.y)) lows.push(l);
    }

    // Fill between upper and lower (close the polygon by walking back along lows).
    if (this.fill && ups.length > 1 && lows.length > 1) {
      ctx.path(
        (c) => {
          c.moveTo(ups[0]!.x, ups[0]!.y);
          for (let i = 1; i < ups.length; i++) c.lineTo(ups[i]!.x, ups[i]!.y);
          for (let i = lows.length - 1; i >= 0; i--) c.lineTo(lows[i]!.x, lows[i]!.y);
          c.closePath();
        },
        { fill: this.fill },
      );
    }
    ctx.polyline(ups, { stroke: this.bandColor, lineWidth: this.lineWidth });
    ctx.polyline(lows, { stroke: this.bandColor, lineWidth: this.lineWidth });
    ctx.polyline(mids, { stroke: this.midColor, lineWidth: this.lineWidth });
  }
}

/**
 * Rolling SMA + population stddev over `window` bars. Exported so callers
 * (or tests) can reuse the math without going through the overlay.
 */
export function computeBands(
  data: BollingerSample[],
  window: number,
  k: number,
): { upper: number[]; mid: number[]; lower: number[] } {
  const n = data.length;
  const upper = new Array<number>(n).fill(NaN);
  const mid = new Array<number>(n).fill(NaN);
  const lower = new Array<number>(n).fill(NaN);
  if (window <= 0 || n < window) return { upper, mid, lower };

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i]!.v;
    sum += v;
    sumSq += v * v;
    if (i >= window) {
      const out = data[i - window]!.v;
      sum -= out;
      sumSq -= out * out;
    }
    if (i >= window - 1) {
      const m = sum / window;
      // population variance — appropriate for a fixed lookback window
      const variance = Math.max(0, sumSq / window - m * m);
      const sd = Math.sqrt(variance);
      mid[i] = m;
      upper[i] = m + k * sd;
      lower[i] = m - k * sd;
    }
  }
  return { upper, mid, lower };
}
