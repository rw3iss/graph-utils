import { describe, expect, it } from 'vitest';
import {
  LinearScale,
  LogScale,
  TimeScale,
  niceLinearTicks,
  niceTimeTicks,
} from '../../src/core/Scale.js';

describe('LinearScale', () => {
  it('maps domain → range linearly', () => {
    const s = new LinearScale([0, 100], [0, 500]);
    expect(s.scale(0)).toBe(0);
    expect(s.scale(50)).toBe(250);
    expect(s.scale(100)).toBe(500);
  });

  it('inverts pixel → data', () => {
    const s = new LinearScale([0, 100], [0, 500]);
    expect(s.invert(0)).toBe(0);
    expect(s.invert(250)).toBe(50);
    expect(s.invert(500)).toBe(100);
  });

  it('handles negative domains', () => {
    const s = new LinearScale([-50, 50], [0, 200]);
    expect(s.scale(0)).toBe(100);
    expect(s.scale(-50)).toBe(0);
    expect(s.scale(50)).toBe(200);
    expect(s.invert(100)).toBe(0);
  });

  it('handles inverted range (Y axis case)', () => {
    // Y pixel grows downward; data grows upward → range [h, 0]
    const s = new LinearScale([0, 100], [400, 0]);
    expect(s.scale(0)).toBe(400);
    expect(s.scale(100)).toBe(0);
    expect(s.scale(50)).toBe(200);
  });

  it('returns r0 on degenerate domain', () => {
    const s = new LinearScale([5, 5], [0, 100]);
    expect(s.scale(5)).toBe(0);
    expect(s.scale(99)).toBe(0);
  });

  it('round-trips scale/invert', () => {
    const s = new LinearScale([10, 110], [0, 1000]);
    for (const v of [10, 42, 73.5, 110]) {
      expect(s.invert(s.scale(v))).toBeCloseTo(v, 9);
    }
  });
});

describe('LogScale', () => {
  it('maps log domain → range', () => {
    const s = new LogScale([1, 1000], [0, 300]);
    expect(s.scale(1)).toBeCloseTo(0, 9);
    expect(s.scale(1000)).toBeCloseTo(300, 9);
    expect(s.scale(10)).toBeCloseTo(100, 9);
  });

  it('throws on non-positive domain', () => {
    expect(() => new LogScale([0, 100], [0, 1])).toThrow();
    expect(() => new LogScale([-1, 100], [0, 1])).toThrow();
    const s = new LogScale([1, 10], [0, 1]);
    expect(() => s.setDomain([0, 10])).toThrow();
  });

  it('produces decade ticks', () => {
    const s = new LogScale([1, 1000], [0, 300]);
    expect(s.ticks(4)).toEqual([1, 10, 100, 1000]);
  });

  it('round-trips on positive values', () => {
    const s = new LogScale([1, 1000], [0, 300]);
    for (const v of [1, 5, 50, 999]) {
      expect(s.invert(s.scale(v))).toBeCloseTo(v, 6);
    }
  });
});

describe('TimeScale', () => {
  it('inherits linear mapping', () => {
    const t0 = Date.UTC(2025, 0, 1);
    const t1 = Date.UTC(2025, 0, 2);
    const s = new TimeScale([t0, t1], [0, 800]);
    expect(s.scale(t0)).toBe(0);
    expect(s.scale(t1)).toBe(800);
    expect(s.scale(t0 + 12 * 3600_000)).toBe(400);
  });

  it('emits Date-aware tick bucket sizes', () => {
    const t0 = Date.UTC(2025, 0, 1);
    const t1 = t0 + 24 * 3600_000;
    const ticks = niceTimeTicks(t0, t1, 6);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    // ticks should be increasing
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]!);
  });
});

describe('niceLinearTicks', () => {
  it('produces a sensible count of ticks', () => {
    const ticks = niceLinearTicks(0, 100, 5);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0]!).toBeGreaterThanOrEqual(0);
    expect(ticks[ticks.length - 1]!).toBeLessThanOrEqual(100);
  });

  it('handles equal endpoints', () => {
    expect(niceLinearTicks(5, 5, 5)).toEqual([5]);
  });
});
