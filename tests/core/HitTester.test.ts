import { describe, expect, it } from 'vitest';
import { HitTester } from '../../src/core/HitTester.js';

describe('HitTester', () => {
  it('picks a point within tolerance', () => {
    const ht = new HitTester<string>();
    ht.add({ kind: 'point', x: 100, y: 100 }, 'a');
    expect(ht.pick(102, 101, 4)?.payload).toBe('a');
    expect(ht.pick(120, 100, 4)).toBeNull();
  });

  it('returns topmost (last drawn) on overlap', () => {
    const ht = new HitTester<string>();
    ht.add({ kind: 'circle', x: 50, y: 50, r: 20 }, 'bottom');
    ht.add({ kind: 'circle', x: 50, y: 50, r: 10 }, 'top');
    expect(ht.pick(50, 50)?.payload).toBe('top');
  });

  it('hits rectangles inclusively', () => {
    const ht = new HitTester<string>();
    ht.add({ kind: 'rect', x: 10, y: 10, w: 50, h: 30 }, 'r');
    expect(ht.pick(35, 25)?.payload).toBe('r');
    expect(ht.pick(60, 40)?.payload).toBe('r'); // edge
    expect(ht.pick(80, 80, 0)).toBeNull();
  });

  it('hits polylines within line-width tolerance', () => {
    const ht = new HitTester<string>();
    ht.add(
      {
        kind: 'polyline',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        lineWidth: 2,
      },
      'p',
    );
    expect(ht.pick(50, 1, 2)?.payload).toBe('p');
    expect(ht.pick(101, 50, 2)?.payload).toBe('p');
    expect(ht.pick(50, 50, 2)).toBeNull();
  });

  it('clear() empties the index', () => {
    const ht = new HitTester<number>();
    ht.add({ kind: 'point', x: 0, y: 0 }, 1);
    ht.clear();
    expect(ht.size).toBe(0);
    expect(ht.pick(0, 0)).toBeNull();
  });

  it('falls back to quadtree past the threshold and still picks correctly', () => {
    const ht = new HitTester<number>();
    // 1100 spread-out points; one specifically placed
    for (let i = 0; i < 1100; i++) {
      ht.add({ kind: 'point', x: (i % 100) * 5, y: Math.floor(i / 100) * 5 }, i);
    }
    ht.add({ kind: 'point', x: 7777, y: 8888 }, 999_999);
    expect(ht.pick(7777, 8888)?.payload).toBe(999_999);
    // a point that exists in the grid
    const hit = ht.pick(0, 0);
    expect(hit).not.toBeNull();
  });
});
