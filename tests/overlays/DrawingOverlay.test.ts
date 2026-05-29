/**
 * Unit tests for DrawingOverlay against a minimal fake Adapter.
 *
 * The fake uses an identity coordinate mapping (toPixel/toData are 1:1) so
 * pixel == data and assertions on placed points are exact. We never call
 * `draw`, so no canvas/2d-context stubbing is needed; this stays in the
 * default node environment.
 */
import { describe, expect, it, vi } from 'vitest';
import { DrawingOverlay, type Drawing } from '../../src/overlays/DrawingOverlay.js';
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
