/**
 * DrawingOverlay
 *
 * Interactive, data-anchored annotations (line / polygon / rect) that the
 * user draws on top of a chart and that scale + pan with the chart because
 * every point is stored in DATA space and mapped through `adapter.toPixel`
 * at draw time.
 *
 * It is a `Layer` added via `adapter.addLayer(...)`. Unlike the marker
 * overlays it owns its own data model (an array of `Drawing`s), a current
 * `DrawingTool`, an in-progress shape, and a tiny `EventBus` so the host
 * app can persist on `'change'` and flip its toolbar on `'toolidle'`.
 *
 * Interaction is gated through `adapter.setInteractive(on)`: when a tool is
 * selected the adapter forwards DOM pointer events to this layer's
 * `onPointerDown/Move/Up`; when the tool is cleared interaction is turned
 * off so the host chart keeps its own pan/zoom gestures.
 *
 * Coordinate contract (mirrors the rest of the package):
 *   - `DrawingPoint.x` is the adapter's time unit (TV: seconds by default).
 *   - `DrawingPoint.y` is price.
 *   - Points whose `toPixel` is non-finite (off the visible range on TV)
 *     are skipped; multi-point shapes still draw their finite sub-segments.
 *
 * Right-click finalizes a polygon: the adapter suppresses the browser
 * context menu and the `pointerdown` with `button === 2` is the signal we
 * read in `onPointerDown`.
 */
import { Layer, type LayerPointerEvent } from '../chart/Layer.js';
import { EventBus } from '../core/EventBus.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export type DrawingType = 'line' | 'polygon' | 'rect';

export interface DrawingPoint {
  /** Adapter time unit (e.g. TV seconds). */
  x: number;
  /** Price. */
  y: number;
}

export interface DrawingStyle {
  stroke?: string;
  fill?: string;
  lineWidth?: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  style?: DrawingStyle;
}

/** A shape tool, the 'select'/move tool, or no tool (idle / pan). */
export type DrawingTool = DrawingType | 'select' | null;

export interface DrawingOverlayOptions {
  id?: string;
  zIndex?: number;
  visible?: boolean;
}

type DrawingEvents = {
  /** Fired whenever the drawings array mutates (add / move / delete / restore). */
  change: Drawing[];
  /** Fired when a shape finishes placing, carrying the finished type. */
  toolidle: DrawingType;
};

// Defaults (task-specified).
const DEFAULT_STROKE = '#facc15';
const DEFAULT_FILL = 'rgba(250,204,21,0.12)';
const DEFAULT_LINE_WIDTH = 1.5;
const HANDLE_RADIUS = 4;
const HANDLE_HIT_PX = 8;
const BODY_HIT_PX = 6;

// Module-scoped counter → stable, SSR-safe ids (no Date.now / Math.random).
let idCounter = 0;

export class DrawingOverlay extends Layer {
  protected adapter: Adapter;
  readonly bus = new EventBus<DrawingEvents>();

  private drawings: Drawing[] = [];
  private tool: DrawingTool = null;
  private style: DrawingStyle = {};

  /** Points of the shape currently being placed (data space). */
  private inProgress: DrawingPoint[] = [];
  private inProgressType: DrawingType | null = null;
  /** Live cursor pixel for the rubber-band segment. */
  private cursorPx: { x: number; y: number } | null = null;

  private selectedId: string | null = null;
  /** Handle currently dragged: index into the selected drawing's points. */
  private dragPointIndex: number | null = null;
  /** Handle currently hovered (for highlight), as (drawingId, pointIndex). */
  private hoverHandle: { id: string; index: number } | null = null;

  constructor(adapter: Adapter, opts: DrawingOverlayOptions = {}) {
    super(opts.id ?? 'drawings');
    this.adapter = adapter;
    this.zIndex = opts.zIndex ?? 50;
    this.visible = opts.visible ?? true;
  }

  // -- public API -----------------------------------------------------------

  setTool(tool: DrawingTool): void {
    // Switching tools always cancels any in-progress shape.
    this.clearInProgress();
    this.tool = tool;
    if (tool === null) {
      this.adapter.setInteractive?.(false);
    } else {
      // Any shape tool OR 'select' wants pointer events.
      this.adapter.setInteractive?.(true);
    }
    if (tool !== 'select') this.setSelected(null);
    this.adapter.invalidate();
  }

