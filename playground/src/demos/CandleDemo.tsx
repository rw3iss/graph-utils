/**
 * Demo 2: Vanilla candle-ish chart with overlays.
 *
 * Renders OHLC bars (not pretty — wicks + body) via a custom Layer, then
 * stacks SignalArrows and ZoneBoxes on top via the VanillaChartAdapter.
 */
import { useEffect, useRef } from 'preact/hooks';
import { Chart, Layer } from '@rw3iss/graph-utils/chart';
import type { CanvasContext } from '@rw3iss/graph-utils/core';
import { VanillaChartAdapter } from '@rw3iss/graph-utils/adapters';
import { SignalArrows, ZoneBoxes } from '@rw3iss/graph-utils/overlays';

interface Candle {
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

class CandleLayer extends Layer {
  private chart: Chart;
  private candles: Candle[];
  constructor(chart: Chart, candles: Candle[]) {
    super('candles');
    this.chart = chart;
    this.candles = candles;
    this.zIndex = 0;
  }
  draw(ctx: CanvasContext): void {
    const { xScale, yScale } = this.chart;
    const w = Math.max(2, (xScale.scale(this.candles[1]!.ts) - xScale.scale(this.candles[0]!.ts)) * 0.7);
    for (const k of this.candles) {
      const x = xScale.scale(k.ts);
      const yO = yScale.scale(k.o);
      const yC = yScale.scale(k.c);
      const yH = yScale.scale(k.h);
      const yL = yScale.scale(k.l);
      const up = k.c >= k.o;
      const color = up ? '#22c55e' : '#ef4444';
      ctx.line(x, yH, x, yL, color, 1);
      const top = Math.min(yO, yC);
      const h = Math.abs(yC - yO) || 1;
      ctx.rect(x - w / 2, top, w, h, { fill: color });
    }
  }
}

export function CandleDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const candles = makeCandles(80);
    const lows = candles.map((k) => k.l);
    const highs = candles.map((k) => k.h);
    const chart = new Chart(ref.current, {
      xDomain: [candles[0]!.ts, candles[candles.length - 1]!.ts],
      yDomain: [Math.min(...lows) - 2, Math.max(...highs) + 2],
      yTickFormatter: (v) => v.toFixed(1),
      xTickFormatter: (v) => new Date(v).toISOString().slice(11, 16),
    });
    chart.addLayer(new CandleLayer(chart, candles));

    const adapter = new VanillaChartAdapter(chart);

    const zones = new ZoneBoxes(adapter, { id: 'zones', zIndex: -50 });
    zones.setData([
      {
        from: candles[10]!.ts,
        to: candles[20]!.ts,
        fill: 'rgba(99,102,241,0.12)',
        label: 'breakout zone',
      },
      {
        from: candles[40]!.ts,
        to: candles[55]!.ts,
        fill: 'rgba(244,114,182,0.12)',
        label: 'consolidation',
      },
    ]);

    const signals = new SignalArrows(adapter, { id: 'signals', zIndex: 50 });
    signals.setData([
      { ts: candles[15]!.ts, side: 'buy', price: candles[15]!.l, label: 'long' },
      { ts: candles[45]!.ts, side: 'sell', price: candles[45]!.h, label: 'short' },
      { ts: candles[65]!.ts, side: 'buy', price: candles[65]!.l, label: 'add' },
    ]);

    return () => chart.destroy();
  }, []);
  return <canvas ref={ref} />;
}

function makeCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  const startTs = Date.UTC(2025, 0, 1, 9, 30);
  for (let i = 0; i < n; i++) {
    const o = price;
    const c = price + (Math.random() - 0.5) * 3;
    const h = Math.max(o, c) + Math.random() * 1.5;
    const l = Math.min(o, c) - Math.random() * 1.5;
    out.push({ ts: startTs + i * 60_000, o, h, l, c });
    price = c;
  }
  return out;
}
