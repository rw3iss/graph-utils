/**
 * TradingViewOverlayAdapter
 *
 * Mirrors a TradingView `lightweight-charts` chart by laying a sibling
 * `<canvas>` absolute-positioned over the chart's element. Overlays paint
 * onto our canvas using the same Adapter contract as the vanilla path —
 * meaning the same overlay code runs on either host without modification.
 *
 * Design notes:
 *   - We never paint onto TV's own canvases. TV owns its layers; we sit
 *     above them with our own.
 *   - Coordinate mapping delegates to `timeScale.timeToCoordinate` and
 *     `series.priceToCoordinate`. Both return `null` for values outside
 *     the visible range; overlays that hit a null skip that point.
 *   - The adapter exposes `Scale`-shaped wrappers (`TradingViewTimeScale`
 *     / `TradingViewPriceScale`) so overlay code that uses
 *     `xScale.scale(v)` / `yScale.scale(v)` works unchanged.
 *   - Resync triggers: TV `subscribeVisibleLogicalRangeChange` (zoom/pan),
 *     `subscribeCrosshairMove` (also fires on hover so it catches steady-state
 *     mouse-driven layout shifts), a ResizeObserver on the chart element,
 *     and explicit `invalidate()` calls from consumers.
 *
 * Peer dependency: `lightweight-charts` >=5.0.0. We do not import it at
 * runtime — only the types — so a consumer that omits it does not pay any
 * bundle cost.
 */
// reason: we keep TV types loose to avoid a hard dep on `lightweight-charts`
// in `src/`. Consumers bring their own version via peerDependency.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CanvasContext } from '../core/CanvasContext.js';
import { Viewport } from '../core/Viewport.js';
import type { Domain, Range, Scale } from '../core/Scale.js';
import type { Layer, LayerPointerEvent } from '../chart/Layer.js';
import type { Adapter } from './Adapter.js';

// ----- TV type surface we depend on, copied locally to avoid the import -----
// (Consumers using TS will get full inference from their own import; we just
// need enough to call the methods we use.)

export type TradingViewTime = string | number | { year: number; month: number; day: number };

export interface TradingViewTimeRange {
  from: TradingViewTime;
  to: TradingViewTime;
}

export interface TradingViewLogicalRange {
  from: number;
  to: number;
}

export interface TradingViewTimeScale {
  timeToCoordinate(time: TradingViewTime): number | null;
  coordinateToTime(coord: number): TradingViewTime | null;
  getVisibleRange(): TradingViewTimeRange | null;
  getVisibleLogicalRange(): TradingViewLogicalRange | null;
  subscribeVisibleLogicalRangeChange(handler: (r: TradingViewLogicalRange | null) => void): void;
  unsubscribeVisibleLogicalRangeChange(handler: (r: TradingViewLogicalRange | null) => void): void;
  subscribeVisibleTimeRangeChange?(handler: (r: TradingViewTimeRange | null) => void): void;
  unsubscribeVisibleTimeRangeChange?(handler: (r: TradingViewTimeRange | null) => void): void;
}

export interface TradingViewSeries {
  priceToCoordinate(price: number): number | null;
  coordinateToPrice(coord: number): number | null;
}

export interface TradingViewChart {
  timeScale(): TradingViewTimeScale;
  chartElement(): HTMLElement;
  subscribeCrosshairMove?(handler: (param: any) => void): void;
  unsubscribeCrosshairMove?(handler: (param: any) => void): void;
}

// ---------------------------------------------------------------------------

export interface TradingViewOverlayAdapterOptions {
  /** The TV chart whose plot area we'll overlay. */
  chart: TradingViewChart;
  /** A series whose price scale we should mirror. Required: TV's
   *  priceToCoordinate lives on a series, not on the chart. */
  priceSeries: TradingViewSeries;
  /** Container the overlay canvas attaches to. Defaults to the parent of
   *  the TV chart element. */
  container?: HTMLElement;
  /** z-index for the overlay canvas. Default 10 (above TV's layers). */
  zIndex?: number;
  /**
   * Unit for the X data coordinate passed to `toPixel` and to
   * `xScale.scale`. TV's native `UTCTimestamp` is **seconds**; many app
   * data sources use **milliseconds**. Default `'seconds'`.
   */
  timeUnit?: 'seconds' | 'milliseconds';
  /** Override DPR (mostly for tests). */
  dpr?: number;
}

