# @rw3iss/graph-utils

Modular vanilla-TypeScript canvas drawing toolkit: DPR-aware drawing
primitives, linear/log/time scales, a pan/zoom viewport, layer
composition, and reusable overlays (signal arrows, zone boxes, order
markers).

The design philosophy: **the same overlay file works on a bare canvas
or on top of a TradingView chart**. Overlays target a small `Adapter`
interface; concrete adapters wrap whichever host you're using.

- Library code has **zero framework deps** (no Preact / React / Vue).
- ESM + CJS + `.d.ts` published in `dist/`.
- `sideEffects: false` — tree-shakable.

## Status

`v0.1.0` — ships the vanilla path solidly:

- `core/` primitives, scales, viewport, hit-tester, event bus
- `chart/` host, layer base, default axes + grid, pan/zoom
- `adapters/` `VanillaChartAdapter` (real), `TradingViewOverlayAdapter` (stub)
- `overlays/` `SignalArrows`, `ZoneBoxes`, `OrderMarkers`

## Install

Not published to npm yet. From the GitHub remote:

```bash
pnpm add github:rw3iss/graph-utils
```

After cloning consumers can also point at a local checkout via pnpm
`workspace:*` or `file:` for development.

## Quick start

```ts
import { Chart, Layer } from '@rw3iss/graph-utils/chart';
import type { CanvasContext } from '@rw3iss/graph-utils/core';

class LineLayer extends Layer {
  constructor(private chart: Chart, private data: { x: number; y: number }[]) {
    super('line');
  }
  draw(ctx: CanvasContext) {
    const pts = this.data.map((p) => ({
      x: this.chart.xScale.scale(p.x),
      y: this.chart.yScale.scale(p.y),
    }));
    ctx.polyline(pts, '#4ade80', 2);
  }
}

const canvas = document.querySelector('canvas')!;
const chart = new Chart(canvas, {
  xDomain: [0, 100],
  yDomain: [0, 100],
});
chart.addLayer(new LineLayer(chart, makeData()));
```

For an overlay example:

```ts
import { VanillaChartAdapter } from '@rw3iss/graph-utils/adapters';
import { SignalArrows } from '@rw3iss/graph-utils/overlays';

const adapter = new VanillaChartAdapter(chart);
const sigs = new SignalArrows(adapter, { id: 'sigs' });
sigs.setData([
  { ts: 1700000000000, side: 'buy', price: 42.5 },
  { ts: 1700001000000, side: 'sell', price: 44.0 },
]);
```

## Public API

### `@rw3iss/graph-utils/core`

- `CanvasContext(canvas, opts?)` — DPR-aware 2D wrapper. `resize(w, h)`
  syncs the backing buffer; all draw calls use CSS pixels.
- `LinearScale`, `LogScale`, `TimeScale` — `scale(v)`, `invert(px)`,
  `ticks(count)`, `setDomain`, `setRange`.
- `Viewport({ xDomain, yDomain, xBounds?, yBounds?, xMinSpan?, ... })` —
  `pan(dx, dy)`, `zoom(factor, { x?, y? })`, emits `change`.
- `HitTester<T>` — `add(shape, payload)`, `pick(x, y, tol?)`. Linear
  scan, then lazy quadtree past 1000 entries.
- `EventBus<EventMap>` — typed pub/sub.
- Stateless `primitives` — `drawLine`, `drawRect`, `drawCircle`,
  `drawPolyline`, `drawPath`, `drawText`, `createLinearGradient`.

### `@rw3iss/graph-utils/chart`

- `Chart(canvas, options)` — owns CanvasContext, Viewport, scales, layers,
  interactions, ResizeObserver. `addLayer / removeLayer / invalidate /
  render / destroy / plotBounds`.
- `Layer` — abstract; override `draw(ctx, viewport)`.
- `GridLayer`, `AxisLayer` — built-ins added by default.
- `attachInteractions(canvas, viewport, size, opts?)` — low-level pan /
  zoom wiring; returns a detach function.

### `@rw3iss/graph-utils/adapters`

- `Adapter` — `getCanvas / getViewport / addLayer / removeLayer /
  invalidate / toPixel / toData`.
- `VanillaChartAdapter(chart)` — full impl wrapping our own Chart.
- `TradingViewOverlayAdapter(options)` — **stub**; v0.2 will sync a
  transparent canvas above a TradingView pane.

### `@rw3iss/graph-utils/overlays`

- `OverlayBase<TData>` — Layer subclass holding an Adapter; `.setData(d)`
  triggers redraw.
- `SignalArrows` — ↑/↓ at `{ ts, side, price, label? }`.
- `ZoneBoxes` — translucent rectangles in `{ from, to, yMin?, yMax?, fill }`.
- `OrderMarkers` — diamond markers at `{ ts, side, price, qty?, status?, label? }`.

## Playground

The repo includes a Preact + Vite playground that imports source
directly:

```bash
pnpm install
pnpm --filter graph-utils-playground dev
```

Three demos:

1. **Line chart** — Chart + Scale + axes
2. **Candle + overlays** — OHLC bars + SignalArrows + ZoneBoxes
3. **Multi-pane** — price + RSI with synced X axis

The playground is `private: true` and **not part of the published
package**.

## Build

```bash
pnpm build       # tsup → ESM + CJS + .d.ts in dist/
pnpm test        # vitest run
pnpm typecheck   # tsc --noEmit
```

## Roadmap

**v0.2**

- TradingView adapter — real implementation against `lightweight-charts`
  pane / time-scale / price-scale API
- More overlays: `PredictionFan`, `RegimeStripes`,
  `MLConfidenceHeatmap`, `StrategyTraces`
- Crosshair + tooltip system on `Chart`

**v0.3**

- Mobile pinch + two-finger pan
- Inline legend layer
- WebGL/WebGPU primitives behind the same `CanvasContext` surface for
  very wide series

## License

MIT.
