/**
 * Viewport
 *
 * Single source of truth for the visible window of a Chart:
 *   - xDomain: data range on X
 *   - yDomain: data range on Y
 *
 * Pan and zoom operate in data space; consumers (axes / overlays / layers)
 * subscribe to 'change' and re-derive pixel coordinates via Scale.
 *
 * `zoom(factor, anchor)` keeps the data value under `anchor` (a fraction
 * 0..1 of the visible range) fixed — the standard "wheel zoom at cursor"
 * affordance.
 */
import { EventBus } from './EventBus.js';
import type { Domain } from './Scale.js';

export interface ViewportState {
  xDomain: Domain;
  yDomain: Domain;
}

export interface ViewportOptions {
  xDomain: Domain;
  yDomain: Domain;
  /** Hard limits (data space). Pan/zoom will clamp to these if set. */
  xBounds?: Domain;
  yBounds?: Domain;
  /** Min / max visible span per axis (data space). */
  xMinSpan?: number;
  xMaxSpan?: number;
  yMinSpan?: number;
  yMaxSpan?: number;
}

type ViewportEvents = {
  change: ViewportState;
};

export class Viewport {
  private _xDomain: [number, number];
  private _yDomain: [number, number];
  private opts: ViewportOptions;
  readonly bus = new EventBus<ViewportEvents>();

  constructor(opts: ViewportOptions) {
    this.opts = opts;
    this._xDomain = [opts.xDomain[0], opts.xDomain[1]];
    this._yDomain = [opts.yDomain[0], opts.yDomain[1]];
  }

  get xDomain(): Domain {
    return this._xDomain;
  }

  get yDomain(): Domain {
    return this._yDomain;
  }

  state(): ViewportState {
    return { xDomain: this._xDomain, yDomain: this._yDomain };
  }

  setXDomain(d: Domain): void {
    this._xDomain = [d[0], d[1]];
    this.applyBounds();
    this.bus.emit('change', this.state());
  }

  setYDomain(d: Domain): void {
    this._yDomain = [d[0], d[1]];
    this.applyBounds();
    this.bus.emit('change', this.state());
  }

  /** Translate by (dx, dy) in data units. */
  pan(dx: number, dy: number): void {
    this._xDomain = [this._xDomain[0] + dx, this._xDomain[1] + dx];
    this._yDomain = [this._yDomain[0] + dy, this._yDomain[1] + dy];
    this.applyBounds();
    this.bus.emit('change', this.state());
  }

  /**
   * Zoom by `factor` (>1 = zoom out, <1 = zoom in) around an anchor in [0,1]
   * along each axis. Axes with anchor `undefined` are left unchanged.
   */
  zoom(factor: number, anchor: { x?: number; y?: number } = {}): void {
    if (anchor.x !== undefined) {
      const [a, b] = this._xDomain;
      const span = b - a;
      const center = a + span * anchor.x;
      const newSpan = clampSpan(span * factor, this.opts.xMinSpan, this.opts.xMaxSpan);
      this._xDomain = [center - newSpan * anchor.x, center + newSpan * (1 - anchor.x)];
    }
    if (anchor.y !== undefined) {
      const [a, b] = this._yDomain;
      const span = b - a;
      const center = a + span * anchor.y;
      const newSpan = clampSpan(span * factor, this.opts.yMinSpan, this.opts.yMaxSpan);
      this._yDomain = [center - newSpan * anchor.y, center + newSpan * (1 - anchor.y)];
    }
    this.applyBounds();
    this.bus.emit('change', this.state());
  }

  private applyBounds(): void {
    if (this.opts.xBounds) this._xDomain = clampDomain(this._xDomain, this.opts.xBounds);
    if (this.opts.yBounds) this._yDomain = clampDomain(this._yDomain, this.opts.yBounds);
  }
}

function clampSpan(span: number, min?: number, max?: number): number {
  let s = span;
  if (min !== undefined && s < min) s = min;
  if (max !== undefined && s > max) s = max;
  return s;
}

function clampDomain(d: [number, number], bounds: Domain): [number, number] {
  const span = d[1] - d[0];
  const boundSpan = bounds[1] - bounds[0];
  if (span >= boundSpan) return [bounds[0], bounds[1]];
  let lo = d[0];
  let hi = d[1];
  if (lo < bounds[0]) {
    lo = bounds[0];
    hi = lo + span;
  }
  if (hi > bounds[1]) {
    hi = bounds[1];
    lo = hi - span;
  }
  return [lo, hi];
}