  getTool(): DrawingTool {
    return this.tool;
  }

  /** Deep copy of all drawings (safe to hand to a persistence layer). */
  getDrawings(): Drawing[] {
    return this.drawings.map(cloneDrawing);
  }

  /** Replace all drawings (persistence restore). Emits 'change'. */
  setDrawings(d: Drawing[]): void {
    this.drawings = d.map(cloneDrawing);
    this.setSelected(null);
    this.clearInProgress();
    this.emitChange();
    this.adapter.invalidate();
  }

  clear(): void {
    if (this.drawings.length === 0 && this.inProgress.length === 0) {
      this.adapter.invalidate();
      return;
    }
    this.drawings = [];
    this.setSelected(null);
    this.clearInProgress();
    this.emitChange();
    this.adapter.invalidate();
  }

  deleteSelected(): void {
    if (this.selectedId === null) return;
    const before = this.drawings.length;
    this.drawings = this.drawings.filter((d) => d.id !== this.selectedId);
    this.setSelected(null);
    if (this.drawings.length !== before) this.emitChange();
    this.adapter.invalidate();
  }

  /** Style applied to new shapes and to the current selection. */
  setStyle(s: DrawingStyle): void {
    this.style = { ...this.style, ...s };
    if (this.selectedId !== null) {
      const sel = this.drawings.find((d) => d.id === this.selectedId);
      if (sel) {
        sel.style = { ...sel.style, ...s };
        this.emitChange();
      }
    }
    this.adapter.invalidate();
  }

  getStyle(): DrawingStyle {
    return { ...this.style };
  }

  /** Subscribe to a drawing event. Returns an unsubscribe fn. */
  on<K extends keyof DrawingEvents>(event: K, cb: (payload: DrawingEvents[K]) => void): () => void {
    return this.bus.on(event, cb);
  }

  /** Cancel the in-progress shape (host wires this to Esc). */
  cancelInProgress(): void {
    if (this.inProgress.length === 0 && this.cursorPx === null) return;
    this.clearInProgress();
    this.adapter.invalidate();
  }

  /** Currently selected drawing id, or null. */
  getSelectedId(): string | null {
    return this.selectedId;
  }

  // -- drawing --------------------------------------------------------------

  draw(ctx: CanvasContext, _vp: Viewport): void {
    for (const d of this.drawings) {
      this.drawShape(ctx, d, d.id === this.selectedId);
    }
    this.drawInProgress(ctx);
  }

