import { describe, expect, it, vi } from 'vitest';
import { Viewport } from '../../src/core/Viewport.js';
import { shareXAxis, shareYAxis, shareAxes } from '../../src/chart/SharedAxis.js';

describe('shareXAxis', () => {
  it('seeds followers from the first viewport on attach', () => {
    const a = new Viewport({ xDomain: [10, 20], yDomain: [0, 1] });
    const b = new Viewport({ xDomain: [99, 100], yDomain: [0, 1] });
    shareXAxis([a, b]);
    expect(b.xDomain).toEqual([10, 20]);
  });

  it('propagates X changes from any viewport to all others', () => {
    const a = new Viewport({ xDomain: [0, 10], yDomain: [0, 1] });
    const b = new Viewport({ xDomain: [0, 10], yDomain: [0, 1] });
    const c = new Viewport({ xDomain: [0, 10], yDomain: [0, 1] });
    shareXAxis([a, b, c]);
    b.pan(5, 0);
    expect(a.xDomain).toEqual([5, 15]);
    expect(c.xDomain).toEqual([5, 15]);
  });

  it('leaves Y untouched', () => {
    const a = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    const b = new Viewport({ xDomain: [0, 10], yDomain: [0, 200] });
    shareXAxis([a, b]);
    a.setYDomain([10, 90]);
    expect(b.yDomain).toEqual([0, 200]); // unchanged
  });

  it('detach stops propagation', () => {
    const a = new Viewport({ xDomain: [0, 10], yDomain: [0, 1] });
    const b = new Viewport({ xDomain: [0, 10], yDomain: [0, 1] });
    const detach = shareXAxis([a, b]);
    detach();
    a.pan(3, 0);
    expect(b.xDomain).toEqual([0, 10]);
  });

  it('does not infinite-loop on cross-emit', () => {
    const a = new Viewport({ xDomain: [0, 10], yDomain: [0, 1] });
    const b = new Viewport({ xDomain: [0, 10], yDomain: [0, 1] });
    shareXAxis([a, b]);
    const spyA = vi.fn();
    const spyB = vi.fn();
    a.bus.on('change', spyA);
    b.bus.on('change', spyB);
    a.pan(1, 0);
    // a fires once, b fires once when its setXDomain is called by the
    // shared handler, but the re-entry guard prevents another a-emit.
    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
  });
});

describe('shareYAxis', () => {
  it('propagates Y but not X', () => {
    const a = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    const b = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    shareYAxis([a, b]);
    a.setYDomain([50, 150]);
    expect(b.yDomain).toEqual([50, 150]);
    a.setXDomain([5, 15]);
    expect(b.xDomain).toEqual([0, 10]);
  });
});

describe('shareAxes', () => {
  it('shares both X and Y', () => {
    const a = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    const b = new Viewport({ xDomain: [0, 10], yDomain: [0, 100] });
    const detach = shareAxes([a, b]);
    a.pan(2, 5);
    expect(b.xDomain).toEqual([2, 12]);
    expect(b.yDomain).toEqual([5, 105]);
    detach();
    a.pan(100, 100);
    expect(b.xDomain).toEqual([2, 12]); // no further propagation
  });
});
