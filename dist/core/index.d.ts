export { C as CanvasContext, a as CanvasContextOptions, D as Domain, b as DrawStyle, E as EventBus, c as EventHandler, F as FillStroke, L as LinearScale, d as LogScale, P as Point, R as Range, S as Scale, T as TextOptions, e as TextStyle, f as TimeScale, V as Viewport, g as ViewportOptions, h as ViewportState, i as clearRect, j as createLinearGradient, k as drawCircle, l as drawLine, m as drawPath, n as drawPolyline, o as drawRect, p as drawText, q as niceLinearTicks, r as niceTimeTicks } from '../Viewport-BadA7-mq.js';

/**
 * HitTester
 *
 * Spatial index of drawn shapes with attached payloads. Used by Chart /
 * overlays to translate a pointer event into the topmost interactive object.
 *
 * - Internally just an array (linear scan) until size crosses a threshold;
 *   at that point it lazily builds a quadtree. Saves us from paying for
 *   the quadtree on small charts.
 * - Insertion order is preserved; `pick()` returns the LAST matching entry
 *   (= topmost in draw order).
 *
 * Coordinates here are PIXEL space — call after scaling.
 */
type HitShape = {
    kind: 'point';
    x: number;
    y: number;
} | {
    kind: 'circle';
    x: number;
    y: number;
    r: number;
} | {
    kind: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
} | {
    kind: 'polyline';
    points: ReadonlyArray<{
        x: number;
        y: number;
    }>;
    lineWidth?: number;
};
interface HitEntry<T = unknown> {
    shape: HitShape;
    payload: T;
}
declare class HitTester<T = unknown> {
    private entries;
    private tree;
    private dirty;
    add(shape: HitShape, payload: T): void;
    clear(): void;
    get size(): number;
    /**
     * Returns the topmost entry whose shape contains the point (with
     * `tolerance` pixels of slop on points / polylines), or null.
     */
    pick(x: number, y: number, tolerance?: number): HitEntry<T> | null;
    /** Force-rebuild the index (mostly for tests). */
    ensureIndex(): void;
}

export { type HitEntry, type HitShape, HitTester };
