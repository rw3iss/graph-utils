/**
 * Math-only tests for the overlay indicators. The drawing side gets
 * exercised by manual playground smoke; the rolling-window math is what
 * actually breaks if someone fiddles with it, so it gets pinned here.
 */
import { describe, expect, it } from 'vitest';
import { computeBands } from '../../src/overlays/BollingerBands.js';
import { computeVWAP } from '../../src/overlays/VWAP.js';

describe('computeBands', () => {
  it('returns NaNs for the first window-1 bars', () => {
    const data = Array.from({ length: 25 }, (_, i) => ({ t: i, v: 100 + i }));
    const { mid, upper, lower } = computeBands(data, 20, 2);
    for (let i = 0; i < 19; i++) {
      expect(mid[i]).toBeNaN();
      expect(upper[i]).toBeNaN();
      expect(lower[i]).toBeNaN();
    }
    expect(mid[19]).not.toBeNaN();
  });

  it('mid equals SMA over the window', () => {
    // Constant series → SMA is the constant, stddev is 0, bands collapse.
    const data = Array.from({ length: 10 }, (_, i) => ({ t: i, v: 42 }));
    const { mid, upper, lower } = computeBands(data, 5, 2);
    expect(mid[4]).toBeCloseTo(42, 9);
    expect(upper[4]).toBeCloseTo(42, 9);
    expect(lower[4]).toBeCloseTo(42, 9);
  });

  it('upper - mid == k * stddev (within tolerance)', () => {
    // Triangle pattern with known variance.
    const data = [1, 2, 3, 4, 5].map((v, i) => ({ t: i, v }));
    // population variance of [1,2,3,4,5] = 2; stddev = sqrt(2)
    const { mid, upper } = computeBands(data, 5, 2);
    expect(mid[4]).toBeCloseTo(3, 9);
    expect(upper[4]! - mid[4]!).toBeCloseTo(2 * Math.sqrt(2), 9);
  });

  it('handles empty input', () => {
    const out = computeBands([], 20, 2);
    expect(out.mid).toEqual([]);
  });
});

describe('computeVWAP', () => {
  it('cumulative price-volume / volume', () => {
    const data = [
      { t: 0, price: 10, volume: 1 },
      { t: 1, price: 20, volume: 1 },
      { t: 2, price: 30, volume: 2 },
    ];
    const v = computeVWAP(data);
    expect(v[0]).toBeCloseTo(10, 9);
    expect(v[1]).toBeCloseTo(15, 9); // (10+20)/2
    expect(v[2]).toBeCloseTo((10 + 20 + 60) / 4, 9); // 22.5
  });

  it('NaN when volume is zero at first point and never accumulates', () => {
    const data = [
      { t: 0, price: 100, volume: 0 },
      { t: 1, price: 100, volume: 0 },
    ];
    const v = computeVWAP(data);
    expect(v[0]).toBeNaN();
    expect(v[1]).toBeNaN();
  });

  it('resets at given timestamps', () => {
    const data = [
      { t: 0, price: 10, volume: 1 },
      { t: 1, price: 20, volume: 1 },
      { t: 2, price: 100, volume: 1 }, // reset boundary at t=2
      { t: 3, price: 200, volume: 1 },
    ];
    const v = computeVWAP(data, [2]);
    expect(v[0]).toBeCloseTo(10, 9);
    expect(v[1]).toBeCloseTo(15, 9);
    expect(v[2]).toBeCloseTo(100, 9); // fresh accumulation starts here
    expect(v[3]).toBeCloseTo(150, 9);
  });

  it('handles empty input', () => {
    expect(computeVWAP([])).toEqual([]);
  });
});
