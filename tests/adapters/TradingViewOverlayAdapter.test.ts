/**
 * @vitest-environment happy-dom
 *
 * Integration-style unit tests for TradingViewOverlayAdapter. We don't load
 * `lightweight-charts` itself — instead, build a deterministic mock that
 * implements the bits of `IChartApi` / `ISeriesApi` we depend on. This
 * catches contract regressions in the adapter (toPixel, viewport sync,
 * layer dispatch) without booting a real chart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TradingViewOverlayAdapter,
  type TradingViewChart,
  type TradingViewSeries,
  type TradingViewTimeScale,
  type TradingViewLogicalRange,
  type TradingViewTimeRange,
} from '../../src/adapters/TradingViewOverlayAdapter.js';
import { Layer, type LayerPointerEvent } from '../../src/chart/Layer.js';
import type { CanvasContext } from '../../src/core/CanvasContext.js';
import type { Viewport } from '../../src/core/Viewport.js';

/**
 * Build a mock TV chart whose time/price coordinate fns are linear in a
 * known visible window so assertions are exact.
 *
 *   - timeRange:  visible time in unix seconds
 *   - timePixels: pixel range [left, right] mapping the time range
 *   - priceRange: visible price [lo, hi]
 *   - pricePixels:pixel range [bottom, top] (TV's Y grows down, prices up)
 */
function mockTradingView(opts: {
  timeRange: [number, number];
  timePixels: [number, number];
  priceRange: [number, number];
  pricePixels: [number, number];
}): { chart: TradingViewChart; series: TradingViewSeries; element: HTMLElement } {
  const [t0, t1] = opts.timeRange;
  const [x0, x1] = opts.timePixels;
  const [p0, p1] = opts.priceRange;
  const [y0, y1] = opts.pricePixels;

  const logicalSubs = new Set<(r: TradingViewLogicalRange | null) => void>();
  const timeSubs = new Set<(r: TradingViewTimeRange | null) => void>();
  const crosshairSubs = new Set<(p: unknown) => void>();

  const timeScale: TradingViewTimeScale = {
    timeToCoordinate(time) {
      const t = typeof time === 'number' ? time : Number(time);
      if (t < t0 || t > t1) return null;
      return x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
    },
    coordinateToTime(coord) {
      if (coord < x0 || coord > x1) return null;
      return t0 + ((coord - x0) / (x1 - x0)) * (t1 - t0);
    },
    getVisibleRange() {
      return { from: t0, to: t1 };
    },
    getVisibleLogicalRange() {
      return { from: 0, to: 100 };
    },
    subscribeVisibleLogicalRangeChange(h) {
      logicalSubs.add(h);
    },
    unsubscribeVisibleLogicalRangeChange(h) {
      logicalSubs.delete(h);
    },
    subscribeVisibleTimeRangeChange(h) {
      timeSubs.add(h);
    },
    unsubscribeVisibleTimeRangeChange(h) {
      timeSubs.delete(h);
    },
  };

  const series: TradingViewSeries = {
    priceToCoordinate(price) {
      if (price < p0 || price > p1) return null;
      // TV-style: higher price → smaller Y
      return y0 + ((price - p0) / (p1 - p0)) * (y1 - y0);
    },
    coordinateToPrice(coord) {
      if (Math.min(y0, y1) > coord || coord > Math.max(y0, y1)) return null;
      return p0 + ((coord - y0) / (y1 - y0)) * (p1 - p0);
    },
  };

  const element = document.createElement('div');
  element.style.width = `${x1 - x0}px`;
  element.style.height = `${Math.abs(y0 - y1)}px`;
  // Stub getBoundingClientRect for happy-dom.
  element.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: x1 - x0,
      bottom: Math.abs(y0 - y1),
      width: x1 - x0,
      height: Math.abs(y0 - y1),
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  const chart: TradingViewChart = {
    timeScale: () => timeScale,
    chartElement: () => element,
    subscribeCrosshairMove(h) {
      crosshairSubs.add(h as (p: unknown) => void);
    },
    unsubscribeCrosshairMove(h) {
      crosshairSubs.delete(h as (p: unknown) => void);
    },
  };

  return { chart, series, element };
}

