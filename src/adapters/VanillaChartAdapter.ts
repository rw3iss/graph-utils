/**
 * VanillaChartAdapter
 *
 * Wraps a Chart so overlays consume the same Adapter contract whether the
 * host is our own Chart or (v0.2) a TradingView pane.
 */
import type { Chart } from '../chart/Chart.js';
import type { Layer } from '../chart/Layer.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from './Adapter.js';

export class VanillaChartAdapter implements Adapter {
  readonly chart: Chart;

  constructor(chart: Chart) {
    this.chart = chart;
  }

  getCanvas(): HTMLCanvasElement {
    return this.chart.canvas;
  }

  getViewport(): Viewport {
    return this.chart.viewport;
  }

  addLayer(layer: Layer): void {
    this.chart.addLayer(layer);
  }

  removeLayer(idOrLayer: string | Layer): void {
    this.chart.removeLayer(idOrLayer);
  }

  invalidate(): void {
    this.chart.invalidate();
  }

  toPixel(x: number, y: number): { x: number; y: number } {
    return { x: this.chart.xScale.scale(x), y: this.chart.yScale.scale(y) };
  }

  toData(px: number, py: number): { x: number; y: number } {
    return { x: this.chart.xScale.invert(px), y: this.chart.yScale.invert(py) };
  }
}
