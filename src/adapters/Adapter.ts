/**
 * Adapter
 *
 * Common interface that overlays target. Implementations exist for:
 *   - VanillaChartAdapter — wraps our own Chart
 *   - TradingViewOverlayAdapter — stub; v0.2 will sync a canvas to a TV pane
 *
 * Overlay code never imports a specific adapter — it accepts `Adapter` and
 * stays portable across both surfaces.
 */
import type { Layer } from '../chart/Layer.js';
import type { Viewport } from '../core/Viewport.js';

export interface Adapter {
  getCanvas(): HTMLCanvasElement;
  getViewport(): Viewport;
  addLayer(layer: Layer): void;
  removeLayer(idOrLayer: string | Layer): void;
  /** Request a redraw. */
  invalidate(): void;
  /** Convert data-space (x, y) into pixel coordinates. */
  toPixel(x: number, y: number): { x: number; y: number };
  /** Convert pixel coordinates back to data space. */
  toData(px: number, py: number): { x: number; y: number };
}