// ---------------------------------------------------------------------------

/**
 * TradingViewTimeScaleAdapter — wraps the TV time scale as our `Scale`.
 *
 * `scale(v)` calls `timeToCoordinate`. `invert(px)` calls
 * `coordinateToTime`. `setDomain`/`setRange` are no-ops because the
 * domain/range are owned by TV; the methods exist so the Scale interface
 * is satisfied for code that calls them defensively.
 *
 * `ticks(n)` queries TV's visible time range and emits `n` evenly spaced
 * stops; if no visible range is reported (chart not yet sized), returns
 * an empty array.
 */
class TradingViewTimeScaleAdapter implements Scale {
  private ts: TradingViewTimeScale;
  private toTime: (v: number) => TradingViewTime;
  private fromTime: (t: TradingViewTime) => number;

  constructor(ts: TradingViewTimeScale, unit: 'seconds' | 'milliseconds') {
    this.ts = ts;
    if (unit === 'milliseconds') {
      this.toTime = (v) => Math.floor(v / 1000) as unknown as TradingViewTime;
      this.fromTime = (t) => (typeof t === 'number' ? t * 1000 : Number(t));
    } else {
      this.toTime = (v) => v as unknown as TradingViewTime;
      this.fromTime = (t) => (typeof t === 'number' ? t : Number(t));
    }
  }

  setDomain(_domain: Domain): void {
    // owned by TV
  }
  setRange(_range: Range): void {
    // owned by TV
  }
  domain(): Domain {
    const r = this.ts.getVisibleRange();
    if (!r) return [0, 0];
    return [this.fromTime(r.from), this.fromTime(r.to)];
  }
  range(): Range {
    // TV doesn't expose pixel bounds directly; consumers should use the
    // adapter's plot bounds. Returning [NaN, NaN] makes accidental misuse
    // loud rather than silently producing wrong pixels.
    return [NaN, NaN];
  }

  scale(value: number): number {
    // Guard non-finite input and any TV internal throw. A corrupt drawing
    // point with a null/NaN time reaches `timeToCoordinate(null)`, which reads
    // `.year` of null deep inside TV and THROWS — that would crash the entire
    // overlay render loop (every frame: resize, crosshair, setData, interval).
    if (!Number.isFinite(value)) return NaN;
    let x: number | null;
    try {
      x = this.ts.timeToCoordinate(this.toTime(value));
    } catch {
      return NaN;
    }
    return x === null ? NaN : x;
  }

  invert(pixel: number): number {
    if (!Number.isFinite(pixel)) return NaN;
    let t: TradingViewTime | null;
    try {
      t = this.ts.coordinateToTime(pixel);
    } catch {
      return NaN;
    }
    return t === null ? NaN : this.fromTime(t);
  }

  ticks(count: number): number[] {
    const r = this.ts.getVisibleRange();
    if (!r) return [];
    const from = this.fromTime(r.from);
    const to = this.fromTime(r.to);
    if (!isFinite(from) || !isFinite(to) || from === to) return [from];
    const out: number[] = [];
    for (let i = 0; i <= count; i++) {
      out.push(from + ((to - from) * i) / count);
    }
    return out;
  }
}

/**
 * TradingViewPriceScaleAdapter — wraps a TV series's price scale as `Scale`.
 */
class TradingViewPriceScaleAdapter implements Scale {
  private s: TradingViewSeries;
  constructor(series: TradingViewSeries) {
    this.s = series;
  }
  setDomain(_d: Domain): void {}
  setRange(_r: Range): void {}
  domain(): Domain {
    // TV does not expose visible price range directly via the series API
    // (you can compute it from the price scale options + visible data, but
    // that's a separate dance). Domain queries from overlays should be rare
    // — they should be using `scale(price)` instead.
    return [NaN, NaN];
  }
  range(): Range {
    return [NaN, NaN];
  }
  scale(price: number): number {
    if (!Number.isFinite(price)) return NaN;
    let y: number | null;
    try {
      y = this.s.priceToCoordinate(price);
    } catch {
      return NaN;
    }
    return y === null ? NaN : y;
  }
  invert(pixel: number): number {
    if (!Number.isFinite(pixel)) return NaN;
    let p: number | null;
    try {
      p = this.s.coordinateToPrice(pixel);
    } catch {
      return NaN;
    }
    return p === null ? NaN : p;
  }
  ticks(_count: number): number[] {
    // No reliable way to read TV's price ticks; leave empty.
    return [];
  }
}

