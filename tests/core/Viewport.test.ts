import { describe, expect, it, vi } from 'vitest';
import { Viewport } from '../../src/core/Viewport.js';

describe('Viewport', () => {
  it('reports the initial state', () => {
    const v = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    expect(v.xDomain).toEqual([0, 10]);
    expect(v.yDomain).toEqual([0, 100]);
  });

  it('pan translates both axes', () => {
    const v = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    v.pan(2, -10);
    expect(v.xDomain).toEqual([2, 12]);
    expect(v.yDomain).toEqual([-10, 90]);
  });

  it('zoom preserves the anchor point in data space', () => {
    const v = new Viewport({ xDomain: [0, 100], yDomain: [0, 100] });
    // Zoom in 2x at the right edge (anchor 1.0). Right edge data should stay 100.
    v.zoom(0.5, { x: 1.0 });
    const x = v.xDomain;
    expect(x[1]).toBeCloseTo(100, 9);
    expect(x[1] - x[0]).toBeCloseTo(50, 9);
  });

  it('zoom anchor at center keeps center fixed', () => {
    const v = new Viewport({ xDomain: [0, 100], yDomain: [0, 100] });
    v.zoom(0.5, { x: 0.5, y: 0.5 });
    expect(v.xDomain[0]! + (v.xDomain[1]! - v.xDomain[0]!) / 2).toBeCloseTo(50, 9);
    expect(v.yDomain[0]! + (v.yDomain[1]! - v.yDomain[0]!) / 2).toBeCloseTo(50, 9);
    expect(v.xDomain[1]! - v.xDomain[0]!).toBeCloseTo(50, 9);
  });

  it('emits a change event on pan and zoom', () => {
    const v = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    const fn = vi.fn();
    v.bus.on('change', fn);
    v.pan(1, 1);
    v.zoom(2, { x: 0.5 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clamps domain to xBounds when panning past', () => {
    const v = new Viewport({
      xDomain: [0, 10],
      yDomain: [0, 1],
      xBounds: [0, 100],
    });
    v.pan(-50, 0);
    expect(v.xDomain).toEqual([0, 10]);
  });

  it('respects xMinSpan / xMaxSpan when zooming', () => {
    const v = new Viewport({
      xDomain: [0, 100],
      yDomain: [0, 1],
      xMinSpan: 10,
      xMaxSpan: 500,
    });
    v.zoom(0.001, { x: 0.5 }); // try to zoom way in
    expect(v.xDomain[1]! - v.xDomain[0]!).toBeCloseTo(10, 9);
    v.zoom(1000, { x: 0.5 }); // try to zoom way out
    expect(v.xDomain[1]! - v.xDomain[0]!).toBeCloseTo(500, 9);
  });
});
