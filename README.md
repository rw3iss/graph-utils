# @rw3iss/graph-utils

Adapter-driven canvas drawing toolkit for trading-style overlays. The
same overlay code works on a bare HTML `<canvas>` or layered on top of
a [TradingView Lightweight Charts][lwc] chart — the adapter abstracts
the host, the overlays only see the abstraction.

[lwc]: https://github.com/tradingview/lightweight-charts

```
  vanilla canvas ──┐
                   ├── Adapter ── Viewport + Scales ── Layers / Overlays
  TradingView pane ─┘
```

- Vanilla TypeScript, zero UI-framework deps.
- ESM + CJS + `.d.ts` published in `dist/`.
- `sideEffects: false` — tree-shakable.
- `lightweight-charts` is an *optional* peer dependency.

## Why

Production trading UIs want TradingView's chart for its candles, time
scale, and panning UX — but they also want their own overlays painted on
top: strategy signals, executed orders, regime stripes, prediction
fans. Most projects end up writing two parallel layers — one for "the
real chart in production" and one for "the debug canvas". This package
collapses that into one layer.

Write the overlay once against an `Adapter`. Pick the adapter at
host-time:

- `VanillaChartAdapter` for standalone canvases (strategy debugger,
  backtest reports, anything not visiting a third-party chart).
- `TradingViewOverlayAdapter` for production charts.

Both implementations expose the same `Viewport` + `Scale` contract, so
overlay code never branches.

## Install

Not on npm. Pull from GitHub:

```bash
pnpm add github:rw3iss/graph-utils
# or
npm install rw3iss/graph-utils
```

If you'll use the TradingView adapter, also install the peer:

```bash
pnpm add lightweight-charts
```

## Quick start

### Vanilla canvas

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
    ctx.polyline(pts, { stroke: '#4ade80', lineWidth: 2 });
  }
}

const canvas = document.querySelector('canvas')!;
const chart = new Chart(canvas, { xDomain: [0, 100], yDomain: [0, 100] });
chart.addLayer(new LineLayer(chart, myData));
```

### TradingView chart with our overlays

```ts
import { createChart, LineSeries } from 'lightweight-charts';
import { TradingViewOverlayAdapter } from '@rw3iss/graph-utils/adapters';
import { SignalArrows, PriceLine, Crosshair } from '@rw3iss/graph-utils/overlays';

const tv = createChart(container, { width: 800, height: 400 });
const series = tv.addSeries(LineSeries);
series.setData(myData); // [{ time, value }, ...]