// ---------------------------------------------------------------------------

export class TradingViewOverlayAdapter implements Adapter {
  readonly tvChart: TradingViewChart;
  readonly priceSeries: TradingViewSeries;
  readonly xScale: Scale;
  readonly yScale: Scale;
  readonly viewport: Viewport;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasContext;

  private container: HTMLElement;
  private chartElement: HTMLElement;
  private layers: Layer[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private rafHandle: number | null = null;
  private destroyed = false;
  private timeUnit: 'seconds' | 'milliseconds';
  private onLogical: (r: TradingViewLogicalRange | null) => void;
  private onCrosshair: ((param: any) => void) | null = null;
  private interactive = false;
  private pointerListeners: Array<{ type: string; fn: EventListener }> = [];

  constructor(options: TradingViewOverlayAdapterOptions) {
    this.tvChart = options.chart;
    this.priceSeries = options.priceSeries;
    this.timeUnit = options.timeUnit ?? 'seconds';

    this.chartElement = this.tvChart.chartElement();
    this.container = options.container ?? (this.chartElement.parentElement as HTMLElement);
    if (!this.container) {
      throw new Error(
        'TradingViewOverlayAdapter: no container — pass `container` explicitly when the chart is not yet attached to a parent.',
      );
    }

    // Build overlay canvas, absolute-positioned over the chart element.
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = String(options.zIndex ?? 10);
    // Ensure container can position the canvas (we don't override an
    // existing 'relative' / 'absolute'; only set if currently 'static').
    const cs = getComputedStyle(this.container);
    if (cs.position === 'static') this.container.style.position = 'relative';
    this.container.appendChild(this.canvas);

    this.ctx = new CanvasContext(this.canvas, { dpr: options.dpr });

    this.xScale = new TradingViewTimeScaleAdapter(this.tvChart.timeScale(), this.timeUnit);
    this.yScale = new TradingViewPriceScaleAdapter(this.priceSeries);

    // Read-only viewport whose domains mirror TV. Overlays subscribe to
    // `change` if they want to know when the visible window shifts.
    this.viewport = new Viewport({
      xDomain: this.xScale.domain(),
      yDomain: [0, 1],
    });

    // TV → invalidate on logical range change. TV invokes synchronously,
    // so we coalesce through requestAnimationFrame just like Chart does.
    this.onLogical = () => {
      this.syncViewportDomain();
      this.invalidate();
    };
    this.tvChart.timeScale().subscribeVisibleLogicalRangeChange(this.onLogical);

    // ResizeObserver on the chart element: redraw + resize our canvas.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.chartElement);
    }
    this.handleResize();

    // Crosshair-move fires on TV's internal layout settles too — useful
    // because the logical-range change alone misses small zoom updates.
    if (typeof this.tvChart.subscribeCrosshairMove === 'function') {
      this.onCrosshair = () => this.invalidate();
      this.tvChart.subscribeCrosshairMove(this.onCrosshair);
    }
  }

  // -- Adapter implementation ------------------------------------------------

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  addLayer(layer: Layer): void {
    this.layers.push(layer);
    this.layers.sort((a, b) => a.zIndex - b.zIndex);
    this.invalidate();
  }

  removeLayer(idOrLayer: string | Layer): void {
    const id = typeof idOrLayer === 'string' ? idOrLayer : idOrLayer.id;
    this.layers = this.layers.filter((l) => l.id !== id);
    this.invalidate();
  }

