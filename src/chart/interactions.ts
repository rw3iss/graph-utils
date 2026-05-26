/**
 * interactions
 *
 * Wires a canvas's pointer / wheel events to a Viewport. Per-axis enable
 * flags let callers (e.g. multi-pane Charts) disable Y pan / zoom etc.
 */
import type { Viewport } from '../core/Viewport.js';

export interface InteractionOptions {
  panX?: boolean;
  panY?: boolean;
  zoomX?: boolean;
  zoomY?: boolean;
  /** Mouse-wheel delta → zoom factor exponent. Default 0.0015. */
  wheelZoomSensitivity?: number;
  /** When true, holding shift inverts axes (Y instead of X). */
  shiftSwapsAxis?: boolean;
}

/**
 * Returns a `destroy()` to detach listeners.
 */
export function attachInteractions(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  /** width/height of plot area in CSS pixels, callable to allow resizing. */
  size: () => { width: number; height: number },
  options: InteractionOptions = {},
): () => void {
  const o = {
    panX: options.panX ?? true,
    panY: options.panY ?? true,
    zoomX: options.zoomX ?? true,
    zoomY: options.zoomY ?? false,
    wheelZoomSensitivity: options.wheelZoomSensitivity ?? 0.0015,
    shiftSwapsAxis: options.shiftSwapsAxis ?? true,
  };

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function localCoords(ev: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  const onDown = (ev: PointerEvent): void => {
    dragging = true;
    const p = localCoords(ev);
    lastX = p.x;
    lastY = p.y;
    canvas.setPointerCapture(ev.pointerId);
  };

  const onMove = (ev: PointerEvent): void => {
    if (!dragging) return;
    const p = localCoords(ev);
    const dxPx = p.x - lastX;
    const dyPx = p.y - lastY;
    lastX = p.x;
    lastY = p.y;
    const s = size();
    if (s.width <= 0 || s.height <= 0) return;
    const x = viewport.xDomain;
    const y = viewport.yDomain;
    const dxData = o.panX ? -(dxPx / s.width) * (x[1] - x[0]) : 0;
    // pixel Y grows downward; data Y grows upward → flip sign
    const dyData = o.panY ? (dyPx / s.height) * (y[1] - y[0]) : 0;
    if (dxData !== 0 || dyData !== 0) viewport.pan(dxData, dyData);
  };

  const onUp = (ev: PointerEvent): void => {
    dragging = false;
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  };

  const onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    const p = localCoords(ev);
    const s = size();
    if (s.width <= 0 || s.height <= 0) return;
    const factor = Math.exp(ev.deltaY * o.wheelZoomSensitivity);
    const useY = o.shiftSwapsAxis && ev.shiftKey;
    const anchor: { x?: number; y?: number } = {};
    if (useY) {
      if (o.zoomY) anchor.y = p.y / s.height;
    } else {
      if (o.zoomX) anchor.x = p.x / s.width;
      else if (o.zoomY) anchor.y = p.y / s.height;
    }
    if (anchor.x === undefined && anchor.y === undefined) return;
    viewport.zoom(factor, anchor);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}
