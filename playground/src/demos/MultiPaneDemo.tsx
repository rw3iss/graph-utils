/**
 * Demo 3: Multi-pane (strategy-debugger shaped).
 *
 * Two stacked Charts that share a single Viewport so panning the X axis
 * in either pane scrolls both. Top pane = price (line). Bottom = a fake
 * "RSI" indicator. Both gain SignalArrows from the same data.
 */
import { useEffect, useRef } from 'preact/hooks';
import { Chart, Layer } from '@rw3iss/graph-utils/chart';
import { Viewport, type CanvasContext } from '@rw3iss/graph-utils/core';
import { VanillaChartAdapter } from '@rw3iss/graph-utils/adapters';
import { SignalArrows, OrderMarkers } from '@rw3iss/graph-utils/overlays';

class SeriesLayer extends Layer {
  constructor(
    private chart: Chart,
    private data: { x: number; y: number }[],
    private color: string,
  ) {
    super(`series-${color}`);
  }
  draw(ctx: CanvasContext): void {
    const pts = this.data.map((p) => ({
      x: this.chart.xScale.scale(p.x),
      y: this.chart.yScale.scale(p.y),
    }));
    ctx.polyline(pts, { stroke: this.color, lineWidth: 1.5 });
  }
}

export function MultiPaneDemo() {
  const topRef = useRef<HTMLCanvasElement>(null);
  const bottomRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!topRef.current || !bottomRef.current) return;
    const N = 200;
    const startTs = Date.UTC(2025, 0, 1);
    const price: { x: number; y: number }[] = [];
    const rsi: { x: number; y: number }[] = [];
    let p = 100;
    for (let i = 0; i < N; i++) {
      p += (Math.random() - 0.48) * 2;
      price.push({ x: startTs + i * 60_000, y: p });
      rsi.push({ x: startTs + i * 60_000, y: 50 + Math.sin(i / 8) * 25 });
    }
    const xMin = price[0]!.x;
    const xMax = price[N - 1]!.x;

    // Shared viewport for X. Each chart has its own Y viewport internally, but
    // since Chart owns its viewport, we sync X manually on change.
    const shared = new Viewport({
      xDomain: [xMin, xMax],
      yDomain: [0, 1],
    });

    const top = new Chart(topRef.current, {
      xDomain: [xMin, xMax],
      yDomain: [Math.min(...price.map((d) => d.y)) - 2, Math.max(...price.map((d) => d.y)) + 2],
      xTickFormatter: (v) => new Date(v).toISOString().slice(11, 16),
      yTickFormatter: (v) => v.toFixed(1),
      padding: { top: 12, right: 16, bottom: 24, left: 56 },
    });
    const bottom = new Chart(bottomRef.current, {
      xDomain: [xMin, xMax],
      yDomain: [0, 100],
      xTickFormatter: (v) => new Date(v).toISOString().slice(11, 16),
      yTickFormatter: (v) => v.toFixed(0),
      padding: { top: 12, right: 16, bottom: 24, left: 56 },
    });

    top.addLayer(new SeriesLayer(top, price, '#60a5fa'));
    bottom.addLayer(new SeriesLayer(bottom, rsi, '#f59e0b'));

    const topAdapter = new VanillaChartAdapter(top);
    const sigs = new SignalArrows(topAdapter, { id: 'sigs' });
    sigs.setData([
      { ts: price[40]!.x, side: 'buy', price: price[40]!.y },
      { ts: price[120]!.x, side: 'sell', price: price[120]!.y },
    ]);
    const orders = new OrderMarkers(topAdapter, { id: 'orders' });
    orders.setData([
      { ts: price[42]!.x, side: 'buy', price: price[42]!.y, qty: 100, label: '100' },
      { ts: price[122]!.x, side: 'sell', price: price[122]!.y, qty: 100, label: '100' },
    ]);

    // Sync X on any pan/zoom in either pane.
    let syncing = false;
    const syncFrom = (src: Chart, dst: Chart) => () => {
      if (syncing) return;
      syncing = true;
      dst.viewport.setXDomain(src.viewport.xDomain);
      syncing = false;
    };
    const unsubTop = top.viewport.bus.on('change', syncFrom(top, bottom));
    const unsubBot = bottom.viewport.bus.on('change', syncFrom(bottom, top));

    return () => {
      unsubTop();
      unsubBot();
      top.destroy();
      bottom.destroy();
      shared.bus.clear();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div class="pane" style={{ flex: 2 }}>
        <h2 style={{ padding: '6px 8px 0' }}>Price</h2>
        <canvas ref={topRef} />
      </div>
      <div class="pane" style={{ flex: 1 }}>
        <h2 style={{ padding: '6px 8px 0' }}>RSI</h2>
        <canvas ref={bottomRef} />
      </div>
    </div>
  );
}
