import { L as Layer, a as LayerPointerEvent } from '../Layer-bpSd4x2u.js';
import { C as CanvasContext, V as Viewport, E as EventBus } from '../Viewport-BadA7-mq.js';
import { A as Adapter } from '../Adapter-ZnF_DZ4J.js';

/**
 * OverlayBase
 *
 * Bridges Layer (Chart-side) with Adapter (consumer-side). Concrete overlays
 * extend this, store their data, override `draw(ctx, viewport)`.
 *
 * Use `this.adapter.toPixel(x, y)` to convert data → pixel — never hardcode.
 */

interface OverlayOptions {
    id: string;
    zIndex?: number;
    visible?: boolean;
}
declare abstract class OverlayBase<TData = unknown> extends Layer {
    protected adapter: Adapter;
    protected data: TData | null;
    constructor(adapter: Adapter, options: OverlayOptions);
    setData(data: TData): this;
    getData(): TData | null;
    abstract draw(ctx: CanvasContext, viewport: Viewport): void;
}

/**
 * SignalArrows
 *
 * Renders an upward or downward arrow at each signal's (ts, price).
 *   - buy  → green ↑ below the price
 *   - sell → red   ↓ above the price
 *
 * Data shape: { ts, side: 'buy'|'sell', price, label? }[]
 */

interface Signal {
    ts: number;
    side: 'buy' | 'sell';
    price: number;
    label?: string;
}
interface SignalArrowsOptions extends OverlayOptions {
    size?: number;
    /** offset in pixels from the price point along the arrow's axis. */
    offset?: number;
    buyColor?: string;
    sellColor?: string;
    labelFont?: string;
    labelColor?: string;
}
declare class SignalArrows extends OverlayBase<Signal[]> {
    size: number;
    offset: number;
    buyColor: string;
    sellColor: string;
    labelFont: string;
    labelColor: string;
    constructor(adapter: Adapter, options: SignalArrowsOptions);
    draw(ctx: CanvasContext, _vp: Viewport): void;
}

/**
 * ZoneBoxes
 *
 * Translucent rectangles spanning a time window and price range.
 * Useful for regime shading, S/R zones, backtest selection bands.
 *
 * Data shape: { from, to, yMin, yMax, fill, stroke? }[]
 *   - from / to are data-space X (typically ms timestamps)
 *   - yMin / yMax are data-space Y
 *   - if yMin or yMax is undefined → zone spans the full Y viewport
 */

interface Zone {
    from: number;
    to: number;
    yMin?: number;
    yMax?: number;
    fill: string;
    stroke?: string;
    label?: string;
}
interface ZoneBoxesOptions extends OverlayOptions {
    labelFont?: string;
    labelColor?: string;
}
declare class ZoneBoxes extends OverlayBase<Zone[]> {
    labelFont: string;
    labelColor: string;
    constructor(adapter: Adapter, options: ZoneBoxesOptions);
    draw(ctx: CanvasContext, vp: Viewport): void;
}

/**
 * OrderMarkers
 *
 * Renders executed-order markers at (ts, fillPrice) with a small filled
 * diamond and an optional size label.
 *
 * Data shape: { ts, side: 'buy'|'sell', price, qty?, status?, label? }[]
 */

interface Order {
    ts: number;
    side: 'buy' | 'sell';
    price: number;
    qty?: number;
    status?: 'filled' | 'pending' | 'cancelled';
    label?: string;
}
interface OrderMarkersOptions extends OverlayOptions {
    size?: number;
    buyColor?: string;
    sellColor?: string;
    pendingAlpha?: number;
    labelFont?: string;
    labelColor?: string;
}
declare class OrderMarkers extends OverlayBase<Order[]> {
    size: number;
    buyColor: string;
    sellColor: string;
    pendingAlpha: number;
    labelFont: string;
    labelColor: string;
    constructor(adapter: Adapter, options: OrderMarkersOptions);
    draw(ctx: CanvasContext, _vp: Viewport): void;
}

