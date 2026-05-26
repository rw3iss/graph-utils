/**
 * @rw3iss/graph-utils/core — primitives + coordinate machinery.
 *
 * Exports:
 *   - CanvasContext: DPR-aware wrapper around a CanvasRenderingContext2D
 *   - primitives:    stateless drawing functions (used by CanvasContext + overlays)
 *   - Scale family:  LinearScale, LogScale, TimeScale (data ↔ pixel mapping)
 *   - Viewport:      visible window state with pan/zoom, emits 'change'
 *   - HitTester:     spatial index + topmost pick for pointer interactions
 *   - EventBus:      tiny pub/sub used by Viewport / Chart
 */
export { CanvasContext } from './CanvasContext.js';
export type { CanvasContextOptions, TextStyle } from './CanvasContext.js';

export {
  clearRect,
  drawLine,
  drawRect,
  drawCircle,
  drawPolyline,
  drawPath,
  drawText,
  createLinearGradient,
} from './primitives.js';
export type { Point, DrawStyle, FillStroke, TextOptions } from './primitives.js';

export {
  LinearScale,
  LogScale,
  TimeScale,
  niceLinearTicks,
  niceTimeTicks,
} from './Scale.js';
export type { Scale, Domain, Range } from './Scale.js';

export { Viewport } from './Viewport.js';
export type { ViewportOptions, ViewportState } from './Viewport.js';

export { HitTester } from './HitTester.js';
export type { HitShape, HitEntry } from './HitTester.js';

export { EventBus } from './EventBus.js';
export type { EventHandler } from './EventBus.js';
