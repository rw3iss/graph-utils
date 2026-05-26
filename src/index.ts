/**
 * @rw3iss/graph-utils — vanilla-TypeScript canvas drawing toolkit.
 *
 * Subpath exports are the preferred entry points:
 *   import { CanvasContext, Scale } from '@rw3iss/graph-utils/core';
 *   import { Chart, Layer }         from '@rw3iss/graph-utils/chart';
 *   import { VanillaChartAdapter }  from '@rw3iss/graph-utils/adapters';
 *   import { SignalArrows }         from '@rw3iss/graph-utils/overlays';
 *
 * This barrel re-exports everything for convenience.
 */
export * from './core/index.js';
export * from './chart/index.js';
export * from './adapters/index.js';
export * from './overlays/index.js';
