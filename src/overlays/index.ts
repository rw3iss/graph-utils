/**
 * @rw3iss/graph-utils/overlays — reusable canvas overlays.
 *
 * All overlays extend OverlayBase. Each takes an Adapter on construction
 * (so the same overlay file works on a vanilla Chart or on a TradingView
 * pane via TradingViewOverlayAdapter) and exposes `.setData(data)`.
 *
 * Trading-shaped overlays (markers):
 *   - SignalArrows:  up / down arrows at (ts, price) per side
 *   - OrderMarkers:  filled diamonds at executed-order fills
 *   - PriceLine:     horizontal line at a price level, with right-edge label
 *
 * Region overlays:
 *   - ZoneBoxes:     translucent rectangles between (from, to) and (yMin, yMax)
 *   - ThresholdBand: horizontal band between two Y values (RSI 30/70 etc)
 *
 * Indicator overlays:
 *   - BollingerBands: upper / mid / lower from rolling SMA + std-dev
 *   - VWAP:           cumulative volume-weighted average price
 *
 * Interactivity:
 *   - Crosshair:     vertical + horizontal tracker w/ readout label
 *   - DrawingOverlay: data-anchored draggable annotations with a tool model +
 *                     'change'/'toolidle' events. Shapes: line / polygon /
 *                     rect plus the finance set hline / fib / measure /
 *                     channel / cone / text.
 *
 * v0.3 plans: PredictionFan, RegimeStripes, MLConfidenceHeatmap,
 *             StrategyTraces.
 */
export { OverlayBase } from './OverlayBase.js';
export type { OverlayOptions } from './OverlayBase.js';

export { SignalArrows } from './SignalArrows.js';
export type { Signal, SignalArrowsOptions } from './SignalArrows.js';

export { ZoneBoxes } from './ZoneBoxes.js';
export type { Zone, ZoneBoxesOptions } from './ZoneBoxes.js';

export { OrderMarkers } from './OrderMarkers.js';
export type { Order, OrderMarkersOptions } from './OrderMarkers.js';

export { PriceLine } from './PriceLine.js';
export type { PriceLineSpec, PriceLineOptions } from './PriceLine.js';

export { ThresholdBand } from './ThresholdBand.js';
export type { ThresholdBandSpec, ThresholdBandOptions } from './ThresholdBand.js';

export { BollingerBands, computeBands } from './BollingerBands.js';
export type { BollingerSample, BollingerBandsOptions } from './BollingerBands.js';

export { VWAP, computeVWAP } from './VWAP.js';
export type { VWAPSample, VWAPOptions } from './VWAP.js';

export { Crosshair } from './Crosshair.js';
export type { CrosshairOptions } from './Crosshair.js';

export { DrawingOverlay, FIB_LEVELS } from './DrawingOverlay.js';
export type {
  DrawingType,
  DrawingPoint,
  DrawingStyle,
  Drawing,
  DrawingTool,
  DrawingOverlayOptions,
} from './DrawingOverlay.js';
