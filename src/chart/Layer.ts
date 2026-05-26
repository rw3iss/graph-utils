/**
 * Layer
 *
 * Smallest drawable unit a Chart composes. A Layer:
 *   - draws to a CanvasContext, given a Viewport
 *   - may opt into pointer events
 *
 * Layers are z-ordered; Chart owns the list. Each Layer is responsible for
 * its own data; Chart never reaches in.
 */
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';

export interface LayerPointerEvent {
  /** CSS-pixel coords relative to the canvas. */
  x: number;
  y: number;
  /** Underlying DOM event for modifier keys etc. */
  source: PointerEvent | WheelEvent;
}

export abstract class Layer {
  readonly id: string;
  visible = true;
  /** Higher zIndex draws on top; default 0. */
  zIndex = 0;

  constructor(id: string) {
    this.id = id;
  }

  /** Called once per render. Implementations should be idempotent. */
  abstract draw(ctx: CanvasContext, viewport: Viewport): void;

  onPointerMove?(_e: LayerPointerEvent): void;
  onPointerDown?(_e: LayerPointerEvent): void;
  onPointerUp?(_e: LayerPointerEvent): void;
}

/**
 * Built-in grid: light lines at each tick of the X and Y scales.
 * Driven by callbacks so the Chart can supply the right Scale instances.
 */
export class GridLayer extends Layer {
  color = 'rgba(128,128,128,0.18)';
  lineWidth = 1;
  private readonly xScale: () => { ticks(n: number): number[]; scale(v: number): number };
  private readonly yScale: () => { ticks(n: number): number[]; scale(v: number): number };
  private readonly bounds: () => { left: number; top: number; right: number; bottom: number };
  private readonly tickCount: { x: number; y: number };

  constructor(
    id: string,
    xScale: () => { ticks(n: number): number[]; scale(v: number): number },
    yScale: () => { ticks(n: number): number[]; scale(v: number): number },
    bounds: () => { left: number; top: number; right: number; bottom: number },
    tickCount: { x: number; y: number } = { x: 8, y: 5 },
  ) {
    super(id);
    this.xScale = xScale;
    this.yScale = yScale;
    this.bounds = bounds;
    this.tickCount = tickCount;
    this.zIndex = -100;
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const b = this.bounds();
    const xs = this.xScale();
    const ys = this.yScale();
    for (const tx of xs.ticks(this.tickCount.x)) {
      const x = xs.scale(tx);
      if (x < b.left || x > b.right) continue;
      ctx.line(x, b.top, x, b.bottom, { stroke: this.color, lineWidth: this.lineWidth });
    }
    for (const ty of ys.ticks(this.tickCount.y)) {
      const y = ys.scale(ty);
      if (y < b.top || y > b.bottom) continue;
      ctx.line(b.left, y, b.right, y, { stroke: this.color, lineWidth: this.lineWidth });
    }
  }
}

/**
 * Built-in axis layer (one per axis side).
 */
export class AxisLayer extends Layer {
  color = '#aaa';
  font = '11px sans-serif';
  tickCount = 6;
  formatter: (v: number) => string = (v) => String(v);
  private readonly side: 'bottom' | 'left';
  private readonly scale: () => { ticks(n: number): number[]; scale(v: number): number };
  private readonly bounds: () => { left: number; top: number; right: number; bottom: number };

  constructor(
    id: string,
    side: 'bottom' | 'left',
    scale: () => { ticks(n: number): number[]; scale(v: number): number },
    bounds: () => { left: number; top: number; right: number; bottom: number },
  ) {
    super(id);
    this.side = side;
    this.scale = scale;
    this.bounds = bounds;
    this.zIndex = 100;
  }

  draw(ctx: CanvasContext, _vp: Viewport): void {
    const b = this.bounds();
    const s = this.scale();
    const stroke = { stroke: this.color, lineWidth: 1 };
    if (this.side === 'bottom') {
      ctx.line(b.left, b.bottom, b.right, b.bottom, stroke);
      for (const t of s.ticks(this.tickCount)) {
        const x = s.scale(t);
        if (x < b.left || x > b.right) continue;
        ctx.line(x, b.bottom, x, b.bottom + 4, stroke);
        ctx.text(this.formatter(t), x, b.bottom + 6, {
          font: this.font,
          color: this.color,
          align: 'center',
          baseline: 'top',
        });
      }
    } else {
      ctx.line(b.left, b.top, b.left, b.bottom, stroke);
      for (const t of s.ticks(this.tickCount)) {
        const y = s.scale(t);
        if (y < b.top || y > b.bottom) continue;
        ctx.line(b.left - 4, y, b.left, y, stroke);
        ctx.text(this.formatter(t), b.left - 6, y, {
          font: this.font,
          color: this.color,
          align: 'right',
          baseline: 'middle',
        });
      }
    }
  }
}
