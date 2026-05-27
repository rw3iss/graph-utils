import { V as Viewport, C as CanvasContext, S as Scale, g as ViewportOptions } from './Viewport-BadA7-mq.js';
import { L as Layer, a as LayerPointerEvent } from './Layer-bpSd4x2u.js';

/**
 * interactions
 *
 * Wires a canvas's pointer / wheel events to a Viewport. Per-axis enable
 * flags let callers (e.g. multi-pane Charts) disable Y pan / zoom etc.
 */

interface InteractionOptions {
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
declare function attachInteractions(canvas: HTMLCanvasElement, viewport: Viewport, 
/** width/height of plot area in CSS pixels, callable to allow resizing. */
size: () => {
    width: number;
    height: number;
}, options?: InteractionOptions): () => void;

/**
 * Chart
 *
 * High-level host owning:
 *   - a CanvasContext (DPR-aware)
 *   - a Viewport (data window)
 *   - X / Y Scales pinned to the plot area + viewport
 *   - a z-ordered list of Layers
 *   - the interaction loop (pan / zoom on the canvas element)
 *   - a ResizeObserver that resyncs the canvas backing buffer
 *
 * Default layers (axes + grid) are added automatically; toggle via `axes`,
 * `grid` options.
 */

interface ChartPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
interface ChartOptions extends ViewportOptions {
    padding?: Partial<ChartPadding>;
    axes?: boolean;
    grid?: boolean;
    interactions?: InteractionOptions | false;
    xScale?: Scale;
    yScale?: Scale;
    xTickFormatter?: (v: number) => string;
    yTickFormatter?: (v: number) => string;
    /** Background color drawn before layers. `null` = no background. */
    background?: string | null;
}
declare class Chart {
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasContext;
    readonly viewport: Viewport;
    readonly xScale: Scale;
    readonly yScale: Scale;
    padding: ChartPadding;
    background: string | null;
    private layers;
    private resizeObserver;
    private detachInteractions;
    private rafHandle;
    private destroyed;
    constructor(canvas: HTMLCanvasElement, options: ChartOptions);
    addLayer(layer: Layer): void;
    removeLayer(idOrLayer: string | Layer): void;
    getLayers(): ReadonlyArray<Layer>;
    /** Request a redraw on the next animation frame. */
    invalidate(): void;
    /** Synchronous draw of all visible layers. */
    render(): void;
    /** Top-left and bottom-right of the plot area in CSS pixels. */
    plotBounds(): {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
    plotWidth(): number;
    plotHeight(): number;
    /** Dispatch a synthetic pointer event to layers (Chart calls this itself). */
    dispatchPointerMove(e: LayerPointerEvent): void;
    destroy(): void;
    private handleResize;
    private refreshScales;
}

export { Chart as C, type InteractionOptions as I, type ChartOptions as a, type ChartPadding as b, attachInteractions as c };
