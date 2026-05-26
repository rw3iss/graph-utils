/**
 * CanvasContext
 *
 * Thin DPR-aware wrapper around a CanvasRenderingContext2D.
 *
 * - Owns the canvas element, tracks devicePixelRatio.
 * - Backing buffer is always (cssWidth * DPR, cssHeight * DPR); a single
 *   ctx.scale(DPR, DPR) at the top of every draw cycle means callers
 *   work entirely in CSS pixels.
 * - `resize()` reconciles the backing buffer with the current CSS size;
 *   callers (typically Chart / TradingViewOverlayAdapter) invoke it from
 *   a ResizeObserver.
 * - All drawing helpers are conveniences that delegate to primitives.ts.
 * - Every visible-mark helper accepts a single `DrawStyle` options object —
 *   geometry stays positional. See `primitives.ts → DrawStyle` for the
 *   unified shape.
 */
import {
  clearRect,
  drawLine,
  drawRect,
  drawCircle,
  drawPolyline,
  drawPath,
  drawText,
  createLinearGradient,
  type Point,
  type DrawStyle,
} from './primitives.js';

export interface CanvasContextOptions {
  /** Force a specific DPR (mostly for tests). Defaults to window.devicePixelRatio. */
  dpr?: number;
}

export interface TextStyle {
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Rotation in degrees, applied around the anchor (x, y). */
  angle?: number;
  /** Optional alpha (0..1). */
  alpha?: number;
}

export class CanvasContext {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private _dpr: number;
  private _cssWidth = 0;
  private _cssHeight = 0;

  constructor(canvas: HTMLCanvasElement, options: CanvasContextOptions = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('CanvasContext: failed to acquire 2d context');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this._dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ?? 1;
    // initial sync to current attribute size, if any
    const cssW = canvas.clientWidth || canvas.width || 0;
    const cssH = canvas.clientHeight || canvas.height || 0;
    this.resize(cssW, cssH);
  }

  get dpr(): number {
    return this._dpr;
  }

  get width(): number {
    return this._cssWidth;
  }

  get height(): number {
    return this._cssHeight;
  }

  /**
   * Reconcile backing buffer with CSS size. Idempotent.
   * Applies a setTransform so all subsequent drawing is in CSS pixels.
   */
  resize(cssWidth: number, cssHeight: number, dpr?: number): void {
    if (dpr !== undefined) this._dpr = dpr;
    this._cssWidth = cssWidth;
    this._cssHeight = cssHeight;
    const buffW = Math.max(1, Math.floor(cssWidth * this._dpr));
    const buffH = Math.max(1, Math.floor(cssHeight * this._dpr));
    if (this.canvas.width !== buffW) this.canvas.width = buffW;
    if (this.canvas.height !== buffH) this.canvas.height = buffH;
    // Set CSS size too, so callers don't have to.
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    // identity → DPR scale
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
  }

  /** Save / restore wrap helper for layered clipping. */
  withClip(x: number, y: number, w: number, h: number, fn: () => void): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    try {
      fn();
    } finally {
      this.ctx.restore();
    }
  }

  // ---- thin delegates over primitives ----------------------------------
  // Uniform shape: positional geometry, one DrawStyle options bag.

  clear(): void {
    clearRect(this.ctx, 0, 0, this._cssWidth, this._cssHeight);
  }

  line(x1: number, y1: number, x2: number, y2: number, opts: DrawStyle = {}): void {
    drawLine(this.ctx, x1, y1, x2, y2, opts);
  }

  rect(x: number, y: number, w: number, h: number, opts: DrawStyle = {}): void {
    drawRect(this.ctx, x, y, w, h, opts);
  }

  circle(x: number, y: number, r: number, opts: DrawStyle = {}): void {
    drawCircle(this.ctx, x, y, r, opts);
  }

  polyline(points: Point[], opts: DrawStyle = {}): void {
    drawPolyline(this.ctx, points, opts);
  }

  path(fn: (ctx: CanvasRenderingContext2D) => void, opts: DrawStyle = {}): void {
    drawPath(this.ctx, fn, opts);
  }

  text(text: string, x: number, y: number, style: TextStyle = {}): void {
    drawText(this.ctx, text, x, y, style);
  }

  gradient(x1: number, y1: number, x2: number, y2: number, stops: string[]): CanvasGradient {
    return createLinearGradient(this.ctx, x1, y1, x2, y2, stops);
  }
}
