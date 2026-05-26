/**
 * OrderMarkers
 *
 * Renders executed-order markers at (ts, fillPrice) with a small filled
 * diamond and an optional size label.
 *
 * Data shape: { ts, side: 'buy'|'sell', price, qty?, status?, label? }[]
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export interface Order {
  ts: number;
  side: 'buy' | 'sell';
  price: number;
  qty?: number;
  status?: 'filled' | 'pending' | 'cancelled';
  label?: string;
}

export interface OrderMarkersOptions extends OverlayOptions {
  size?: number;
  buyColor?: string;
  sellColor?: string;
  pendingAlpha?: number;
  labelFont?: string;
  labelColor?: string;
}

export class OrderMarkers extends OverlayBase<Order[]> {
  size: number;
  buyColor: string;
  sellColor: string;
  pendingAlpha: number;
  labelFont: string;
  labelColor: string;

  constructor(adapter: Adapter, options: OrderMarkersOptions) {
    super(adapter, options);
    this.size = options.size ?? 6;
    this.buyColor = options.buyColor ?? '#22c55e';
    this.sellColor = options.sellColor ?? '#ef4444';
    this.pendingAlpha = options.pendingAlpha ?? 0.5;
    this.labelFont = options.labelFont ?? '10px sans-serif';
    this.labelColor = options.labelColor ?? '#ddd';
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const data = this.data;
    if (!data) return;
    for (const o of data) {
      const { x, y } = this.adapter.toPixel(o.ts, o.price);
      const base = o.side === 'buy' ? this.buyColor : this.sellColor;
      const fill = o.status === 'pending' ? withAlpha(base, this.pendingAlpha) : base;
      const stroke = o.status === 'cancelled' ? '#888' : undefined;
      ctx.path(
        (c) => {
          c.moveTo(x, y - this.size);
          c.lineTo(x + this.size, y);
          c.lineTo(x, y + this.size);
          c.lineTo(x - this.size, y);
          c.closePath();
        },
        { fill, stroke, lineWidth: stroke ? 1 : undefined },
      );
      if (o.label) {
        ctx.text(o.label, x + this.size + 3, y, {
          font: this.labelFont,
          color: this.labelColor,
          align: 'left',
          baseline: 'middle',
        });
      }
    }
  }
}

function withAlpha(hex: string, alpha: number): string {
  // accepts #rgb, #rrggbb, or rgb()/rgba() — fall through with `rgba(...)` wrap
  if (hex.startsWith('#')) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex; // give up — caller passed a non-hex color
}
