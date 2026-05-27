import { C as CanvasContext, V as Viewport } from './Viewport-BadA7-mq.cjs';

/**
 * Layer
 *
 * Smallest drawable unit a Chart composes. A Layer:
 *   - draws to a CanvasContext, given a Viewport
 *   - may opt into pointer events
 *
 * Layers are z-ordered; Chart owns the list. Each Layer is responsible for
 * its own data; Chart never reaches in.
 */

interface LayerPointerEvent {
    /** CSS-pixel coords relative to the canvas. */
    x: number;
    y: number;
    /** Underlying DOM event for modifier keys etc. */
    source: PointerEvent | WheelEvent;
}
declare abstract class Layer {
    readonly id: string;
    visible: boolean;
    /** Higher zIndex draws on top; default 0. */
    zIndex: number;
    constructor(id: string);
    /** Called once per render. Implementations should be idempotent. */
    abstract draw(ctx: CanvasContext, viewport: Viewport): void;
    onPointerMove?(_e: LayerPointerEvent): void;
    onPointerDown?(_e: LayerPointerEvent): void;
    onPointerUp?(_e: LayerPointerEvent): void;
}
/**
 * Built-in grid: light lines at each tick of the X and Y scales.
 * Driven by callbacks so the Chart can supply the right Scale instances.
 */
declare class GridLayer extends Layer {
    color: string;
    lineWidth: number;
    private readonly xScale;
    private readonly yScale;
    private readonly bounds;
    private readonly tickCount;
    constructor(id: string, xScale: () => {
        ticks(n: number): number[];
        scale(v: number): number;
    }, yScale: () => {
        ticks(n: number): number[];
        scale(v: number): number;
    }, bounds: () => {
        left: number;
        top: number;
        right: number;
        bottom: number;
    }, tickCount?: {
        x: number;
        y: number;
    });
    draw(ctx: CanvasContext, _vp: Viewport): void;
}
/**
 * Built-in axis layer (one per axis side).
 */
declare class AxisLayer extends Layer {
    color: string;
    font: string;
    tickCount: number;
    formatter: (v: number) => string;
    private readonly side;
    private readonly scale;
    private readonly bounds;
    constructor(id: string, side: 'bottom' | 'left', scale: () => {
        ticks(n: number): number[];
        scale(v: number): number;
    }, bounds: () => {
        left: number;
        top: number;
        right: number;
        bottom: number;
    });
    draw(ctx: CanvasContext, _vp: Viewport): void;
}

export { AxisLayer as A, GridLayer as G, Layer as L, type LayerPointerEvent as a };
