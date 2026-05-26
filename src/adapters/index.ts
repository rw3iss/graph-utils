/**
 * @rw3iss/graph-utils/adapters — surfaces that overlays attach to.
 *
 * Exports:
 *   - Adapter:                  the shared interface overlays target
 *                               (getCanvas / getViewport / addLayer / invalidate /
 *                                toPixel / toData)
 *   - VanillaChartAdapter:      wraps our own Chart; full implementation
 *   - TradingViewOverlayAdapter: STUB for v0.1; methods throw with a clear
 *                                "not implemented in v0.1.0" message.
 *                                Real impl in v0.2.
 */
export type { Adapter } from './Adapter.js';
export { VanillaChartAdapter } from './VanillaChartAdapter.js';
export {
  TradingViewOverlayAdapter,
  type TradingViewOverlayAdapterOptions,
} from './TradingViewOverlayAdapter.js';
