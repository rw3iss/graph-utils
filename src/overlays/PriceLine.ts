/**
 * PriceLine
 *
 * Horizontal line at a given price level, with an optional right-edge
 * label box (the standard limit-/stop-/take-profit marker treatment).
 *
 * Data shape: a single number price OR
 *   `{ price, label?, color?, lineDash?, labelBg?, labelColor? }`.
 *
 * You can stack several PriceLine instances for a bracket — they're
 * cheap (one stroke + one optional rounded rect per layer).
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export interface PriceLineSpec {
  price: number;
  label?: string;
  color?: string;
  lineDash?: number[];
  labelBg?: string;
  labelColor?: string;
}

export interface PriceLineOptions extends OverlayOptions {
  color?: string;
  lineWidth?: number;
  lineDash?: number[];
  labelFont?: string;
  labelBg?: string;
  labelColor?: string;
  /** Horizontal pad inside the label box. */
  labelPad?: number;
}

export class PriceLine extends OverlayBase<PriceLineSpec> {
  color: string;
  lineWidth: number;
  lineDash: number[];
  labelFont: string;
  labelBg: string;
  labelColor: string;
  labelPad: number;

  constructor(adapter: Adapter, options: PriceLineOptions) {
    super(adapter, options);
    this.color = options.color ?? '#888';
    this.lineWidth = options.lineWidth ?? 1;
    this.lineDash = options.lineDash ?? [4, 3];
    this.labelFont = options.labelFont ?? '10px sans-serif';
    this.labelBg = options.labelBg ?? 'rgba(0,0,0,0.7)';
    this.labelColor = options.labelColor ?? '#fff';
    this.labelPad = options.labelPad ?? 4;
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const d = this.data;
    if (!d) return;
    const { y } = this.adapter.toPixel(0, d.price);
    if (!isFinite(y)) return;
    const stroke = d.color ?? this.color;
    ctx.line(0, y, ctx.width, y, {
      stroke,
      lineWidth: this.lineWidth,
      lineDash: d.lineDash ?? this.lineDash,
    });
    const text = d.label;
    if (text) {
      ctx.text(text, ctx.width - this.labelPad, y - 2, {
        font: this.labelFont,
        color: d.labelColor ?? this.labelColor,
        align: 'right',
        baseline: 'bottom',
      });
    }
  }
}
