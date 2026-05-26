/**
 * @rw3iss/graph-utils/overlays — reusable canvas overlays.
 *
 * All overlays extend OverlayBase. Each takes an Adapter on construction
 * (so the same overlay file works on a vanilla Chart or — v0.2 — a
 * TradingView pane) and exposes `.setData(data)`.
 *
 * Exports:
 *   - OverlayBase:   abstract: adapter + data; override draw()
 *   - SignalArrows:  up / down arrows at (ts, price) per side
 *   - ZoneBoxes:     translucent rectangles between (from, to) and (yMin, yMax)
 *   - OrderMarkers:  filled diamonds at executed-order fills
 *
 * v0.2 plans: PredictionFan, RegimeStripes, MLConfidenceHeatmap, StrategyTraces.
 * See README → Roadmap.
 */
export { OverlayBase } from './OverlayBase.js';
export type { OverlayOptions } from './OverlayBase.js';

export { SignalArrows } from './SignalArrows.js';
export type { Signal, SignalArrowsOptions } from './SignalArrows.js';

export { ZoneBoxes } from './ZoneBoxes.js';
export type { Zone, ZoneBoxesOptions } from './ZoneBoxes.js';

export { OrderMarkers } from './OrderMarkers.js';
export type { Order, OrderMarkersOptions } from './OrderMarkers.js';