/** A minimal 2D context stub — just enough for CanvasContext + primitives
 *  to not blow up. happy-dom doesn't ship a real 2D context. */
function stubCanvas2D(): void {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const original = proto.getContext;
  proto.getContext = function (kind: string): unknown {
    if (kind !== '2d') return null;
    const noop = (): void => {};
    return {
      canvas: this,
      save: noop,
      restore: noop,
      clearRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      rect: noop,
      fill: noop,
      stroke: noop,
      fillRect: noop,
      strokeRect: noop,
      fillText: noop,
      setLineDash: noop,
      setTransform: noop,
      translate: noop,
      rotate: noop,
      scale: noop,
      clip: noop,
      closePath: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      // assignable state — touch but ignore
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      __restore: original,
    };
  } as typeof proto.getContext;
}

describe('TradingViewOverlayAdapter', () => {
  beforeEach(() => {
    stubCanvas2D();
    // happy-dom doesn't ship ResizeObserver by default in older versions —
    // stub a noop if missing.
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    }
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('attaches an overlay canvas to the chart container', () => {
    const { chart, series, element } = mockTradingView({
      timeRange: [1000, 2000],
      timePixels: [0, 800],
      priceRange: [100, 200],
      pricePixels: [400, 0],
    });
    const container = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);

    const adapter = new TradingViewOverlayAdapter({ chart, priceSeries: series });
    const canvas = adapter.getCanvas();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.parentElement).toBe(container);
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.style.pointerEvents).toBe('none');
    adapter.destroy();
    expect(canvas.parentElement).toBe(null);
  });

  it('maps (time, price) → pixel via TV scales', () => {
    const { chart, series, element } = mockTradingView({
      timeRange: [1000, 2000],
      timePixels: [0, 800],
      priceRange: [100, 200],
      pricePixels: [400, 0], // bottom=400 at price 100, top=0 at price 200
    });
    const container = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);

    const adapter = new TradingViewOverlayAdapter({ chart, priceSeries: series });
    // mid time, mid price
    const p = adapter.toPixel(1500, 150);
    expect(p.x).toBeCloseTo(400, 6);
    expect(p.y).toBeCloseTo(200, 6);
    // x at edges
    expect(adapter.toPixel(1000, 100)).toEqual({ x: 0, y: 400 });
    expect(adapter.toPixel(2000, 200)).toEqual({ x: 800, y: 0 });
    adapter.destroy();
  });

  it('returns NaN when a coord is outside the visible range', () => {
    const { chart, series, element } = mockTradingView({
      timeRange: [1000, 2000],
      timePixels: [0, 800],
      priceRange: [100, 200],
      pricePixels: [400, 0],
    });
    const container = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);
    const adapter = new TradingViewOverlayAdapter({ chart, priceSeries: series });
    const p = adapter.toPixel(500, 50);
    expect(Number.isNaN(p.x)).toBe(true);
    expect(Number.isNaN(p.y)).toBe(true);
    adapter.destroy();
  });

  it('converts ms → seconds when timeUnit=milliseconds', () => {
    const { chart, series, element } = mockTradingView({
      timeRange: [1000, 2000], // seconds in TV
      timePixels: [0, 1000],
      priceRange: [0, 100],
      pricePixels: [200, 0],
    });
    const container = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);
    const adapter = new TradingViewOverlayAdapter({
      chart,
      priceSeries: series,
      timeUnit: 'milliseconds',
    });
    // 1_500_000 ms = 1500 s → mid pixel = 500
    expect(adapter.toPixel(1_500_000, 50).x).toBeCloseTo(500, 6);
    adapter.destroy();
  });

  it('calls layer.draw with ctx + viewport on render()', async () => {
    const { chart, series, element } = mockTradingView({
      timeRange: [1000, 2000],
      timePixels: [0, 400],
      priceRange: [0, 100],
      pricePixels: [200, 0],
    });
    const container = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);
    const adapter = new TradingViewOverlayAdapter({ chart, priceSeries: series });

    const seen: { ctx: CanvasContext | null; vp: Viewport | null } = { ctx: null, vp: null };
    class Probe extends Layer {
      draw(ctx: CanvasContext, vp: Viewport): void {
        seen.ctx = ctx;
        seen.vp = vp;
      }
    }
    adapter.addLayer(new Probe('probe'));
    adapter.render();
    expect(seen.ctx).not.toBeNull();
    expect(seen.vp).not.toBeNull();
    // xScale lives on adapter, so verify it works inside the layer view.
    const xMid = adapter.xScale.scale(1500);
    expect(xMid).toBeCloseTo(200, 6);
    adapter.destroy();
  });

  it('setInteractive toggles pointer-events and dispatches to layers topmost-first', () => {
    const { chart, series, element } = mockTradingView({
      timeRange: [1000, 2000],
      timePixels: [0, 400],
      priceRange: [0, 100],
      pricePixels: [200, 0],
    });
    const container = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);
    const adapter = new TradingViewOverlayAdapter({ chart, priceSeries: series });
    // Overlay canvas reports a known rect so client→canvas math is exact.
    const canvas = adapter.getCanvas();
    canvas.getBoundingClientRect = () =>
      ({ left: 5, top: 7, right: 405, bottom: 207, width: 400, height: 200, x: 5, y: 7, toJSON: () => ({}) }) as DOMRect;

    expect(adapter.getInteractive?.()).toBe(false);
    expect(canvas.style.pointerEvents).toBe('none');

    const order: string[] = [];
    const seenDown: LayerPointerEvent[] = [];
    class Probe extends Layer {
      constructor(id: string, z: number) {
        super(id);
        this.zIndex = z;
      }
      draw(): void {}
      onPointerDown(e: LayerPointerEvent): void {
        order.push(this.id);
        seenDown.push(e);
      }
    }
    adapter.addLayer(new Probe('back', 0));
    adapter.addLayer(new Probe('front', 10));

    adapter.setInteractive?.(true);
    expect(adapter.getInteractive?.()).toBe(true);
    expect(canvas.style.pointerEvents).toBe('auto');

    // Right-click pointerdown at client (105, 57) → canvas-local (100, 50).
    const ev = new PointerEvent('pointerdown', { clientX: 105, clientY: 57, button: 2 });
    canvas.dispatchEvent(ev);
    // topmost (highest zIndex) first
    expect(order).toEqual(['front', 'back']);
    expect(seenDown[0]!.x).toBeCloseTo(100, 6);
    expect(seenDown[0]!.y).toBeCloseTo(50, 6);
    expect((seenDown[0]!.source as PointerEvent).button).toBe(2);

    // contextmenu is suppressed (preventDefault) so the right-click can be
    // used to finalize a polygon without the browser menu popping.
    const menu = new Event('contextmenu', { cancelable: true });
    canvas.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);

    // Turning it off restores pointer-events and stops dispatch.
    adapter.setInteractive?.(false);
    expect(canvas.style.pointerEvents).toBe('none');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 105, clientY: 57 }));
    expect(order).toEqual(['front', 'back']); // unchanged — no new dispatch

    adapter.destroy();
  });

  it('unsubscribes TV handlers on destroy', () => {
    const { chart, series, element } = mockTradingView({
      timeRange: [1000, 2000],
      timePixels: [0, 400],
      priceRange: [0, 100],
      pricePixels: [200, 0],
    });
    const container = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);
    const ts = chart.timeScale();
    const unsubSpy = vi.spyOn(ts, 'unsubscribeVisibleLogicalRangeChange');
    const adapter = new TradingViewOverlayAdapter({ chart, priceSeries: series });
    adapter.destroy();
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });
});
