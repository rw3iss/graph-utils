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
interface Point {
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
interface DrawStyle {
    fill?: string | CanvasGradient | CanvasPattern;
    stroke?: string;
    lineWidth?: number;
    alpha?: number;
    lineDash?: number[];
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
}
/** @deprecated Kept as an alias for backward source-compatibility. Prefer `DrawStyle`. */
type FillStroke = DrawStyle;
declare function clearRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void;
declare function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, opts?: DrawStyle): void;
declare function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts?: DrawStyle): void;
declare function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, opts?: DrawStyle): void;
declare function drawPolyline(ctx: CanvasRenderingContext2D, points: ReadonlyArray<Point>, opts?: DrawStyle): void;
declare function drawPath(ctx: CanvasRenderingContext2D, fn: (ctx: CanvasRenderingContext2D) => void, opts?: DrawStyle): void;
interface TextOptions {
    font?: string;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    /** Rotation in degrees, applied around (x, y). */
    angle?: number;
    /** Optional alpha for the fill. */
    alpha?: number;
}
declare function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options?: TextOptions): void;
declare function createLinearGradient(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, stops: ReadonlyArray<string>): CanvasGradient;

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

interface CanvasContextOptions {
    /** Force a specific DPR (mostly for tests). Defaults to window.devicePixelRatio. */
    dpr?: number;
}
interface TextStyle {
    font?: string;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    /** Rotation in degrees, applied around the anchor (x, y). */
    angle?: number;
    /** Optional alpha (0..1). */
    alpha?: number;
}
declare class CanvasContext {
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
    private _dpr;
    private _cssWidth;
    private _cssHeight;
    constructor(canvas: HTMLCanvasElement, options?: CanvasContextOptions);
    get dpr(): number;
    get width(): number;
    get height(): number;
    /**
     * Reconcile backing buffer with CSS size. Idempotent.
     * Applies a setTransform so all subsequent drawing is in CSS pixels.
     */
    resize(cssWidth: number, cssHeight: number, dpr?: number): void;
    /** Save / restore wrap helper for layered clipping. */
    withClip(x: number, y: number, w: number, h: number, fn: () => void): void;
    clear(): void;
    line(x1: number, y1: number, x2: number, y2: number, opts?: DrawStyle): void;
    rect(x: number, y: number, w: number, h: number, opts?: DrawStyle): void;
    circle(x: number, y: number, r: number, opts?: DrawStyle): void;
    polyline(points: Point[], opts?: DrawStyle): void;
    path(fn: (ctx: CanvasRenderingContext2D) => void, opts?: DrawStyle): void;
    text(text: string, x: number, y: number, style?: TextStyle): void;
    gradient(x1: number, y1: number, x2: number, y2: number, stops: string[]): CanvasGradient;
}

/**
 * Scale
 *
 * Maps a data-space `domain` ([d0, d1]) to a pixel-space `range` ([r0, r1]).
 * Three flavours:
 *
 *   LinearScale  — straight affine mapping
 *   LogScale     — log10; domain must be > 0
 *   TimeScale    — same math as linear, but tick() emits Date-aware steps
 *
 * Scales are immutable except for `setDomain`/`setRange`. The math is the
 * point of unit tests.
 */
type Domain = readonly [number, number];
type Range = readonly [number, number];
interface Scale {
    setDomain(domain: Domain): void;
    setRange(range: Range): void;
    domain(): Domain;
    range(): Range;
    /** data → pixel */
    scale(value: number): number;
    /** pixel → data */
    invert(pixel: number): number;
    /** Suggested tick positions in data space. */
    ticks(count: number): number[];
}
declare abstract class BaseScale implements Scale {
    protected _domain: Domain;
    protected _range: Range;
    constructor(domain: Domain, range: Range);
    setDomain(domain: Domain): void;
    setRange(range: Range): void;
    domain(): Domain;
    range(): Range;
    abstract scale(value: number): number;
    abstract invert(pixel: number): number;
    abstract ticks(count: number): number[];
}
declare class LinearScale extends BaseScale {
    scale(value: number): number;
    invert(pixel: number): number;
    ticks(count: number): number[];
}
declare class LogScale extends BaseScale {
    constructor(domain: Domain, range: Range);
    setDomain(domain: Domain): void;
    scale(value: number): number;
    invert(pixel: number): number;
    ticks(_count: number): number[];
}
/**
 * TimeScale — domain is in ms-since-epoch. Otherwise identical to LinearScale.
 */
declare class TimeScale extends LinearScale {
    ticks(count: number): number[];
}
declare function niceLinearTicks(d0: number, d1: number, count: number): number[];
declare function niceTimeTicks(t0: number, t1: number, count: number): number[];

/**
 * EventBus — minimal typed pub/sub.
 *
 * One bus per Chart instance. No globals.
 */
type EventHandler<P> = (payload: P) => void;
declare class EventBus<EventMap extends Record<string, unknown> = Record<string, unknown>> {
    private handlers;
    on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void;
    off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void;
    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
    clear(): void;
}

/**
 * Viewport
 *
 * Single source of truth for the visible window of a Chart:
 *   - xDomain: data range on X
 *   - yDomain: data range on Y
 *
 * Pan and zoom operate in data space; consumers (axes / overlays / layers)
 * subscribe to 'change' and re-derive pixel coordinates via Scale.
 *
 * `zoom(factor, anchor)` keeps the data value under `anchor` (a fraction
 * 0..1 of the visible range) fixed — the standard "wheel zoom at cursor"
 * affordance.
 */

interface ViewportState {
    xDomain: Domain;
    yDomain: Domain;
}
interface ViewportOptions {
    xDomain: Domain;
    yDomain: Domain;
    /** Hard limits (data space). Pan/zoom will clamp to these if set. */
    xBounds?: Domain;
    yBounds?: Domain;
    /** Min / max visible span per axis (data space). */
    xMinSpan?: number;
    xMaxSpan?: number;
    yMinSpan?: number;
    yMaxSpan?: number;
}
type ViewportEvents = {
    change: ViewportState;
};
declare class Viewport {
    private _xDomain;
    private _yDomain;
    private opts;
    readonly bus: EventBus<ViewportEvents>;
    constructor(opts: ViewportOptions);
    get xDomain(): Domain;
    get yDomain(): Domain;
    state(): ViewportState;
    setXDomain(d: Domain): void;
    setYDomain(d: Domain): void;
    /** Translate by (dx, dy) in data units. */
    pan(dx: number, dy: number): void;
    /**
     * Zoom by `factor` (>1 = zoom out, <1 = zoom in) around an anchor in [0,1]
     * along each axis. Axes with anchor `undefined` are left unchanged.
     */
    zoom(factor: number, anchor?: {
        x?: number;
        y?: number;
    }): void;
    private applyBounds;
}

export { CanvasContext as C, type Domain as D, EventBus as E, type FillStroke as F, LinearScale as L, type Point as P, type Range as R, type Scale as S, type TextOptions as T, Viewport as V, type CanvasContextOptions as a, type DrawStyle as b, type EventHandler as c, LogScale as d, type TextStyle as e, TimeScale as f, type ViewportOptions as g, type ViewportState as h, clearRect as i, createLinearGradient as j, drawCircle as k, drawLine as l, drawPath as m, drawPolyline as n, drawRect as o, drawText as p, niceLinearTicks as q, niceTimeTicks as r };
