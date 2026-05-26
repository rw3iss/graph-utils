/**
 * Demo 4: TradingView lightweight-charts host + our overlays.
 *
 * Boots a real TV line chart, builds a TradingViewOverlayAdapter on top,
 * and stacks SignalArrows + PriceLine + Crosshair on it. The TV chart
 * handles pan/zoom; our adapter mirrors the visible window via
 * subscribeVisibleLogicalRangeChange.
 */
import { useEffect, useRef } from 'preact/hooks';
import { createChart, ColorType, LineSeries, type IChartApi } from 'lightweight-charts';
import { TradingViewOverlayAdapter } from '@rw3iss/graph-utils/adapters';
import { SignalArrows, PriceLine, Crosshair } from '@rw3iss/graph-utils/overlays';

export function TradingViewDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    // TV expects an explicit width/height; let the container drive it.
    const rect = container.getBoundingClientRect();
    const chart: IChartApi = createChart(container, {
      width: rect.width || 800,
      height: rect.height || 480,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0d12' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    // Build a fake intraday line series.
    const startSec = Math.floor(Date.UTC(2025, 0, 1, 14, 30) / 1000);
    const N = 200;
    const data: { time: number; value: number }[] = [];
    let v = 100;
    for (let i = 0; i < N; i++) {
      v += (Math.random() - 0.48) * 0.6;
      data.push({ time: startSec + i * 60, value: v });
    }
    const series = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 2 });
    series.setData(
      data.map((d) => ({
        time: d.time as unknown as Parameters<typeof series.setData>[0][number]['time'],
        value: d.value,
      })) as Parameters<typeof series.setData>[0],
    );
    chart.timeScale().fitContent();

    // Overlay adapter — note priceSeries is required.
    const adapter = new TradingViewOverlayAdapter({ chart, priceSeries: series });

    // Buy / sell signals at fixed bars.
    const sigs = new SignalArrows(adapter, { id: 'signals' });
    sigs.setData([
      { ts: data[40]!.time, side: 'buy', price: data[40]!.value, label: 'long' },
      { ts: data[120]!.time, side: 'sell', price: data[120]!.value, label: 'short' },
      { ts: data[170]!.time, side: 'buy', price: data[170]!.value, label: 'add' },
    ]);

    // Take-profit / stop-loss style price lines.
    const lastPrice = data[N - 1]!.value;
    const tp = new PriceLine(adapter, { id: 'tp', color: '#16a34a' });
    tp.setData({ price: lastPrice + 1.5, label: 'TP' });
    const sl = new PriceLine(adapter, { id: 'sl', color: '#dc2626' });
    sl.setData({ price: lastPrice - 1.5, label: 'SL' });

    // Crosshair on the TV chart element. The overlay canvas is
    // pointer-events: none, so we listen on the chart element itself.
    const cross = new Crosshair(adapter, {
      id: 'cross',
      formatX: (x) => new Date(x * 1000).toISOString().slice(11, 16),
    });
    const detachCross = cross.attach(chart.chartElement());
    adapter.addLayer(cross);

    // Keep TV sized to its container.
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      chart.resize(r.width, r.height);
    });
    ro.observe(container);

    return () => {
      detachCross();
      adapter.destroy();
      ro.disconnect();
      chart.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480 }}
    />
  );
}
