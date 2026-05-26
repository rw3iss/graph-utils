/**
 * ThresholdBand
 *
 * Translucent horizontal band between two Y values. Useful for RSI
 * overbought/oversold (30/70), volatility bands, target-zone shading.
 *
 * Data shape: `{ yMin, yMax, fill?, stroke?, label? }`.
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export interface ThresholdBandSpec {
  yMin: number;
  yMax: number;
  fill?: string;
  stroke?: string;
  label?: string;
}

export interface ThresholdBandOptions extends OverlayOptions {
  fill?: string;
  stroke?: string;
  labelFont?: string;
  labelColor?: string;
}

export class ThresholdBand extends OverlayBase<ThresholdBandSpec> {
  fill: string;
  stroke: string | undefined;
  labelFont: string;
  labelColor: string;

  constructor(adapter: Adapter, options: ThresholdBandOptions) {
    super(adapter, options);
    this.fill = options.fill ?? 'rgba(244,114,182,0.10)';
    this.stroke = options.stroke;
    this.labelFont = options.labelFont ?? '10px sans-serif';
    this.labelColor = options.labelColor ?? 'rgba(255,255,255,0.6)';
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const d = this.data;
    if (!d) return;
    const y1 = this.adapter.toPixel(0, d.yMin).y;
    const y2 = this.adapter.toPixel(0, d.yMax).y;
    if (!isFinite(y1) || !isFinite(y2)) return;
    const top = Math.min(y1, y2);
    const bot = Math.max(y1, y2);
    ctx.rect(0, top, ctx.width, bot - top, {
      fill: d.fill ?? this.fill,
      stroke: d.stroke ?? this.stroke,
      lineWidth: d.stroke || this.stroke ? 1 : undefined,
    });
    if (d.label) {
      ctx.text(d.label, 4, top + 2, {
        font: this.labelFont,
        color: this.labelColor,
        align: 'left',
        baseline: 'top',
      });
    }
  }
}