/**
 * PriceLine
 *
 * Horizontal line at a given price level, with an optional right-edge
 * label box (the standard limit-/stop-/take-profit marker treatment).
 *
 * Data shape: a single number price OR
 *   `{ price, label?, color?, lineDash?, labelBg?, labelColor? }`.
 *
 * You can stack several PriceLine instances for a bracket — they're
 * cheap (one stroke + one optional rounded rect per layer).
 */

interface PriceLineSpec {
    price: number;
    label?: string;
    color?: string;
    lineDash?: number[];
    labelBg?: string;
    labelColor?: string;
}
interface PriceLineOptions extends OverlayOptions {
    color?: string;
    lineWidth?: number;
    lineDash?: number[];
    labelFont?: string;
    labelBg?: string;
    labelColor?: string;
    /** Horizontal pad inside the label box. */
    labelPad?: number;
}
declare class PriceLine extends OverlayBase<PriceLineSpec> {
    color: string;
    lineWidth: number;
    lineDash: number[];
    labelFont: string;
    labelBg: string;
    labelColor: string;
    labelPad: number;
    constructor(adapter: Adapter, options: PriceLineOptions);
    draw(ctx: CanvasContext, _vp: Viewport): void;
}

/**
 * ThresholdBand
 *
 * Translucent horizontal band between two Y values. Useful for RSI
 * overbought/oversold (30/70), volatility bands, target-zone shading.
 *
 * Data shape: `{ yMin, yMax, fill?, stroke?, label? }`.
 */

interface ThresholdBandSpec {
    yMin: number;
    yMax: number;
    fill?: string;
    stroke?: string;
    label?: string;
}
interface ThresholdBandOptions extends OverlayOptions {
    fill?: string;
    stroke?: string;
    labelFont?: string;
    labelColor?: string;
}
declare class ThresholdBand extends OverlayBase<ThresholdBandSpec> {
    fill: string;
    stroke: string | undefined;
    labelFont: string;
    labelColor: string;
    constructor(adapter: Adapter, options: ThresholdBandOptions);
    draw(ctx: CanvasContext, _vp: Viewport): void;
}

/**
 * BollingerBands
 *
 * Three lines (upper, mid, lower) from a price series. Mid = SMA over
 * `window` bars. Upper/lower = mid ± `stddev * standardDeviations`,
 * where stddev is the population standard deviation over the same window.
 *
 * Input: `{ t, v }[]` — sorted ascending by `t`.
 *
 * Bars before the window is satisfied are emitted as NaN — drawing skips
 * them so the lines visually start at index `window-1`.
 */

interface BollingerSample {
    t: number;
    v: number;
}
interface BollingerBandsOptions extends OverlayOptions {
    /** Lookback in bars. Default 20. */
    window?: number;
    /** Multiplier for std deviation. Default 2. */
    standardDeviations?: number;
    midColor?: string;
    bandColor?: string;
    /** Fill between upper and lower. Set to `null` to disable. */
    fill?: string | null;
    lineWidth?: number;
}
declare class BollingerBands extends OverlayBase<BollingerSample[]> {
    window: number;
    standardDeviations: number;
    midColor: string;
    bandColor: string;
    fill: string | null;
    lineWidth: number;
    constructor(adapter: Adapter, options: BollingerBandsOptions);
    draw(ctx: CanvasContext, _vp: Viewport): void;
}
/**
 * Rolling SMA + population stddev over `window` bars. Exported so callers
 * (or tests) can reuse the math without going through the overlay.
 */
declare function computeBands(data: BollingerSample[], window: number, k: number): {
    upper: number[];
    mid: number[];
    lower: number[];
};

/**
 * VWAP
 *
 * Volume-weighted average price — a single cumulative line. Input is a
 * series of `{ t, price, volume }` sorted ascending by t. By default
 * VWAP is cumulative across the whole input (the typical "session VWAP"
 * shape if the consumer slices to a session).
 *
 *   vwap_i = sum(price_k * volume_k, k=0..i) / sum(volume_k, k=0..i)
 *
 * `reset` is an optional ascending list of timestamps at which to restart
 * accumulation — useful for plotting daily VWAP across multiple sessions
 * in one overlay.
 */

