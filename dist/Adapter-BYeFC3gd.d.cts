import { L as Layer } from './Layer-B62B76wJ.cjs';
import { V as Viewport } from './Viewport-BadA7-mq.cjs';

/**
 * Adapter
 *
 * Common interface that overlays target. Implementations exist for:
 *   - VanillaChartAdapter — wraps our own Chart
 *   - TradingViewOverlayAdapter — stub; v0.2 will sync a canvas to a TV pane
 *
 * Overlay code never imports a specific adapter — it accepts `Adapter` and
 * stays portable across both surfaces.
 */

interface Adapter {
    getCanvas(): HTMLCanvasElement;
    getViewport(): Viewport;
    addLayer(layer: Layer): void;
    removeLayer(idOrLayer: string | Layer): void;
    /** Request a redraw. */
    invalidate(): void;
    /** Convert data-space (x, y) into pixel coordinates. */
    toPixel(x: number, y: number): {
        x: number;
        y: number;
    };
    /** Convert pixel coordinates back to data space. */
    toData(px: number, py: number): {
        x: number;
        y: number;
    };
    /**
     * Optional. Toggle whether the adapter forwards DOM pointer events to its
     * layers' `onPointerDown/Move/Up` handlers.
     *
     * Adapters that overlay a host which owns its own pan/zoom (e.g. the
     * TradingView overlay canvas, which sets `pointer-events: none`) should
     * flip pointer-events on the overlay canvas so the host keeps its
     * gestures while interaction is off, and the overlay receives events while
     * it is on. Implementations must be idempotent.
     */
    setInteractive?(on: boolean): void;
    /** Optional. Current interactive state (default off). */
    getInteractive?(): boolean;
}

export type { Adapter as A };
