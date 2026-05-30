import { describe, it, expect } from 'vitest';
import { DrawingOverlay } from '../../src/overlays/DrawingOverlay';

function adapter(opts: { toDataX?: number } = {}) {
  return {
    getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }), width: 800 }),
    getViewport: () => ({ xDomain: [1000, 2000] as [number, number], yDomain: [0, 1] as [number, number] }),
    addLayer() {}, removeLayer() {}, invalidate() {}, setInteractive() {}, getInteractive() { return false; },
    toPixel: (x: number, y: number) => ({ x, y }),
    toData: (px: number, py: number) => ({ x: opts.toDataX ?? px, y: py }),
  } as any;
}
const down = (x: number, y: number, button = 0) => ({ x, y, source: { button } as any });

describe('DrawingOverlay interaction fixes', () => {
  it('snaps a non-mappable time (NaN x) into the visible domain on placement (text bug)', () => {
    const d = new DrawingOverlay(adapter({ toDataX: NaN }), { textPrompt: () => 'note' });
    d.setTool('text');
    d.onPointerDown!(down(400, 100));
    const drawings = d.getDrawings();
    expect(drawings.length).toBe(1);
    const px = drawings[0]!.points[0]!.x;
    expect(Number.isFinite(px)).toBe(true);
    expect(px).toBeCloseTo(1500, 5); // 400/800 across [1000,2000]
  });

  it('dragging the body translates all points (whole-widget move)', () => {
    const d = new DrawingOverlay(adapter(), {});
    d.setTool('line');
    d.onPointerDown!(down(100, 100));
    d.onPointerDown!(down(200, 150)); // finalize line
    d.setTool('select');
    d.onPointerDown!(down(150, 125)); // grab body (midpoint)
    d.onPointerMove!(down(200, 145)); // drag +50,+20
    const pts = d.getDrawings()[0]!.points;
    expect(pts[0]!.x).toBeCloseTo(150, 5);
    expect(pts[0]!.y).toBeCloseTo(120, 5);
    expect(pts[1]!.x).toBeCloseTo(250, 5);
    expect(pts[1]!.y).toBeCloseTo(170, 5);
  });

  it('shows handles for all drawings while the select tool is active (discoverability)', () => {
    const calls: { n: string }[] = [];
    const rec = (n: string) => () => calls.push({ n });
    const ctx: any = {
      width: 800, height: 400,
      line: rec('line'), rect: rec('rect'), circle: rec('circle'),
      polyline: rec('polyline'), path: rec('path'), text: rec('text'),
      gradient: () => ({}), withClip: (_x: any, _y: any, _w: any, _h: any, fn: any) => fn(), clear: rec('clear'),
    };
    const d = new DrawingOverlay(adapter(), {});
    d.setTool('line');
    d.onPointerDown!(down(100, 100));
    d.onPointerDown!(down(200, 150)); // a line exists, not selected
    d.setTool(null); // pan: unselected drawing draws no handles
    calls.length = 0;
    d.draw(ctx, {} as any);
    expect(calls.filter((c) => c.n === 'circle').length).toBe(0);
    d.setTool('select'); // select: handles shown even with nothing selected
    calls.length = 0;
    d.draw(ctx, {} as any);
    expect(calls.filter((c) => c.n === 'circle').length).toBeGreaterThanOrEqual(2);
  });

  it('drops corrupt drawings (null/NaN coords) on load — the TV "year of null" crash', () => {
    const d = new DrawingOverlay(adapter(), {});
    d.setDrawings([
      { id: 'ok', type: 'line', points: [{ x: 1000, y: 1 }, { x: 2000, y: 2 }] },
      { id: 'bad-null', type: 'line', points: [{ x: null as any, y: 1 }, { x: 2000, y: 2 }] },
      { id: 'bad-nan', type: 'hline', points: [{ x: NaN, y: NaN }] },
      { id: 'bad-empty', type: 'line', points: [] },
    ]);
    expect(d.getDrawings().map((x) => x.id)).toEqual(['ok']);
  });

  it('ignores a click that cannot be mapped to a finite data point', () => {
    // toData returns NaN and there is no usable domain/width to snap to.
    const a = {
      getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }), width: 0 }),
      getViewport: () => ({ xDomain: [NaN, NaN] as [number, number], yDomain: [NaN, NaN] as [number, number] }),
      addLayer() {}, removeLayer() {}, invalidate() {}, setInteractive() {}, getInteractive() { return false; },
      toPixel: (x: number, y: number) => ({ x, y }),
      toData: () => ({ x: NaN, y: NaN }),
    } as any;
    const d = new DrawingOverlay(a, {});
    d.setTool('line');
    d.onPointerDown!(down(100, 100));
    d.onPointerDown!(down(200, 150));
    expect(d.getDrawings().length).toBe(0);
  });
});
