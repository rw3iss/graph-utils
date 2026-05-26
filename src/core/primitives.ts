/**
 * Stateless drawing primitives. Pure functions taking a CanvasRenderingContext2D.
 *
 * Anything that mutates ctx state wraps in save/restore. Coordinates are CSS
 * pixels (callers are expected to use CanvasContext, which applies the DPR
 * transform; primitives don't know or care about DPR).
 *
 * All primitives that produce a visible mark take a single `DrawStyle`
 * options object; geometry stays positional. The shape is uniform across
 * line / rect / circle / polyline / path so call sites read consistently.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Uniform style object for all drawing primitives.
 *
 * - `fill` and `stroke` are independent — set either, both, or neither.
 *   A primitive with neither is a no-op (paths still execute their
 *   builder callback so consumers can use it for clipping, etc.).
 * - `lineWidth` defaults to 1 when stroking.
 * - `alpha` is applied via globalAlpha within a save/restore.
 * - `lineDash` is applied via setLineDash for dashed strokes.
 */
export interface DrawStyle {
  fill?: string | CanvasGradient | CanvasPattern;
  stroke?: string;
  lineWidth?: number;
  alpha?: number;
  lineDash?: number[];
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
}

/** @deprecated Kept as an alias for backward source-compatibility. Prefer `DrawStyle`. */
export type FillStroke = DrawStyle;

function applyCommon(ctx: CanvasRenderingContext2D, opts: DrawStyle): void {
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (opts.lineCap !== undefined) ctx.lineCap = opts.lineCap;
  if (opts.lineJoin !== undefined) ctx.lineJoin = opts.lineJoin;
  if (opts.lineDash !== undefined) ctx.setLineDash(opts.lineDash);
}

function applyStroke(ctx: CanvasRenderingContext2D, opts: DrawStyle): void {
  ctx.strokeStyle = opts.stroke as string;
  ctx.lineWidth = opts.lineWidth ?? 1;
  ctx.stroke();
}

function applyFill(ctx: CanvasRenderingContext2D, opts: DrawStyle): void {
  ctx.fillStyle = opts.fill as string;
  ctx.fill();
}

export function clearRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.clearRect(x, y, w, h);
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: DrawStyle = {},
): void {
  // A line with no stroke would draw nothing; default to a 1px black stroke
  // to preserve the "I just want a line" affordance.
  const stroke = opts.stroke ?? '#000';
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = opts.lineWidth ?? 1;
  ctx.stroke();
  ctx.restore();
}

export function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: DrawStyle = {},
): void {
  ctx.save();
  applyCommon(ctx, opts);
  if (opts.fill !== undefined) {
    ctx.fillStyle = opts.fill;
    ctx.fillRect(x, y, w, h);
  }
  if (opts.stroke !== undefined) {
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.lineWidth ?? 1;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  opts: DrawStyle = {},
): void {
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (opts.fill !== undefined) applyFill(ctx, opts);
  if (opts.stroke !== undefined) applyStroke(ctx, opts);
  ctx.restore();
}

export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<Point>,
  opts: DrawStyle = {},
): void {
  if (points.length < 2) return;
  const stroke = opts.stroke ?? '#000';
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  if (opts.fill !== undefined) applyFill(ctx, opts);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = opts.lineWidth ?? 1;
  ctx.stroke();
  ctx.restore();
}

export function drawPath(
  ctx: CanvasRenderingContext2D,
  fn: (ctx: CanvasRenderingContext2D) => void,
  opts: DrawStyle = {},
): void {
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  fn(ctx);
  if (opts.fill !== undefined) applyFill(ctx, opts);
  if (opts.stroke !== undefined) applyStroke(ctx, opts);
  ctx.restore();
}

export interface TextOptions {
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Rotation in degrees, applied around (x, y). */
  angle?: number;
  /** Optional alpha for the fill. */
  alpha?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: TextOptions = {},
): void {
  ctx.save();
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
  if (options.font !== undefined) ctx.font = options.font;
  if (options.color !== undefined) ctx.fillStyle = options.color;
  if (options.align !== undefined) ctx.textAlign = options.align;
  if (options.baseline !== undefined) ctx.textBaseline = options.baseline;
  if (options.angle !== undefined && options.angle !== 0) {
    ctx.translate(x, y);
    ctx.rotate((options.angle * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

export function createLinearGradient(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stops: ReadonlyArray<string>,
): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  const n = Math.max(1, stops.length - 1);
  for (let i = 0; i < stops.length; i++) {
    g.addColorStop(i / n, stops[i]!);
  }
  return g;
}
