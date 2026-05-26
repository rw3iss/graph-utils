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
import type { Viewport } from '../core/Viewport.js';

type Axis = 'x' | 'y';

function share(viewports: Viewport[], axis: Axis): () => void {
  if (viewports.length < 2) return () => {};

  let syncing = false;
  const unsubs: Array<() => void> = [];

  // Seed: copy first viewport's domain to the rest so we start coherent.
  const head = viewports[0]!;
  syncing = true;
  for (let i = 1; i < viewports.length; i++) {
    const v = viewports[i]!;
    if (axis === 'x') v.setXDomain(head.xDomain);
    else v.setYDomain(head.yDomain);
  }
  syncing = false;

  for (const src of viewports) {
    const off = src.bus.on('change', () => {
      if (syncing) return;
      syncing = true;
      try {
        const d = axis === 'x' ? src.xDomain : src.yDomain;
        for (const dst of viewports) {
          if (dst === src) continue;
          if (axis === 'x') dst.setXDomain(d);
          else dst.setYDomain(d);
        }
      } finally {
        syncing = false;
      }
    });
    unsubs.push(off);
  }

  return () => {
    for (const off of unsubs) off();
  };
}

/** Sync the X domain across all given viewports. Returns a detach fn. */
export function shareXAxis(viewports: Viewport[]): () => void {
  return share(viewports, 'x');
}

/** Sync the Y domain across all given viewports. Returns a detach fn. */
export function shareYAxis(viewports: Viewport[]): () => void {
  return share(viewports, 'y');
}

/**
 * Sync both axes. Must be a single coordinated listener — composing
 * shareXAxis + shareYAxis would create a re-entry race where the X
 * propagation triggers an emit on a follower, which the Y listener then
 * picks up and copies the follower's *stale* Y back to the source.
 */
export function shareAxes(viewports: Viewport[]): () => void {
  if (viewports.length < 2) return () => {};
  let syncing = false;
  const unsubs: Array<() => void> = [];

  const head = viewports[0]!;
  syncing = true;
  for (let i = 1; i < viewports.length; i++) {
    viewports[i]!.setXDomain(head.xDomain);
    viewports[i]!.setYDomain(head.yDomain);
  }
  syncing = false;

  for (const src of viewports) {
    const off = src.bus.on('change', () => {
      if (syncing) return;
      syncing = true;
      try {
        const xd = src.xDomain;
        const yd = src.yDomain;
        for (const dst of viewports) {
          if (dst === src) continue;
          dst.setXDomain(xd);
          dst.setYDomain(yd);
        }
      } finally {
        syncing = false;
      }
    });
    unsubs.push(off);
  }

  return () => {
    for (const off of unsubs) off();
  };
}