const adapter = new TradingViewOverlayAdapter({ chart: tv, priceSeries: series });
new SignalArrows(adapter, { id: 'sigs' }).setData([
  { ts: 1700000000, side: 'buy',  price: 42.5 },
  { ts: 1700001000, side: 'sell', price: 44.0 },
]);
new PriceLine(adapter, { id: 'tp' }).setData({ price: 45, label: 'TP' });
new Crosshair(adapter, { id: 'x' }).attach(tv.chartElement());
```

> `ts` is **seconds** by default (TV's `UTCTimestamp`). If your data is
> milliseconds, construct the adapter with `timeUnit: 'milliseconds'`.

## API surface

### `/core` — primitives + coordinate machinery

| Export                              | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `CanvasContext(canvas, opts?)`      | DPR-aware 2D wrapper. CSS-pixel drawing.    |
| `DrawStyle`                         | Unified fill/stroke/lineWidth/alpha/lineDash bag. |
| `LinearScale` / `LogScale` / `TimeScale` | data ↔ pixel mapping + ticks.          |
| `Viewport`                          | xDomain / yDomain + pan / zoom + events.    |
| `HitTester`                         | Lazy-quadtree spatial pick.                 |
| `EventBus<EventMap>`                | Typed pub/sub.                              |
| `primitives` (`drawLine`, …)        | Stateless drawing fns over a CRC2D.         |

### `/chart` — high-level host

| Export                              | Purpose                                       |
| ----------------------------------- | --------------------------------------------- |
| `Chart(canvas, opts)`               | Owns canvas, viewport, scales, layers, RAF.   |
| `Layer`                             | Abstract base for things you draw.            |
| `GridLayer` / `AxisLayer`           | Built-ins added by default; toggle via opts.  |
| `attachInteractions(canvas, vp, size, opts)` | Low-level pan / zoom wiring.         |
| `shareXAxis` / `shareYAxis` / `shareAxes` | Sync viewport domains across panes.     |

### `/adapters` — surfaces overlays attach to

| Export                              | Purpose                                       |
| ----------------------------------- | --------------------------------------------- |
| `Adapter`                           | Contract: `getCanvas / getViewport / addLayer / invalidate / toPixel / toData`, plus optional `setInteractive(on) / getInteractive()` for pointer dispatch. |
| `VanillaChartAdapter(chart)`        | Wraps our `Chart`.                            |
| `TradingViewOverlayAdapter(opts)`   | Wraps an `IChartApi` from `lightweight-charts`. |

### `/overlays` — reusable Layer subclasses

| Export                              | Purpose                                       |
| ----------------------------------- | --------------------------------------------- |
| `SignalArrows`                      | ↑/↓ arrows at `{ ts, side, price, label? }`. |
| `OrderMarkers`                      | Filled diamonds at executed-order fills.      |
| `ZoneBoxes`                         | Translucent rectangles over a time/price box. |
| `PriceLine`                         | Horizontal line + right-edge label.           |
| `ThresholdBand`                     | Translucent band between two Y values.        |
| `BollingerBands`                    | Rolling SMA + std-dev bands.                  |
| `VWAP`                              | Cumulative volume-weighted average price.     |
| `Crosshair`                         | Vertical + horizontal tracker w/ readout.     |
| `DrawingOverlay`                    | Interactive line / polygon / rect annotations, data-anchored + draggable. |

## Architecture

```
                         ┌────────────────────────┐
                         │       Adapter          │
                         │ getCanvas / getViewport│
   ┌────────────┐        │ toPixel / toData       │        ┌────────────────┐
   │ Chart      │◀──────▶│ addLayer / invalidate  │◀──────▶│ Overlay (Layer)│
   │ (vanilla)  │        └─────────┬──────────────┘        │ uses adapter.* │
   └────────────┘                  │                       └────────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │      Viewport      │
                         │ xDomain / yDomain  │
                         │ emits 'change'     │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ xScale + yScale    │
                         │  scale / invert    │
                         │  ticks             │
                         └────────────────────┘
```

Both `VanillaChartAdapter` and `TradingViewOverlayAdapter` expose the
same `xScale` / `yScale` surface — `scale(dataValue) → pixel`,
`invert(pixel) → dataValue`. Overlay code calls `adapter.toPixel(t, p)`
(or `xScale.scale(t)` for the X-only case) and never knows which host
it's drawing onto.

## Adapter authoring

The `Adapter` interface is intentionally small. To target a new host:

1. Build a canvas the layers will paint on (or reuse the host's, with
   permission). Wrap it in `CanvasContext`.
2. Build a `Viewport` whose `xDomain`/`yDomain` mirror the host's
   visible window. Subscribe to host events that change the window and
   call `viewport.setXDomain(...)` etc, which fires `'change'`.
3. Wrap the host's coordinate-mapping fns as `Scale` objects.
4. Implement `addLayer` / `removeLayer` (your own z-ordered list) and
   `invalidate()` (RAF-coalesced render dispatcher).

`TradingViewOverlayAdapter` is the worked example
(`src/adapters/TradingViewOverlayAdapter.ts`).

## Overlay authoring

```ts
import { OverlayBase, type OverlayOptions } from '@rw3iss/graph-utils/overlays';
import type { CanvasContext } from '@rw3iss/graph-utils/core';
import type { Viewport } from '@rw3iss/graph-utils/core';
import type { Adapter } from '@rw3iss/graph-utils/adapters';

interface MyData { ts: number; v: number }

