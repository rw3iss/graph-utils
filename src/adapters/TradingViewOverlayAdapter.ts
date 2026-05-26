/**
 * TradingViewOverlayAdapter — STUB for v0.1.0.
 *
 * The shape is here so overlay authors can write to a stable Adapter
 * interface, but the actual TradingView wiring (subscribing to the chart's
 * timeScale + priceScale, syncing a transparent canvas above the pane,
 * forwarding DPR resize) needs API exploration against real TV objects
 * and lands in v0.2. See README → Roadmap.
 *
 * Calling any method throws so an integrator using the stub by mistake
 * gets a loud failure rather than silent no-ops.
 *
 * Real impl outline (v0.2):
 *   - Accept the IChartApi + ISeriesApi from `lightweight-charts`
 *   - Overlay a transparent <canvas> on top of the pane element (same DPR)
 *   - On every TV `timeScale().subscribeVisibleLogicalRangeChange`, sync
 *     our Viewport.xDomain
 *   - For Y, expose a `priceToCoordinate`-based projection via toPixel
 *   - Forward pointer events from the overlay canvas through TV's pane
 */
// reason: stub — types are scaffolding; real types in v0.2 will come from `lightweight-charts`.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Layer } from '../chart/Layer.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from './Adapter.js';

export interface TradingViewOverlayAdapterOptions {
  /** Lightweight-charts IChartApi. Typed loosely until v0.2. */
  // reason: stub — see file header.
  chart: any;
  /** Lightweight-charts ISeriesApi. */
  // reason: stub — see file header.
  series: any;
  /** HTMLElement wrapping the pane (we mount our overlay canvas inside). */
  container: HTMLElement;
}

export class TradingViewOverlayAdapter implements Adapter {
  readonly options: TradingViewOverlayAdapterOptions;

  constructor(options: TradingViewOverlayAdapterOptions) {
    this.options = options;
  }

  private notImplemented(method: string): never {
    throw new Error(
      `TradingViewOverlayAdapter.${method}() is not implemented in v0.1.0; targeted for v0.2. ` +
        `Use VanillaChartAdapter for now.`,
    );
  }

  getCanvas(): HTMLCanvasElement {
    return this.notImplemented('getCanvas');
  }

  getViewport(): Viewport {
    return this.notImplemented('getViewport');
  }

  addLayer(_layer: Layer): void {
    return this.notImplemented('addLayer');
  }

  removeLayer(_idOrLayer: string | Layer): void {
    return this.notImplemented('removeLayer');
  }

  invalidate(): void {
    return this.notImplemented('invalidate');
  }

  toPixel(_x: number, _y: number): { x: number; y: number } {
    return this.notImplemented('toPixel');
  }

  toData(_px: number, _py: number): { x: number; y: number } {
    return this.notImplemented('toData');
  }
}
