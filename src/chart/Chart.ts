/**
 * Chart
 *
 * High-level host owning:
 *   - a CanvasContext (DPR-aware)
 *   - a Viewport (data window)
 *   - X / Y Scales pinned to the plot area + viewport
 *   - a z-ordered list of Layers
 *   - the interaction loop (pan / zoom on the canvas element)
 *   - a ResizeObserver that resyncs the canvas backing buffer
 *
 * Default layers (axes + grid) are added automatically; toggle via `axes`,
 * `grid` options.
 */
import { CanvasContext } from '../core/CanvasContext.js';
import { Viewport, type ViewportOptions } from '../core/Viewport.js';
import { LinearScale, type Scale } from '../core/Scale.js';
import { AxisLayer, GridLayer, Layer, type LayerPointerEvent } from './Layer.js';
import { attachInteractions, type InteractionOptions } from './interactions.js';

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartOptions extends ViewportOptions {
  padding?: Partial<ChartPadding>;
  axes?: boolean;
  grid?: boolean;
  interactions?: InteractionOptions | false;
  xScale?: Scale;
  yScale?: Scale;
  xTickFormatter?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  /** Background color drawn before layers. `null` = no background. */
  background?: string | null;
}

const DEFAULT_PADDING: ChartPadding = { top: 12, right: 16, bottom: 28, left: 48 };

export class Chart {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasContext;
  readonly viewport: Viewport;
  readonly xScale: Scale;
  readonly yScale: Scale;

  padding: ChartPadding;
  background: string | null;

  private layers: Layer[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private detachInteractions: (() => void) | null = null;
  private rafHandle: number | null = null;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, options: ChartOptions) {
    this.canvas = canvas;
    this.ctx = new CanvasContext(canvas);
    this.padding = { ...DEFAULT_PADDING, ...(options.padding ?? {}) };
    this.background = options.background ?? null;
    this.viewport = new Viewport(options);

    this.xScale = options.xScale ?? new LinearScale(this.viewport.xDomain, [0, 0]);
    // pixel Y is inverted relative to data Y → range [bottom, top]
    this.yScale = options.yScale ?? new LinearScale(this.viewport.yDomain, [0, 0]);
    this.refreshScales();

    if (options.grid !== false) {
      const grid = new GridLayer(
        '__grid__',
        () => this.xScale,
        () => this.yScale,
        () => this.plotBounds(),
      );
      this.addLayer(grid);
    }
    if (options.axes !== false) {
      const bottomAxis = new AxisLayer(
        '__axis-x__',
        'bottom',
        () => this.xScale,
        () => this.plotBounds(),
      );
      const leftAxis = new AxisLayer(
        '__axis-y__',
        'left',
        () => this.yScale,
        () => this.plotBounds(),
      );
      if (options.xTickFormatter) bottomAxis.formatter = options.xTickFormatter;
      if (options.yTickFormatter) leftAxis.formatter = options.yTickFormatter;
      this.addLayer(bottomAxis);
      this.addLayer(leftAxis);
    }

    if (options.interactions !== false) {
      this.detachInteractions = attachInteractions(
        canvas,
        this.viewport,
        () => ({ width: this.plotWidth(), height: this.plotHeight() }),
        options.interactions ?? {},
      );
    }

    this.viewport.bus.on('change', () => {
      this.refreshScales();
      this.invalidate();
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(canvas);
    }
    this.handleResize();
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

  getLayers(): ReadonlyArray<Layer> {
    return this.layers;
  }

  /** Request a redraw on the next animation frame. */
  invalidate(): void {
    if (this.rafHandle !== null || this.destroyed) return;
    if (typeof requestAnimationFrame === 'undefined') {
      // SSR / node test: skip
      return;
    }
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.render();
    });
  }

  /** Synchronous draw of all visible layers. */
  render(): void {
    if (this.destroyed) return;
    this.ctx.clear();
    if (this.background !== null) {
      this.ctx.rect(0, 0, this.ctx.width, this.ctx.height, { fill: this.background });
    }
    for (const l of this.layers) {
      if (!l.visible) continue;
      l.draw(this.ctx, this.viewport);
    }
  }

  /** Top-left and bottom-right of the plot area in CSS pixels. */
  plotBounds(): { left: number; top: number; right: number; bottom: number } {
    return {
      left: this.padding.left,
      top: this.padding.top,
      right: this.ctx.width - this.padding.right,
      bottom: this.ctx.height - this.padding.bottom,
    };
  }

  plotWidth(): number {
    return Math.max(0, this.ctx.width - this.padding.left - this.padding.right);
  }

  plotHeight(): number {
    return Math.max(0, this.ctx.height - this.padding.top - this.padding.bottom);
  }

  /** Dispatch a synthetic pointer event to layers (Chart calls this itself). */
  dispatchPointerMove(e: LayerPointerEvent): void {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i]!;
      if (l.visible && l.onPointerMove) l.onPointerMove(e);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.detachInteractions) {
      this.detachInteractions();
      this.detachInteractions = null;
    }
    this.viewport.bus.clear();
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.clientWidth;
    const h = rect.height || this.canvas.clientHeight;
    if (w > 0 && h > 0) {
      this.ctx.resize(w, h);
      this.refreshScales();
      this.invalidate();
    }
  }

  private refreshScales(): void {
    const b = this.plotBounds();
    this.xScale.setDomain(this.viewport.xDomain);
    this.xScale.setRange([b.left, b.right]);
    this.yScale.setDomain(this.viewport.yDomain);
    // invert: data grows up, pixel grows down
    this.yScale.setRange([b.bottom, b.top]);
  }
}