interface VWAPSample {
    t: number;
    price: number;
    volume: number;
}
interface VWAPOptions extends OverlayOptions {
    color?: string;
    lineWidth?: number;
    /** Ascending list of timestamps at which to reset accumulation. */
    resets?: number[];
}
declare class VWAP extends OverlayBase<VWAPSample[]> {
    color: string;
    lineWidth: number;
    resets: number[];
    constructor(adapter: Adapter, options: VWAPOptions);
    setResets(resets: number[]): this;
    draw(ctx: CanvasContext, _vp: Viewport): void;
}
/**
 * Returns a parallel array of cumulative VWAP values. NaN where volume
 * is zero or where the running sum is zero (first sample with vol=0).
 */
declare function computeVWAP(data: VWAPSample[], resets?: number[]): number[];

/**
 * Crosshair
 *
 * Vertical + horizontal line tracking the cursor, with a small data
 * readout near the cursor showing (time, price). Integrates with the
 * Adapter's pointer pipeline:
 *
 *   const cross = new Crosshair(adapter, { id: 'cross' });
 *   cross.attach(adapter.getCanvas());   // listens to pointermove/leave
 *
 * The default formatter shows ts as a UNIX-ms ISO time-of-day and price
 * to 2 decimals. Override `formatX` / `formatY` for your data.
 *
 * The crosshair listens on the canvas it's `attach`ed to. On vanilla
 * adapters that's the chart canvas. On the TV adapter the overlay canvas
 * is pointer-events: none — so consumers should attach to the TV chart
 * element instead (the parent), and translate clientX/Y into canvas
 * pixels.
 */

interface CrosshairOptions extends OverlayOptions {
    color?: string;
    lineWidth?: number;
    lineDash?: number[];
    labelFont?: string;
    labelBg?: string;
    labelColor?: string;
    labelPad?: number;
    formatX?: (x: number) => string;
    formatY?: (y: number) => string;
    /** Show readout label near the cursor. Default true. */
    showLabel?: boolean;
}
declare class Crosshair extends OverlayBase<null> {
    color: string;
    lineWidth: number;
    lineDash: number[];
    labelFont: string;
    labelBg: string;
    labelColor: string;
    labelPad: number;
    formatX: (x: number) => string;
    formatY: (y: number) => string;
    showLabel: boolean;
    private px;
    private py;
    private listenerEl;
    private listeners;
    constructor(adapter: Adapter, options: CrosshairOptions);
    /**
     * Wire the crosshair to a pointer source. Returns a detach fn (also
     * stored internally so `destroy()` works).
     */
    attach(element: HTMLElement): () => void;
    detach(): void;
    /** Programmatic position (mostly for tests / synthetic events). */
    setCursor(px: number | null, py: number | null): void;
    draw(ctx: CanvasContext, _vp: Viewport): void;
}

/**
 * DrawingOverlay
 *
 * Interactive, data-anchored annotations (line / polygon / rect) that the
 * user draws on top of a chart and that scale + pan with the chart because
 * every point is stored in DATA space and mapped through `adapter.toPixel`
 * at draw time.
 *
 * It is a `Layer` added via `adapter.addLayer(...)`. Unlike the marker
 * overlays it owns its own data model (an array of `Drawing`s), a current
 * `DrawingTool`, an in-progress shape, and a tiny `EventBus` so the host
 * app can persist on `'change'` and flip its toolbar on `'toolidle'`.
 *
 * Interaction is gated through `adapter.setInteractive(on)`: when a tool is
 * selected the adapter forwards DOM pointer events to this layer's
 * `onPointerDown/Move/Up`; when the tool is cleared interaction is turned
 * off so the host chart keeps its own pan/zoom gestures.
 *
 * Coordinate contract (mirrors the rest of the package):
 *   - `DrawingPoint.x` is the adapter's time unit (TV: seconds by default).
 *   - `DrawingPoint.y` is price.
 *   - Points whose `toPixel` is non-finite (off the visible range on TV)
 *     are skipped; multi-point shapes still draw their finite sub-segments.
 *
 * Right-click finalizes a polygon: the adapter suppresses the browser
 * context menu and the `pointerdown` with `button === 2` is the signal we
 * read in `onPointerDown`.
 */

