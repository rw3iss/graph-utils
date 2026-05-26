/**
 * SignalArrows
 *
 * Renders an upward or downward arrow at each signal's (ts, price).
 *   - buy  → green ↑ below the price
 *   - sell → red   ↓ above the price
 *
 * Data shape: { ts, side: 'buy'|'sell', price, label? }[]
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export interface Signal {
  ts: number;
  side: 'buy' | 'sell';
  price: number;
  label?: string;
}

export interface SignalArrowsOptions extends OverlayOptions {
  size?: number;
  /** offset in pixels from the price point along the arrow's axis. */
  offset?: number;
  buyColor?: string;
  sellColor?: string;
  labelFont?: string;
  labelColor?: string;
}

export class SignalArrows extends OverlayBase<Signal[]> {
  size: number;
  offset: number;
  buyColor: string;
  sellColor: string;
  labelFont: string;
  labelColor: string;

  constructor(adapter: Adapter, options: SignalArrowsOptions) {
    super(adapter, options);
    this.size = options.size ?? 8;
    this.offset = options.offset ?? 10;
    this.buyColor = options.buyColor ?? '#16a34a';
    this.sellColor = options.sellColor ?? '#dc2626';
    this.labelFont = options.labelFont ?? '10px sans-serif';
    this.labelColor = options.labelColor ?? '#ddd';
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const data = this.data;
    if (!data) return;
    for (const s of data) {
      const { x, y } = this.adapter.toPixel(s.ts, s.price);
      const color = s.side === 'buy' ? this.buyColor : this.sellColor;
      drawArrow(ctx, x, y, s.side, this.size, this.offset, color);
      if (s.label) {
        const ty = s.side === 'buy' ? y + this.offset + this.size + 10 : y - this.offset - this.size - 6;
        ctx.text(s.label, x, ty, {
          font: this.labelFont,
          color: this.labelColor,
          align: 'center',
          baseline: s.side === 'buy' ? 'top' : 'bottom',
        });
      }
    }
  }
}

function drawArrow(
  ctx: CanvasContext,
  px: number,
  py: number,
  side: 'buy' | 'sell',
  size: number,
  offset: number,
  color: string,
): void {
  // buy: arrow pointing UP, drawn BELOW price
  // sell: arrow pointing DOWN, drawn ABOVE price
  const tip = side === 'buy' ? py + offset : py - offset;
  const tail = side === 'buy' ? tip + size * 2 : tip - size * 2;
  ctx.path(
    (c) => {
      c.moveTo(px, tip);
      c.lineTo(px - size, tail);
      c.lineTo(px + size, tail);
      c.closePath();
    },
    { fill: color },
  );
}