  private drawShape(ctx: CanvasContext, d: Drawing, selected: boolean): void {
    const stroke = d.style?.stroke ?? DEFAULT_STROKE;
    const fill = d.style?.fill ?? DEFAULT_FILL;
    const lineWidth = d.style?.lineWidth ?? DEFAULT_LINE_WIDTH;
    const pts = d.points.map((p) => this.adapter.toPixel(p.x, p.y));

    if (d.type === 'line') {
      const a = pts[0];
      const b = pts[1];
      if (a && b && isFinitePt(a) && isFinitePt(b)) {
        ctx.line(a.x, a.y, b.x, b.y, { stroke, lineWidth });
      }
    } else if (d.type === 'rect') {
      const a = pts[0];
      const b = pts[1];
      if (a && b && isFinitePt(a) && isFinitePt(b)) {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        ctx.rect(x, y, w, h, { stroke, fill, lineWidth });
      }
    } else {
      // polygon: closed fill via path; draw finite sub-segments only.
      const finite = pts.filter(isFinitePt);
      if (finite.length >= 3) {
        ctx.path(
          (c) => {
            c.moveTo(finite[0]!.x, finite[0]!.y);
            for (let i = 1; i < finite.length; i++) c.lineTo(finite[i]!.x, finite[i]!.y);
            c.closePath();
          },
          { stroke, fill, lineWidth },
        );
      } else if (finite.length === 2) {
        ctx.line(finite[0]!.x, finite[0]!.y, finite[1]!.x, finite[1]!.y, { stroke, lineWidth });
      }
    }

    // Handles when selected (or when a handle of this drawing is hovered).
    const showHandles = selected || this.hoverHandle?.id === d.id;
    if (showHandles) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        if (!isFinitePt(p)) continue;
        const hot =
          (this.dragPointIndex === i && this.selectedId === d.id) ||
          (this.hoverHandle?.id === d.id && this.hoverHandle.index === i);
        ctx.circle(p.x, p.y, hot ? HANDLE_RADIUS + 2 : HANDLE_RADIUS, {
          fill: hot ? '#fff' : stroke,
          stroke,
          lineWidth: 1,
        });
      }
    }
  }

  private drawInProgress(ctx: CanvasContext): void {
    if (this.inProgress.length === 0 || this.inProgressType === null) return;
    const stroke = this.style.stroke ?? DEFAULT_STROKE;
    const fill = this.style.fill ?? DEFAULT_FILL;
    const lineWidth = this.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    const pts = this.inProgress.map((p) => this.adapter.toPixel(p.x, p.y));

    if (this.inProgressType === 'rect') {
      const a = pts[0];
      const b = this.cursorPx ?? pts[1] ?? null;
      if (a && b && isFinitePt(a) && isFinitePt(b)) {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        ctx.rect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y), { stroke, fill, lineWidth });
      }
    } else {
      // line / polygon: draw placed segments + rubber band to cursor.
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        if (isFinitePt(a) && isFinitePt(b)) ctx.line(a.x, a.y, b.x, b.y, { stroke, lineWidth });
      }
      const last = pts[pts.length - 1];
      if (last && isFinitePt(last) && this.cursorPx) {
        ctx.line(last.x, last.y, this.cursorPx.x, this.cursorPx.y, {
          stroke,
          lineWidth,
          lineDash: [4, 4],
        });
      }
    }

    // Handles on placed points.
    for (const p of pts) {
      if (isFinitePt(p)) ctx.circle(p.x, p.y, HANDLE_RADIUS, { fill: stroke });
    }
  }

  // -- pointer handlers -----------------------------------------------------

  onPointerDown(e: LayerPointerEvent): void {
    if (this.tool === null) return;
    const isRightClick = (e.source as PointerEvent).button === 2;

    if (this.tool === 'select') {
      this.handleSelectDown(e);
      return;
    }

    // A shape tool. Polygon finalizes on right-click; others append.
    if (this.tool === 'polygon' && isRightClick) {
      this.finalizePolygon();
      return;
    }
    if (isRightClick) return; // right-click is meaningless for line/rect

    const data = this.adapter.toData(e.x, e.y);
    if (this.inProgressType === null) this.inProgressType = this.tool;
    this.inProgress.push({ x: data.x, y: data.y });

    if (this.tool === 'line' && this.inProgress.length >= 2) {
      this.finalizeShape('line', this.inProgress.slice(0, 2));
    } else if (this.tool === 'rect' && this.inProgress.length >= 2) {
      this.finalizeShape('rect', this.inProgress.slice(0, 2));
    }
    this.adapter.invalidate();
  }

  onPointerMove(e: LayerPointerEvent): void {
    this.cursorPx = { x: e.x, y: e.y };

    if (this.dragPointIndex !== null && this.selectedId !== null) {
      const sel = this.drawings.find((d) => d.id === this.selectedId);
      if (sel) {
        const data = this.adapter.toData(e.x, e.y);
        sel.points[this.dragPointIndex] = { x: data.x, y: data.y };
        this.emitChange();
        this.adapter.invalidate();
      }
      return;
    }

    if (this.tool === 'select') {
      // Update hovered handle for highlight.
      const hit = this.hitHandle(e.x, e.y);
      const changed =
        (hit?.id ?? null) !== (this.hoverHandle?.id ?? null) ||
        (hit?.index ?? -1) !== (this.hoverHandle?.index ?? -1);
      this.hoverHandle = hit;
      if (changed) this.adapter.invalidate();
      return;
    }

    // A shape is being placed → repaint the rubber band.
    if (this.inProgress.length > 0) this.adapter.invalidate();
  }

  onPointerUp(_e: LayerPointerEvent): void {
    this.dragPointIndex = null;
  }

  // -- select / hit-testing -------------------------------------------------

  private handleSelectDown(e: LayerPointerEvent): void {
    // 1) Handle of any drawing, topmost-first.
    const handle = this.hitHandle(e.x, e.y);
    if (handle) {
      this.setSelected(handle.id);
      this.dragPointIndex = handle.index;
      this.adapter.invalidate();
      return;
    }
    // 2) Body of a drawing, topmost-first.
    const body = this.hitBody(e.x, e.y);
    if (body) {
      this.setSelected(body);
      this.adapter.invalidate();
      return;
    }
    // 3) Empty space clears selection.
    this.setSelected(null);
    this.adapter.invalidate();
  }

  /** Topmost drawing whose handle is within HANDLE_HIT_PX of (px,py). */
  private hitHandle(px: number, py: number): { id: string; index: number } | null {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i]!;
      for (let j = 0; j < d.points.length; j++) {
        const p = this.adapter.toPixel(d.points[j]!.x, d.points[j]!.y);
        if (!isFinitePt(p)) continue;
        if (dist(px, py, p.x, p.y) <= HANDLE_HIT_PX) return { id: d.id, index: j };
      }
    }
    return null;
  }

  /** Topmost drawing whose body contains / is near (px,py). */
  private hitBody(px: number, py: number): string | null {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i]!;
      const pts = d.points.map((p) => this.adapter.toPixel(p.x, p.y)).filter(isFinitePt);
      if (d.type === 'line') {
        if (pts.length === 2 && segDist(px, py, pts[0]!, pts[1]!) <= BODY_HIT_PX) return d.id;
      } else if (d.type === 'rect') {
        if (pts.length === 2) {
          const x = Math.min(pts[0]!.x, pts[1]!.x);
          const y = Math.min(pts[0]!.y, pts[1]!.y);
          const w = Math.abs(pts[1]!.x - pts[0]!.x);
          const h = Math.abs(pts[1]!.y - pts[0]!.y);
          if (pointInRect(px, py, x, y, w, h, BODY_HIT_PX)) return d.id;
        }
      } else {
        // polygon: inside fill, or near an edge (including the closing edge).
        if (pts.length >= 3 && pointInPolygon(px, py, pts)) return d.id;
        for (let k = 0; k < pts.length; k++) {
          const a = pts[k]!;
          const b = pts[(k + 1) % pts.length]!;
          if (segDist(px, py, a, b) <= BODY_HIT_PX) return d.id;
        }
      }
    }
    return null;
  }

  // -- internals ------------------------------------------------------------

  private finalizeShape(type: DrawingType, points: DrawingPoint[]): void {
    const d: Drawing = {
      id: nextId(),
      type,
      points: points.map((p) => ({ x: p.x, y: p.y })),
      style: { ...this.style },
    };
    this.drawings.push(d);
    this.clearInProgress();
    this.emitChange();
    this.bus.emit('toolidle', type);
    this.adapter.invalidate();
  }

  private finalizePolygon(): void {
    if (this.inProgress.length < 3) {
      // Not enough points — ignore the right-click, keep placing.
      return;
    }
    this.finalizeShape('polygon', this.inProgress.slice());
  }

  private clearInProgress(): void {
    this.inProgress = [];
    this.inProgressType = null;
    this.cursorPx = null;
  }

  private setSelected(id: string | null): void {
    this.selectedId = id;
    this.dragPointIndex = null;
    if (id === null) this.hoverHandle = null;
  }

  private emitChange(): void {
    this.bus.emit('change', this.getDrawings());
  }
}

// ---------------- geometry helpers ----------------

function isFinitePt(p: { x: number; y: number }): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance from point (px,py) to segment a→b (pixel space). */
function segDist(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = px - a.x;
  const apy = py - a.y;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 === 0 ? 0 : (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return dist(px, py, cx, cy);
}

function pointInRect(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
  tol: number,
): boolean {
  return px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h + tol;
}

/** Even-odd ray cast. `pts` is pixel space. */
function pointInPolygon(px: number, py: number, pts: ReadonlyArray<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]!.x;
    const yi = pts[i]!.y;
    const xj = pts[j]!.x;
    const yj = pts[j]!.y;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function cloneDrawing(d: Drawing): Drawing {
  return {
    id: d.id,
    type: d.type,
    points: d.points.map((p) => ({ x: p.x, y: p.y })),
    style: d.style ? { ...d.style } : undefined,
  };
}

function nextId(): string {
  idCounter += 1;
  return `draw-${idCounter}`;
}
