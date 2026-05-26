/**
 * @rw3iss/graph-utils/adapters — surfaces that overlays attach to.
 *
 * Exports:
 *   - Adapter:                  the shared interface overlays target
 *                               (getCanvas / getViewport / addLayer / invalidate /
 *                                toPixel / toData)
 *   - VanillaChartAdapter:      wraps our own Chart; full implementation
 *   - TradingViewOverlayAdapter: mirrors a TradingView `lightweight-charts`
 *                                chart by overlaying a sibling canvas.
 *                                Peer-dep: lightweight-charts >= 5.0.0.
 */
export type { Adapter } from './Adapter.js';
export { VanillaChartAdapter } from './VanillaChartAdapter.js';
export {
  TradingViewOverlayAdapter,
  type TradingViewOverlayAdapterOptions,
  type TradingViewChart,
  type TradingViewSeries,
  type TradingViewTimeScale,
  type TradingViewTime,
  type TradingViewTimeRange,
  type TradingViewLogicalRange,
} from './TradingViewOverlayAdapter.js';
