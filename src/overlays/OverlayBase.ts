/**
 * OverlayBase
 *
 * Bridges Layer (Chart-side) with Adapter (consumer-side). Concrete overlays
 * extend this, store their data, override `draw(ctx, viewport)`.
 *
 * Use `this.adapter.toPixel(x, y)` to convert data → pixel — never hardcode.
 */
import { Layer } from '../chart/Layer.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export interface OverlayOptions {
  id: string;
  zIndex?: number;
  visible?: boolean;
}

export abstract class OverlayBase<TData = unknown> extends Layer {
  protected adapter: Adapter;
  protected data: TData | null = null;

  constructor(adapter: Adapter, options: OverlayOptions) {
    super(options.id);
    this.adapter = adapter;
    this.zIndex = options.zIndex ?? 0;
    this.visible = options.visible ?? true;
  }

  setData(data: TData): this {
    this.data = data;
    this.adapter.invalidate();
    return this;
  }

  getData(): TData | null {
    return this.data;
  }

  abstract override draw(ctx: CanvasContext, viewport: Viewport): void;
}