  invalidate(): void {
    if (this.rafHandle !== null || this.destroyed) return;
    if (typeof requestAnimationFrame === 'undefined') return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.render();
    });
  }

  /**
   * Map a (time, price) pair in data space to overlay-canvas pixel coords.
   * Returns `{ NaN, NaN }` if either coordinate is outside the visible
   * range (TV returns null in that case).
   */
  toPixel(time: number, price: number): { x: number; y: number } {
    return { x: this.xScale.scale(time), y: this.yScale.scale(price) };
  }

  toData(px: number, py: number): { x: number; y: number } {
    return { x: this.xScale.invert(px), y: this.yScale.invert(py) };
  }

  /**
   * Toggle pointer interaction. The overlay canvas is `pointer-events: none`
   * by default so TV keeps pan/zoom. Turning interaction on flips it to
   * `'auto'` and attaches pointer listeners that dispatch to layers'
   * `onPointerDown/Move/Up`; turning it off restores `'none'` and detaches.
   * Idempotent.
   */
  setInteractive(on: boolean): void {
    if (on === this.interactive) return;
    this.interactive = on;
    if (on) {
      this.canvas.style.pointerEvents = 'auto';
      this.attachPointerListeners();
    } else {
      this.canvas.style.pointerEvents = 'none';
      this.detachPointerListeners();
    }
  }

  getInteractive(): boolean {
    return this.interactive;
  }

  /** Synchronously draw all visible layers. Mostly internal — prefer `invalidate()`. */
  render(): void {
    if (this.destroyed) return;
    this.ctx.clear();
    for (const l of this.layers) {
      if (!l.visible) continue;
      l.draw(this.ctx, this.viewport);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.detachPointerListeners();
    if (this.rafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.tvChart.timeScale().unsubscribeVisibleLogicalRangeChange(this.onLogical);
    if (this.onCrosshair && this.tvChart.unsubscribeCrosshairMove) {
      this.tvChart.unsubscribeCrosshairMove(this.onCrosshair);
    }
    this.canvas.parentElement?.removeChild(this.canvas);
    this.viewport.bus.clear();
  }

  // -- private --------------------------------------------------------------

  private attachPointerListeners(): void {
    if (this.pointerListeners.length) return; // already attached
    const down = (ev: Event): void => this.dispatchPointer('down', ev as PointerEvent);
    const move = (ev: Event): void => this.dispatchPointer('move', ev as PointerEvent);
    const up = (ev: Event): void => this.dispatchPointer('up', ev as PointerEvent);
    const cancel = (ev: Event): void => this.dispatchPointer('up', ev as PointerEvent);
    // Suppress the browser context menu so right-click can finalize a polygon.
    // The matching `pointerdown` (button === 2) fires alongside and carries
    // the signal the drawing overlay reads.
    const ctx = (ev: Event): void => ev.preventDefault();
    const add = (type: string, fn: EventListener): void => {
      this.canvas.addEventListener(type, fn);
      this.pointerListeners.push({ type, fn });
    };
    add('pointerdown', down as EventListener);
    add('pointermove', move as EventListener);
    add('pointerup', up as EventListener);
    add('pointercancel', cancel as EventListener);
    add('contextmenu', ctx as EventListener);
  }

  private detachPointerListeners(): void {
    for (const { type, fn } of this.pointerListeners) {
      this.canvas.removeEventListener(type, fn);
    }
    this.pointerListeners = [];
  }

  /**
   * Translate a DOM pointer event into a `LayerPointerEvent` (canvas-local
   * CSS pixels) and dispatch to layers implementing the matching handler,
   * topmost (highest zIndex) first.
   */
  private dispatchPointer(kind: 'down' | 'move' | 'up', ev: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const le: LayerPointerEvent = {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      source: ev,
    };
    // Descending zIndex: front layer gets first crack. `layers` is kept
    // ascending by addLayer, so iterate in reverse.
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i]!;
      if (!l.visible) continue;
      const handler =
        kind === 'down' ? l.onPointerDown : kind === 'move' ? l.onPointerMove : l.onPointerUp;
      if (handler) handler.call(l, le);
    }
  }

  private handleResize(): void {
    const rect = this.chartElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w > 0 && h > 0) {
      // Position the overlay over the chart element, in container-local
      // coordinates. Cheaper than absolute-fixed positioning.
      const containerRect = this.container.getBoundingClientRect();
      this.canvas.style.left = `${rect.left - containerRect.left}px`;
      this.canvas.style.top = `${rect.top - containerRect.top}px`;
      this.ctx.resize(w, h);
      this.syncViewportDomain();
      this.invalidate();
    }
  }

  private syncViewportDomain(): void {
    const xd = this.xScale.domain();
    if (isFinite(xd[0]) && isFinite(xd[1])) {
      this.viewport.setXDomain(xd);
    }
  }
}
