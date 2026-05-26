/**
 * @rw3iss/graph-utils/chart — high-level host that composes layers.
 *
 * Exports:
 *   - Chart:        owns canvas + viewport + scales + layers + interactions;
 *                   draws on requestAnimationFrame, resizes on ResizeObserver
 *   - Layer:        abstract base; override draw(ctx, viewport)
 *   - GridLayer:    default thin gridlines at scale ticks
 *   - AxisLayer:    default bottom + left tick labels and baselines
 *   - attachInteractions: low-level pan/zoom wiring (used by Chart internally;
 *                         exported for custom hosts)
 */
export { Chart } from './Chart.js';
export type { ChartOptions, ChartPadding } from './Chart.js';
export { Layer, GridLayer, AxisLayer } from './Layer.js';
export type { LayerPointerEvent } from './Layer.js';
export { attachInteractions } from './interactions.js';
export type { InteractionOptions } from './interactions.js';
