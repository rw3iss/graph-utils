/**
 * ZoneBoxes
 *
 * Translucent rectangles spanning a time window and price range.
 * Useful for regime shading, S/R zones, backtest selection bands.
 *
 * Data shape: { from, to, yMin, yMax, fill, stroke? }[]
 *   - from / to are data-space X (typically ms timestamps)
 *   - yMin / yMax are data-space Y
 *   - if yMin or yMax is undefined → zone spans the full Y viewport
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export interface Zone {
  from: number;
  to: number;
  yMin?: number;
  yMax?: number;
  fill: string;
  stroke?: string;
  label?: string;
}

export interface ZoneBoxesOptions extends OverlayOptions {
  labelFont?: string;
  labelColor?: string;
}

export class ZoneBoxes extends OverlayBase<Zone[]> {
  labelFont: string;
  labelColor: string;

  constructor(adapter: Adapter, options: ZoneBoxesOptions) {
    super(adapter, options);
    this.labelFont = options.labelFont ?? '10px sans-serif';
    this.labelColor = options.labelColor ?? 'rgba(255,255,255,0.75)';
  }

  draw(ctx: CanvasContext, vp: Viewport): void {
    const data = this.data;
    if (!data) return;
    const [yLo, yHi] = vp.yDomain;
    for (const z of data) {
      const x1 = this.adapter.toPixel(z.from, 0).x;
      const x2 = this.adapter.toPixel(z.to, 0).x;
      const top = this.adapter.toPixel(0, z.yMax ?? yHi).y;
      const bot = this.adapter.toPixel(0, z.yMin ?? yLo).y;
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const yTop = Math.min(top, bot);
      const yBot = Math.max(top, bot);
      ctx.rect(left, yTop, right - left, yBot - yTop, {
        fill: z.fill,
        stroke: z.stroke,
        lineWidth: z.stroke ? 1 : undefined,
      });
      if (z.label) {
        ctx.text(z.label, left + 4, yTop + 4, {
          font: this.labelFont,
          color: this.labelColor,
          align: 'left',
          baseline: 'top',
        });
      }
    }
  }
}
