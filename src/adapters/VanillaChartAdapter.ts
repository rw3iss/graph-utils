/**
 * VanillaChartAdapter
 *
 * Wraps a Chart so overlays consume the same Adapter contract whether the
 * host is our own Chart or a TradingView pane.
 *
 * Interaction: the Chart's canvas is already pointer-interactive (it owns
 * pan/zoom via `attachInteractions`). `setInteractive(true)` attaches an
 * extra listener set that forwards `pointerdown/move/up` to the chart's
 * layers' `onPointerDown/Move/Up` handlers (topmost zIndex first), and
 * `contextmenu` is suppressed so a right-click can finalize a polygon. The
 * canvas stays pointer-interactive either way, so pan/zoom is unaffected.
 */
import type { Chart } from '../chart/Chart.js';
import type { Layer, LayerPointerEvent } from '../chart/Layer.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from './Adapter.js';

export class VanillaChartAdapter implements Adapter {
  readonly chart: Chart;

  private interactive = false;
  private pointerListeners: Array<{ type: string; fn: EventListener }> = [];

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

  setInteractive(on: boolean): void {
    if (on === this.interactive) return;
    this.interactive = on;
    if (on) this.attachPointerListeners();
    else this.detachPointerListeners();
  }

  getInteractive(): boolean {
    return this.interactive;
  }

  // -- private --------------------------------------------------------------

  private attachPointerListeners(): void {
    if (this.pointerListeners.length) return;
    const canvas = this.chart.canvas;
    const down = (ev: Event): void => this.dispatchPointer('down', ev as PointerEvent);
    const move = (ev: Event): void => this.dispatchPointer('move', ev as PointerEvent);
    const up = (ev: Event): void => this.dispatchPointer('up', ev as PointerEvent);
    const cancel = (ev: Event): void => this.dispatchPointer('up', ev as PointerEvent);
    const ctx = (ev: Event): void => ev.preventDefault();
    const add = (type: string, fn: EventListener): void => {
      canvas.addEventListener(type, fn);
      this.pointerListeners.push({ type, fn });
    };
    add('pointerdown', down as EventListener);
    add('pointermove', move as EventListener);
    add('pointerup', up as EventListener);
    add('pointercancel', cancel as EventListener);
    add('contextmenu', ctx as EventListener);
  }

  private detachPointerListeners(): void {
    const canvas = this.chart.canvas;
    for (const { type, fn } of this.pointerListeners) {
      canvas.removeEventListener(type, fn);
    }
    this.pointerListeners = [];
  }

  private dispatchPointer(kind: 'down' | 'move' | 'up', ev: PointerEvent): void {
    const rect = this.chart.canvas.getBoundingClientRect();
    const le: LayerPointerEvent = {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      source: ev,
    };
    const layers = this.chart.getLayers();
    // Topmost (highest zIndex) first. getLayers() is kept ascending.
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]!;
      if (!l.visible) continue;
      const handler =
        kind === 'down' ? l.onPointerDown : kind === 'move' ? l.onPointerMove : l.onPointerUp;
      if (handler) handler.call(l, le);
    }
  }
}