export class MyOverlay extends OverlayBase<MyData[]> {
  constructor(adapter: Adapter, options: OverlayOptions) {
    super(adapter, options);
  }
  draw(ctx: CanvasContext, _vp: Viewport): void {
    const data = this.getData();
    if (!data) return;
    for (const d of data) {
      const { x, y } = this.adapter.toPixel(d.ts, d.v);
      if (!isFinite(x) || !isFinite(y)) continue; // off-screen on TV
      ctx.circle(x, y, 4, { fill: '#ec4899' });
    }
  }
}
```

The constraints:

- Only `ctx` and `adapter` are first-class — no DOM, no host-specific
  references.
- Use `adapter.toPixel(...)`; never assume how the host maps coords.
- Skip points whose pixel is `NaN` (TV returns null outside the visible
  range; the adapter forwards that as NaN).

## Interactive drawing

`DrawingOverlay` lets the user draw data-anchored annotations (line,
polygon, rect) that pan and zoom with the chart — every point is stored
in **data space** and re-projected through `adapter.toPixel` each frame.

```ts
import { TradingViewOverlayAdapter } from '@rw3iss/graph-utils/adapters';
import { DrawingOverlay } from '@rw3iss/graph-utils/overlays';

const adapter = new TradingViewOverlayAdapter({ chart: tv, priceSeries: series });
const draw = new DrawingOverlay(adapter, { id: 'draw' });
adapter.addLayer(draw);

// Toolbar wiring
toolbarLineBtn.onclick    = () => draw.setTool('line');
toolbarPolyBtn.onclick    = () => draw.setTool('polygon'); // right-click finalizes
toolbarRectBtn.onclick    = () => draw.setTool('rect');
toolbarSelectBtn.onclick  = () => draw.setTool('select');  // drag handles / move
toolbarPanBtn.onclick     = () => draw.setTool(null);      // back to chart pan/zoom

// Persistence: save on every mutation, restore on load.
draw.on('change', (drawings) => localStorage.setItem('annotations', JSON.stringify(drawings)));
draw.setDrawings(JSON.parse(localStorage.getItem('annotations') ?? '[]'));

// Flip the toolbar back to pan/select after a shape completes.
draw.on('toolidle', () => draw.setTool('select'));

// The host owns the keyboard. Wire Esc / Delete yourself:
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') draw.cancelInProgress();
  if (e.key === 'Delete' || e.key === 'Backspace') draw.deleteSelected();
});
```

How it interacts with the host:

- When a tool is set (any shape **or** `'select'`), the overlay calls
  `adapter.setInteractive(true)` — the adapter flips its canvas to
  `pointer-events: auto` and forwards pointer events to layers'
  `onPointerDown/Move/Up`, **topmost (highest `zIndex`) first**.
- When the tool is `null`, it calls `adapter.setInteractive(false)` —
  the canvas goes back to `pointer-events: none`, so **TradingView's own
  pan/zoom works unchanged**. The overlay layer keeps drawing; it just
  stops capturing the pointer.
- Right-click (`button === 2`) finalizes a polygon. The adapter
  `preventDefault`s `contextmenu` so the browser menu never pops; the
  drawing overlay reads the `button === 2` pointerdown that fires
  alongside.

Public API: `setTool / getTool`, `getDrawings / setDrawings`, `clear`,
`deleteSelected`, `setStyle / getStyle`, `cancelInProgress`,
`getSelectedId`, and `on('change' | 'toolidle', cb) → unsubscribe`. The
`Drawing` shape is `{ id, type: 'line'|'polygon'|'rect', points:
{x,y}[], style? }` where `x` is the adapter time unit and `y` is price.

## Playground

The repo ships four demos under `playground/`:

```bash
pnpm install
pnpm playground   # alias for pnpm --filter graph-utils-playground dev
```

1. **Line chart** — Chart + Scale + axes (vanilla).
2. **Candle + overlays** — OHLC bars + SignalArrows + ZoneBoxes.
3. **Multi-pane** — price + RSI sharing X via `shareXAxis`.
4. **TradingView** — real `lightweight-charts` chart with
   `SignalArrows`, `PriceLine`, and `Crosshair` overlaid via the TV
   adapter.

The playground is `private: true` and **not part of the published
package**.

## Build

```bash
pnpm build       # tsup → ESM + CJS + .d.ts in dist/
pnpm test        # vitest run
pnpm typecheck   # tsc --noEmit
```

## Roadmap

**v0.3**

- More overlays: `PredictionFan`, `RegimeStripes`,
  `MLConfidenceHeatmap`, `StrategyTraces`.
- Pinch-zoom + two-finger pan in `interactions.ts`.
- Server-side render via `node-canvas` for backtest reports.

## License

MIT.
