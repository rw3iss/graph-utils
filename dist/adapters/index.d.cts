import { A as Adapter } from '../Adapter-gFe3x_4d.cjs';
import { C as Chart } from '../Chart-X0iDNcFQ.cjs';
import { L as Layer } from '../Layer-B62B76wJ.cjs';
import { V as Viewport, S as Scale, C as CanvasContext } from '../Viewport-BadA7-mq.cjs';

/**
 * VanillaChartAdapter
 *
 * Wraps a Chart so overlays consume the same Adapter contract whether the
 * host is our own Chart or (v0.2) a TradingView pane.
 */

declare class VanillaChartAdapter implements Adapter {
    readonly chart: Chart;
    constructor(chart: Chart);
    getCanvas(): HTMLCanvasElement;
    getViewport(): Viewport;
    addLayer(layer: Layer): void;
    removeLayer(idOrLayer: string | Layer): void;
    invalidate(): void;
    toPixel(x: number, y: number): {
        x: number;
        y: number;
    };
    toData(px: number, py: number): {
        x: number;
        y: number;
    };
}

/**
 * TradingViewOverlayAdapter
 *
 * Mirrors a TradingView `lightweight-charts` chart by laying a sibling
 * `<canvas>` absolute-positioned over the chart's element. Overlays paint
 * onto our canvas using the same Adapter contract as the vanilla path —
 * meaning the same overlay code runs on either host without modification.
 *
 * Design notes:
 *   - We never paint onto TV's own canvases. TV owns its layers; we sit
 *     above them with our own.
 *   - Coordinate mapping delegates to `timeScale.timeToCoordinate` and
 *     `series.priceToCoordinate`. Both return `null` for values outside
 *     the visible range; overlays that hit a null skip that point.
 *   - The adapter exposes `Scale`-shaped wrappers (`TradingViewTimeScale`
 *     / `TradingViewPriceScale`) so overlay code that uses
 *     `xScale.scale(v)` / `yScale.scale(v)` works unchanged.
 *   - Resync triggers: TV `subscribeVisibleLogicalRangeChange` (zoom/pan),
 *     `subscribeCrosshairMove` (also fires on hover so it catches steady-state
 *     mouse-driven layout shifts), a ResizeObserver on the chart element,
 *     and explicit `invalidate()` calls from consumers.
 *
 * Peer dependency: `lightweight-charts` >=5.0.0. We do not import it at
 * runtime — only the types — so a consumer that omits it does not pay any
 * bundle cost.
 */

type TradingViewTime = string | number | {
    year: number;
    month: number;
    day: number;
};
interface TradingViewTimeRange {
    from: TradingViewTime;
    to: TradingViewTime;
}
interface TradingViewLogicalRange {
    from: number;
    to: number;
}
interface TradingViewTimeScale {
    timeToCoordinate(time: TradingViewTime): number | null;
    coordinateToTime(coord: number): TradingViewTime | null;
    getVisibleRange(): TradingViewTimeRange | null;
    getVisibleLogicalRange(): TradingViewLogicalRange | null;
    subscribeVisibleLogicalRangeChange(handler: (r: TradingViewLogicalRange | null) => void): void;
    unsubscribeVisibleLogicalRangeChange(handler: (r: TradingViewLogicalRange | null) => void): void;
    subscribeVisibleTimeRangeChange?(handler: (r: TradingViewTimeRange | null) => void): void;
    unsubscribeVisibleTimeRangeChange?(handler: (r: TradingViewTimeRange | null) => void): void;
}
interface TradingViewSeries {
    priceToCoordinate(price: number): number | null;
    coordinateToPrice(coord: number): number | null;
}
interface TradingViewChart {
    timeScale(): TradingViewTimeScale;
    chartElement(): HTMLElement;
    subscribeCrosshairMove?(handler: (param: any) => void): void;
    unsubscribeCrosshairMove?(handler: (param: any) => void): void;
}
interface TradingViewOverlayAdapterOptions {
    /** The TV chart whose plot area we'll overlay. */
    chart: TradingViewChart;
    /** A series whose price scale we should mirror. Required: TV's
     *  priceToCoordinate lives on a series, not on the chart. */
    priceSeries: TradingViewSeries;
    /** Container the overlay canvas attaches to. Defaults to the parent of
     *  the TV chart element. */
    container?: HTMLElement;
    /** z-index for the overlay canvas. Default 10 (above TV's layers). */
    zIndex?: number;
    /**
     * Unit for the X data coordinate passed to `toPixel` and to
     * `xScale.scale`. TV's native `UTCTimestamp` is **seconds**; many app
     * data sources use **milliseconds**. Default `'seconds'`.
     */
    timeUnit?: 'seconds' | 'milliseconds';
    /** Override DPR (mostly for tests). */
    dpr?: number;
}
declare class TradingViewOverlayAdapter implements Adapter {
    readonly tvChart: TradingViewChart;
    readonly priceSeries: TradingViewSeries;
    readonly xScale: Scale;
    readonly yScale: Scale;
    readonly viewport: Viewport;
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasContext;
    private container;
    private chartElement;
    private layers;
    private resizeObserver;
    private rafHandle;
    private destroyed;
    private timeUnit;
    private onLogical;
    private onCrosshair;
    constructor(options: TradingViewOverlayAdapterOptions);
    getCanvas(): HTMLCanvasElement;
    getViewport(): Viewport;
    addLayer(layer: Layer): void;
    removeLayer(idOrLayer: string | Layer): void;
    invalidate(): void;
    /**
     * Map a (time, price) pair in data space to overlay-canvas pixel coords.
     * Returns `{ NaN, NaN }` if either coordinate is outside the visible
     * range (TV returns null in that case).
     */
    toPixel(time: number, price: number): {
        x: number;
        y: number;
    };
    toData(px: number, py: number): {
        x: number;
        y: number;
    };
    /** Synchronously draw all visible layers. Mostly internal — prefer `invalidate()`. */
    render(): void;
    destroy(): void;
    private handleResize;
    private syncViewportDomain;
}

export { Adapter, type TradingViewChart, type TradingViewLogicalRange, TradingViewOverlayAdapter, type TradingViewOverlayAdapterOptions, type TradingViewSeries, type TradingViewTime, type TradingViewTimeRange, type TradingViewTimeScale, VanillaChartAdapter };
