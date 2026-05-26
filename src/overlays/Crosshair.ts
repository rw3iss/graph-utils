/**
 * Crosshair
 *
 * Vertical + horizontal line tracking the cursor, with a small data
 * readout near the cursor showing (time, price). Integrates with the
 * Adapter's pointer pipeline:
 *
 *   const cross = new Crosshair(adapter, { id: 'cross' });
 *   cross.attach(adapter.getCanvas());   // listens to pointermove/leave
 *
 * The default formatter shows ts as a UNIX-ms ISO time-of-day and price
 * to 2 decimals. Override `formatX` / `formatY` for your data.
 *
 * The crosshair listens on the canvas it's `attach`ed to. On vanilla
 * adapters that's the chart canvas. On the TV adapter the overlay canvas
 * is pointer-events: none — so consumers should attach to the TV chart
 * element instead (the parent), and translate clientX/Y into canvas
 * pixels.
 */
import { OverlayBase, type OverlayOptions } from './OverlayBase.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export interface CrosshairOptions extends OverlayOptions {
  color?: string;
  lineWidth?: number;
  lineDash?: number[];
  labelFont?: string;
  labelBg?: string;
  labelColor?: string;
  labelPad?: number;
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  /** Show readout label near the cursor. Default true. */
  showLabel?: boolean;
}

export class Crosshair extends OverlayBase<null> {
  color: string;
  lineWidth: number;
  lineDash: number[];
  labelFont: string;
  labelBg: string;
  labelColor: string;
  labelPad: number;
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  showLabel: boolean;

  private px: number | null = null;
  private py: number | null = null;
  private listenerEl: HTMLElement | null = null;
  private listeners: Array<{ ev: string; fn: EventListener }> = [];

  constructor(adapter: Adapter, options: CrosshairOptions) {
    super(adapter, options);
    this.color = options.color ?? 'rgba(255,255,255,0.4)';
    this.lineWidth = options.lineWidth ?? 1;
    this.lineDash = options.lineDash ?? [3, 3];
    this.labelFont = options.labelFont ?? '10px sans-serif';
    this.labelBg = options.labelBg ?? 'rgba(0,0,0,0.75)';
    this.labelColor = options.labelColor ?? '#fff';
    this.labelPad = options.labelPad ?? 4;
    this.formatX = options.formatX ?? defaultFormatX;
    this.formatY = options.formatY ?? defaultFormatY;
    this.showLabel = options.showLabel ?? true;
  }

  /**
   * Wire the crosshair to a pointer source. Returns a detach fn (also
   * stored internally so `destroy()` works).
   */
  attach(element: HTMLElement): () => void {
    this.listenerEl = element;
    const onMove = (ev: Event): void => {
      const pe = ev as PointerEvent;
      const rect = element.getBoundingClientRect();
      this.px = pe.clientX - rect.left;
      this.py = pe.clientY - rect.top;
      this.adapter.invalidate();
    };
    const onLeave = (): void => {
      this.px = null;
      this.py = null;
      this.adapter.invalidate();
    };
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    this.listeners.push({ ev: 'pointermove', fn: onMove });
    this.listeners.push({ ev: 'pointerleave', fn: onLeave });
    return () => this.detach();
  }

  detach(): void {
    if (!this.listenerEl) return;
    for (const { ev, fn } of this.listeners) {
      this.listenerEl.removeEventListener(ev, fn);
    }
    this.listeners = [];
    this.listenerEl = null;
  }

  /** Programmatic position (mostly for tests / synthetic events). */
  setCursor(px: number | null, py: number | null): void {
    this.px = px;
    this.py = py;
    this.adapter.invalidate();
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const px = this.px;
    const py = this.py;
    if (px === null || py === null) return;
    if (px < 0 || px > ctx.width || py < 0 || py > ctx.height) return;

    ctx.line(px, 0, px, ctx.height, {
      stroke: this.color,
      lineWidth: this.lineWidth,
      lineDash: this.lineDash,
    });
    ctx.line(0, py, ctx.width, py, {
      stroke: this.color,
      lineWidth: this.lineWidth,
      lineDash: this.lineDash,
    });

    if (!this.showLabel) return;
    const data = this.adapter.toData(px, py);
    if (!isFinite(data.x) || !isFinite(data.y)) return;
    const text = `${this.formatX(data.x)}  ${this.formatY(data.y)}`;
    const w = approxTextWidth(text, this.labelFont) + this.labelPad * 2;
    const h = 16;
    // Place near cursor but clamp inside canvas.
    let x = px + 8;
    let y = py + 8;
    if (x + w > ctx.width) x = px - w - 8;
    if (y + h > ctx.height) y = py - h - 8;
    ctx.rect(x, y, w, h, { fill: this.labelBg });
    ctx.text(text, x + this.labelPad, y + h / 2, {
      font: this.labelFont,
      color: this.labelColor,
      align: 'left',
      baseline: 'middle',
    });
  }
}

function defaultFormatX(x: number): string {
  // Heuristic: treat large positive numbers as unix timestamps.
  // ms-since-epoch range starts ~10^12; seconds ~10^9. Format both.
  if (x > 1e11) return new Date(x).toISOString().slice(11, 19);
  if (x > 1e8) return new Date(x * 1000).toISOString().slice(11, 19);
  return x.toFixed(2);
}

function defaultFormatY(y: number): string {
  return y.toFixed(2);
}

function approxTextWidth(text: string, font: string): number {
  // Rough heuristic — we can't measure without a context here. 0.55em per
  // char at the font size is good enough for hint labels.
  const m = /([\d.]+)px/.exec(font);
  const px = m ? parseFloat(m[1]!) : 10;
  return text.length * px * 0.55;
}
