/**
 * Demo 1: Vanilla line chart.
 * Chart + Scale + default Axis + Grid. Custom Layer plots a polyline.
 */
import { useEffect, useRef } from 'preact/hooks';
import { Chart, Layer } from '@rw3iss/graph-utils/chart';
import type { CanvasContext } from '@rw3iss/graph-utils/core';

class LineLayer extends Layer {
  private chart: Chart;
  private data: { x: number; y: number }[];
  constructor(chart: Chart, data: { x: number; y: number }[]) {
    super('line');
    this.chart = chart;
    this.data = data;
  }
  draw(ctx: CanvasContext): void {
    const pts = this.data.map((p) => ({
      x: this.chart.xScale.scale(p.x),
      y: this.chart.yScale.scale(p.y),
    }));
    ctx.polyline(pts, '#4ade80', 2);
    for (const p of pts) ctx.circle(p.x, p.y, 2.5, { fill: '#4ade80' });
  }
}

export function LineDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const data = makeSeries(120);
    const chart = new Chart(ref.current, {
      xDomain: [0, data.length - 1],
      yDomain: [Math.min(...data.map((p) => p.y)) - 5, Math.max(...data.map((p) => p.y)) + 5],
      xMinSpan: 5,
      yTickFormatter: (v) => v.toFixed(1),
    });
    chart.addLayer(new LineLayer(chart, data));
    chart.render();
    return () => chart.destroy();
  }, []);
  return <canvas ref={ref} />;
}

function makeSeries(n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let v = 100;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * 4;
    out.push({ x: i, y: v });
  }
  return out;
}
