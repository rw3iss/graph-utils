/**
 * Unit tests for DrawingOverlay against a minimal fake Adapter.
 *
 * The fake uses an identity coordinate mapping (toPixel/toData are 1:1) so
 * pixel == data and assertions on placed points are exact. We never call
 * `draw`, so no canvas/2d-context stubbing is needed; this stays in the
 * default node environment.
 */
import { describe, expect, it, vi } from 'vitest';
import { DrawingOverlay, FIB_LEVELS, type Drawing } from '../../src/overlays/DrawingOverlay.js';
import type { Adapter } from '../../src/adapters/Adapter.js';
import type { Layer } from '../../src/chart/Layer.js';
import type { Viewport } from '../../src/core/Viewport.js';
import type { LayerPointerEvent } from '../../src/chart/Layer.js';

/** A fake Adapter with identity coordinate mapping and call counters. */
function fakeAdapter(): Adapter & {
  invalidateCount: number;
  interactiveCalls: boolean[];
} {
  const state = {
    invalidateCount: 0,
    interactiveCalls: [] as boolean[],
    interactive: false,
  };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLCanvasElement;
  return {
    getCanvas: () => canvas,
    getViewport: () => ({}) as unknown as Viewport,
    addLayer: (_l: Layer) => {},
    removeLayer: (_l: string | Layer) => {},
    invalidate() {
      state.invalidateCount += 1;
    },
    toPixel: (x: number, y: number) => ({ x, y }),
    toData: (px: number, py: number) => ({ x: px, y: py }),
    setInteractive(on: boolean) {
      state.interactive = on;
      state.interactiveCalls.push(on);
    },
    getInteractive: () => state.interactive,
    get invalidateCount() {
      return state.invalidateCount;
    },
    get interactiveCalls() {
      return state.interactiveCalls;
    },
  };
}

/** Build a LayerPointerEvent with an optional mouse button (2 = right). */
function pe(x: number, y: number, button = 0): LayerPointerEvent {
  return { x, y, source: { button } as unknown as PointerEvent };
}

