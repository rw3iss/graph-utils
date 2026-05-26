/**
 * Stateless drawing primitives. Pure functions taking a CanvasRenderingContext2D.
 *
 * Anything that mutates ctx state wraps in save/restore. Coordinates are CSS
 * pixels (callers are expected to use CanvasContext, which applies the DPR
 * transform; primitives don't know or care about DPR).
 */

export interface Point {
  x: number;
  y: number;
}

export interface FillStroke {
  fill?: string | CanvasGradient | CanvasPattern;
  stroke?: string;
  lineWidth?: number;
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
  color: string,
  width: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

export function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options: FillStroke = {},
): void {
  ctx.save();
  if (options.fill !== undefined) {
    ctx.fillStyle = options.fill;
    ctx.fillRect(x, y, w, h);
  }
  if (options.stroke !== undefined) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.lineWidth ?? 1;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  options: FillStroke = {},
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (options.fill !== undefined) {
    ctx.fillStyle = options.fill;
    ctx.fill();
  }
  if (options.stroke !== undefined) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.lineWidth ?? 1;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<Point>,
  color: string,
  width: number,
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

export function drawPath(
  ctx: CanvasRenderingContext2D,
  fn: (ctx: CanvasRenderingContext2D) => void,
  options: { fill?: string; stroke?: string; lineWidth?: number } = {},
): void {
  ctx.save();
  ctx.beginPath();
  fn(ctx);
  if (options.fill !== undefined) {
    ctx.fillStyle = options.fill;
    ctx.fill();
  }
  if (options.stroke !== undefined) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.lineWidth ?? 1;
    ctx.stroke();
  }
  ctx.restore();
}

export interface TextOptions {
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  angle?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: TextOptions = {},
): void {
  ctx.save();
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