type DrawingType = 'line' | 'polygon' | 'rect';
interface DrawingPoint {
    /** Adapter time unit (e.g. TV seconds). */
    x: number;
    /** Price. */
    y: number;
}
interface DrawingStyle {
    stroke?: string;
    fill?: string;
    lineWidth?: number;
}
interface Drawing {
    id: string;
    type: DrawingType;
    points: DrawingPoint[];
    style?: DrawingStyle;
}
/** A shape tool, the 'select'/move tool, or no tool (idle / pan). */
type DrawingTool = DrawingType | 'select' | null;
interface DrawingOverlayOptions {
    id?: string;
    zIndex?: number;
    visible?: boolean;
}
type DrawingEvents = {
    /** Fired whenever the drawings array mutates (add / move / delete / restore). */
    change: Drawing[];
    /** Fired when a shape finishes placing, carrying the finished type. */
    toolidle: DrawingType;
};
declare class DrawingOverlay extends Layer {
    protected adapter: Adapter;
    readonly bus: EventBus<DrawingEvents>;
    private drawings;
    private tool;
    private style;
    /** Points of the shape currently being placed (data space). */
    private inProgress;
    private inProgressType;
    /** Live cursor pixel for the rubber-band segment. */
    private cursorPx;
    private selectedId;
    /** Handle currently dragged: index into the selected drawing's points. */
    private dragPointIndex;
    /** Handle currently hovered (for highlight), as (drawingId, pointIndex). */
    private hoverHandle;
    constructor(adapter: Adapter, opts?: DrawingOverlayOptions);
    setTool(tool: DrawingTool): void;
    getTool(): DrawingTool;
    /** Deep copy of all drawings (safe to hand to a persistence layer). */
    getDrawings(): Drawing[];
    /** Replace all drawings (persistence restore). Emits 'change'. */
    setDrawings(d: Drawing[]): void;
    clear(): void;
    deleteSelected(): void;
    /** Style applied to new shapes and to the current selection. */
    setStyle(s: DrawingStyle): void;
    getStyle(): DrawingStyle;
    /** Subscribe to a drawing event. Returns an unsubscribe fn. */
    on<K extends keyof DrawingEvents>(event: K, cb: (payload: DrawingEvents[K]) => void): () => void;
    /** Cancel the in-progress shape (host wires this to Esc). */
    cancelInProgress(): void;
    /** Currently selected drawing id, or null. */
    getSelectedId(): string | null;
    draw(ctx: CanvasContext, _vp: Viewport): void;
    private drawShape;
    private drawInProgress;
    onPointerDown(e: LayerPointerEvent): void;
    onPointerMove(e: LayerPointerEvent): void;
    onPointerUp(_e: LayerPointerEvent): void;
    private handleSelectDown;
    /** Topmost drawing whose handle is within HANDLE_HIT_PX of (px,py). */
    private hitHandle;
    /** Topmost drawing whose body contains / is near (px,py). */
    private hitBody;
    private finalizeShape;
    private finalizePolygon;
    private clearInProgress;
    private setSelected;
    private emitChange;
}

export { BollingerBands, type BollingerBandsOptions, type BollingerSample, Crosshair, type CrosshairOptions, type Drawing, DrawingOverlay, type DrawingOverlayOptions, type DrawingPoint, type DrawingStyle, type DrawingTool, type DrawingType, type Order, OrderMarkers, type OrderMarkersOptions, OverlayBase, type OverlayOptions, PriceLine, type PriceLineOptions, type PriceLineSpec, type Signal, SignalArrows, type SignalArrowsOptions, ThresholdBand, type ThresholdBandOptions, type ThresholdBandSpec, VWAP, type VWAPOptions, type VWAPSample, type Zone, ZoneBoxes, type ZoneBoxesOptions, computeBands, computeVWAP };