describe('DrawingOverlay', () => {
  it('setTool toggles adapter.setInteractive', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });

    overlay.setTool('line');
    expect(a.interactiveCalls[0]).toBe(true);
    expect(a.getInteractive()).toBe(true);
    expect(overlay.getTool()).toBe('line');

    // 'select' also wants interaction → overlay forwards true again
    // (real adapters dedupe internally; the overlay does not assume that).
    overlay.setTool('select');
    expect(a.getInteractive()).toBe(true);

    overlay.setTool(null);
    // last call turned interaction off
    expect(a.interactiveCalls[a.interactiveCalls.length - 1]).toBe(false);
    expect(a.getInteractive()).toBe(false);
  });

  it('places a line: two pointerdowns finalize a line with 2 data points', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    const changes: Drawing[][] = [];
    overlay.on('change', (d) => changes.push(d));
    const idle = vi.fn();
    overlay.on('toolidle', idle);

    overlay.setTool('line');
    overlay.onPointerDown(pe(10, 20));
    expect(overlay.getDrawings()).toHaveLength(0); // not yet finalized
    overlay.onPointerDown(pe(30, 40));

    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('line');
    expect(drawings[0]!.points).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    expect(changes.length).toBe(1); // one change emitted on finalize
    expect(idle).toHaveBeenCalledWith('line');
  });

  it('places a rect on two pointerdowns', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('rect');
    overlay.onPointerDown(pe(0, 0));
    overlay.onPointerDown(pe(50, 25));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('rect');
    expect(drawings[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 25 },
    ]);
  });

  it('places a polygon and finalizes on right-click', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    const idle = vi.fn();
    overlay.on('toolidle', idle);

    overlay.setTool('polygon');
    overlay.onPointerDown(pe(0, 0));
    overlay.onPointerDown(pe(10, 0));
    overlay.onPointerDown(pe(10, 10));
    expect(overlay.getDrawings()).toHaveLength(0); // still in progress
    // right-click finalizes
    overlay.onPointerDown(pe(10, 10, 2));

    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('polygon');
    expect(drawings[0]!.points).toHaveLength(3);
    expect(idle).toHaveBeenCalledWith('polygon');
  });

  it('ignores a polygon right-click finalize with < 3 points', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('polygon');
    overlay.onPointerDown(pe(0, 0));
    overlay.onPointerDown(pe(10, 0));
    overlay.onPointerDown(pe(10, 0, 2)); // right-click, only 2 points
    expect(overlay.getDrawings()).toHaveLength(0); // not finalized, still placing
  });

  it('setDrawings / getDrawings round-trip (deep copy)', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    const input: Drawing[] = [
      { id: 'draw-x', type: 'line', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], style: { stroke: '#f00' } },
    ];
    overlay.setDrawings(input);
    const out = overlay.getDrawings();
    expect(out).toEqual(input);
    // deep copy: mutating the output must not mutate internal state
    out[0]!.points[0]!.x = 999;
    expect(overlay.getDrawings()[0]!.points[0]!.x).toBe(1);
  });

  it('switching tools cancels an in-progress shape', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('polygon');
    overlay.onPointerDown(pe(0, 0));
    overlay.onPointerDown(pe(10, 0));
    overlay.setTool('line'); // cancels the in-progress polygon
    overlay.onPointerDown(pe(5, 5));
    overlay.onPointerDown(pe(6, 6));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('line'); // polygon was dropped
  });

  it('select → drag a handle moves a point and emits change', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setDrawings([
      { id: 'draw-x', type: 'line', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
    ]);
    overlay.setTool('select');
    const changes: Drawing[][] = [];
    overlay.on('change', (d) => changes.push(d));

    // pointerdown on the first handle (within 8px) begins a drag
    overlay.onPointerDown(pe(0, 0));
    expect(overlay.getSelectedId()).toBe('draw-x');
    // move it
    overlay.onPointerMove(pe(20, 30));
    overlay.onPointerUp(pe(20, 30));

    const moved = overlay.getDrawings()[0]!;
    expect(moved.points[0]).toEqual({ x: 20, y: 30 });
    expect(changes.length).toBeGreaterThan(0);
  });

  it('select → click a body selects, click empty clears', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setDrawings([
      { id: 'draw-x', type: 'rect', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
    ]);
    overlay.setTool('select');
    overlay.onPointerDown(pe(50, 50)); // inside the rect
    expect(overlay.getSelectedId()).toBe('draw-x');
    overlay.onPointerDown(pe(500, 500)); // far outside
    expect(overlay.getSelectedId()).toBe(null);
  });

  it('deleteSelected removes the selected drawing and emits change', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setDrawings([
      { id: 'draw-x', type: 'rect', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
    ]);
    overlay.setTool('select');
    overlay.onPointerDown(pe(5, 5));
    const changes: Drawing[][] = [];
    overlay.on('change', (d) => changes.push(d));
    overlay.deleteSelected();
    expect(overlay.getDrawings()).toHaveLength(0);
    expect(changes.length).toBe(1);
    expect(overlay.getSelectedId()).toBe(null);
  });

  it("'change' fires on add (line placement)", () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    const cb = vi.fn();
    overlay.on('change', cb);
    overlay.setTool('line');
    overlay.onPointerDown(pe(1, 1));
    overlay.onPointerDown(pe(2, 2));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toHaveLength(1);
  });

  it('clear() empties and emits change; cancelInProgress drops a partial shape', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('line');
    overlay.onPointerDown(pe(1, 1));
    overlay.onPointerDown(pe(2, 2));
    const cb = vi.fn();
    overlay.on('change', cb);
    overlay.clear();
    expect(overlay.getDrawings()).toHaveLength(0);
    expect(cb).toHaveBeenCalledTimes(1);

    // partial polygon then cancel
    overlay.setTool('polygon');
    overlay.onPointerDown(pe(0, 0));
    overlay.onPointerDown(pe(5, 0));
    overlay.cancelInProgress();
    overlay.onPointerDown(pe(9, 9, 2)); // right-click now → nothing in progress
    expect(overlay.getDrawings()).toHaveLength(0);
  });

  it('on() returns an unsubscribe fn', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    const cb = vi.fn();
    const off = overlay.on('change', cb);
    off();
    overlay.setTool('line');
    overlay.onPointerDown(pe(1, 1));
    overlay.onPointerDown(pe(2, 2));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('DrawingOverlay — finance shapes', () => {
  it('hline finalizes after 1 pointerdown', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    const idle = vi.fn();
    overlay.on('toolidle', idle);
    overlay.setTool('hline');
    overlay.onPointerDown(pe(10, 250));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('hline');
    expect(drawings[0]!.points).toEqual([{ x: 10, y: 250 }]);
    expect(idle).toHaveBeenCalledWith('hline');
  });

  it('measure finalizes after 2 pointerdowns', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('measure');
    overlay.onPointerDown(pe(0, 100));
    expect(overlay.getDrawings()).toHaveLength(0);
    overlay.onPointerDown(pe(60, 130));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('measure');
    expect(drawings[0]!.points).toEqual([
      { x: 0, y: 100 },
      { x: 60, y: 130 },
    ]);
  });

  it('fib finalizes after 2 pointerdowns', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('fib');
    overlay.onPointerDown(pe(0, 100));
    expect(overlay.getDrawings()).toHaveLength(0);
    overlay.onPointerDown(pe(40, 200));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('fib');
  });

  it('channel finalizes after 3 pointerdowns', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('channel');
    overlay.onPointerDown(pe(0, 100));
    overlay.onPointerDown(pe(50, 150));
    expect(overlay.getDrawings()).toHaveLength(0); // still placing after 2
    overlay.onPointerDown(pe(0, 120));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('channel');
    expect(drawings[0]!.points).toHaveLength(3);
  });

  it('cone finalizes after 3 pointerdowns', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setTool('cone');
    overlay.onPointerDown(pe(0, 100));
    overlay.onPointerDown(pe(50, 140));
    expect(overlay.getDrawings()).toHaveLength(0);
    overlay.onPointerDown(pe(50, 60));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('cone');
    expect(drawings[0]!.points).toHaveLength(3);
  });

  it('fib level prices compute correctly for a known p0/p1', () => {
    // p0.y = 100 (low), p1.y = 200 (high) → priceL = 100 + 100*level.
    const p0y = 100;
    const p1y = 200;
    const computed = FIB_LEVELS.map((level) => p0y + (p1y - p0y) * level);
    const want = [100, 123.6, 138.2, 150, 161.8, 178.6, 200];
    expect(computed).toHaveLength(want.length);
    computed.forEach((v, i) => expect(v).toBeCloseTo(want[i]!, 6));
    // sanity: also confirms the standard ratio set is the one we ship.
    expect([...FIB_LEVELS]).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
  });

  it("'text' with a stubbed prompt returning '' cancels (no drawing)", () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd', textPrompt: () => '' });
    const idle = vi.fn();
    overlay.on('toolidle', idle);
    overlay.setTool('text');
    overlay.onPointerDown(pe(5, 5));
    expect(overlay.getDrawings()).toHaveLength(0);
    expect(idle).not.toHaveBeenCalled();
  });

  it("'text' with a stubbed prompt returning null cancels (no drawing)", () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd', textPrompt: () => null });
    overlay.setTool('text');
    overlay.onPointerDown(pe(5, 5));
    expect(overlay.getDrawings()).toHaveLength(0);
  });

  it("'text' with a stubbed prompt returning 'hi' creates one with text:'hi'", () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd', textPrompt: () => 'hi' });
    const idle = vi.fn();
    overlay.on('toolidle', idle);
    overlay.setTool('text');
    overlay.onPointerDown(pe(7, 8));
    const drawings = overlay.getDrawings();
    expect(drawings).toHaveLength(1);
    expect(drawings[0]!.type).toBe('text');
    expect(drawings[0]!.text).toBe('hi');
    expect(drawings[0]!.points).toEqual([{ x: 7, y: 8 }]);
    expect(idle).toHaveBeenCalledWith('text');
  });

  it('setDrawings / getDrawings round-trips a fib + a channel (incl. text)', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    const input: Drawing[] = [
      { id: 'fib-1', type: 'fib', points: [{ x: 1, y: 100 }, { x: 5, y: 200 }] },
      {
        id: 'chan-1',
        type: 'channel',
        points: [
          { x: 0, y: 10 },
          { x: 10, y: 20 },
          { x: 0, y: 5 },
        ],
        style: { stroke: '#0f0' },
      },
      { id: 'note-1', type: 'text', points: [{ x: 2, y: 3 }], text: 'hello' },
    ];
    overlay.setDrawings(input);
    const out = overlay.getDrawings();
    expect(out).toEqual(input);
    // deep copy: mutating output must not mutate internal state
    out[0]!.points[0]!.y = 999;
    out[2]!.text = 'mutated';
    expect(overlay.getDrawings()[0]!.points[0]!.y).toBe(100);
    expect(overlay.getDrawings()[2]!.text).toBe('hello');
  });

  it('setBarSeconds stores the value without structural change', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setDrawings([
      { id: 'm-1', type: 'measure', points: [{ x: 0, y: 1 }, { x: 60, y: 2 }] },
    ]);
    const before = overlay.getDrawings();
    overlay.setBarSeconds(60);
    expect(overlay.getBarSeconds()).toBe(60);
    expect(overlay.getDrawings()).toEqual(before); // no structural mutation
    // non-positive / non-finite clears it back to unset
    overlay.setBarSeconds(0);
    expect(overlay.getBarSeconds()).toBe(null);
    overlay.setBarSeconds(Number.NaN);
    expect(overlay.getBarSeconds()).toBe(null);
  });

  it('finance shapes are select/drag/delete-able via the generic handle path', () => {
    const a = fakeAdapter();
    const overlay = new DrawingOverlay(a, { id: 'd' });
    overlay.setDrawings([
      { id: 'fib-1', type: 'fib', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
    ]);
    overlay.setTool('select');
    // grab handle 1 (within 8px), drag it, release
    overlay.onPointerDown(pe(100, 100));
    expect(overlay.getSelectedId()).toBe('fib-1');
    overlay.onPointerMove(pe(120, 90));
    overlay.onPointerUp(pe(120, 90));
    expect(overlay.getDrawings()[0]!.points[1]).toEqual({ x: 120, y: 90 });
    overlay.deleteSelected();
    expect(overlay.getDrawings()).toHaveLength(0);
  });
});
