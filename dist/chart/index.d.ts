export { C as Chart, a as ChartOptions, b as ChartPadding, I as InteractionOptions, c as attachInteractions } from '../Chart-D1pen8_K.js';
export { A as AxisLayer, G as GridLayer, L as Layer, a as LayerPointerEvent } from '../Layer-bpSd4x2u.js';
import { V as Viewport } from '../Viewport-BadA7-mq.js';

/**
 * SharedAxis
 *
 * Helpers that synchronise viewport domains across multiple Viewports —
 * the standard "X-axis-shared multi-pane chart" affordance (price + RSI +
 * volume that pan together).
 *
 *   const detach = shareXAxis([priceChart.viewport, rsiChart.viewport]);
 *   // ...later
 *   detach();
 *
 * The first viewport in the array is the canonical source on init; after
 * that, any change on any viewport propagates to all others. Re-entry is
 * guarded with a flag so handlers don't ping-pong on emit.
 */

/** Sync the X domain across all given viewports. Returns a detach fn. */
declare function shareXAxis(viewports: Viewport[]): () => void;
/** Sync the Y domain across all given viewports. Returns a detach fn. */
declare function shareYAxis(viewports: Viewport[]): () => void;
/**
 * Sync both axes. Must be a single coordinated listener — composing
 * shareXAxis + shareYAxis would create a re-entry race where the X
 * propagation triggers an emit on a follower, which the Y listener then
 * picks up and copies the follower's *stale* Y back to the source.
 */
declare function shareAxes(viewports: Viewport[]): () => void;

export { shareAxes, shareXAxis, shareYAxis };
