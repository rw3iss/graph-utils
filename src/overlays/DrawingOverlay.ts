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
 *
 * Finance shapes (hline / fib / measure / channel / cone / text) reuse the
 * same machinery: every point lives in data space, gets a draggable handle,
 * is select/drag/delete-able, and persists for free. Each new type just
 * declares how many clicks finalize it (`pointsNeeded`) and adds a branch in
 * `drawShape`. Levels / labels are recomputed every frame from the points so
 * dragging a handle updates them live. Full-plot-width shapes (hline, fib
 * right-edge) read the plot width from `ctx.width` at draw time, exactly like
 * the `PriceLine` overlay.
 */
import { Layer, type LayerPointerEvent } from '../chart/Layer.js';
import { EventBus } from '../core/EventBus.js';
import type { CanvasContext } from '../core/CanvasContext.js';
import type { Viewport } from '../core/Viewport.js';
import type { Adapter } from '../adapters/Adapter.js';

export type DrawingType =
  | 'line'
  | 'polygon'
  | 'rect'
  | 'hline'
  | 'fib'
  | 'measure'
  | 'channel'
  | 'cone'
  | 'text';

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
  /** Note text — only used by the 'text' type. */
  text?: string;
}

/** Fibonacci retracement levels (fraction of the p0→p1 price range). */
export const FIB_LEVELS: readonly number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * Clicks required to finalize each shape. `polygon` is -1 → it finalizes on
 * right-click (variable point count), every other type finalizes once it has
 * collected exactly this many points.
 */
const POINTS_NEEDED: Record<DrawingType, number> = {
  hline: 1,
  text: 1,
  line: 2,
  rect: 2,
  measure: 2,
  fib: 2,
  channel: 3,
  cone: 3,
  polygon: -1,
};

/** A shape tool, the 'select'/move tool, or no tool (idle / pan). */
export type DrawingTool = DrawingType | 'select' | null;

export interface DrawingOverlayOptions {
  id?: string;
  zIndex?: number;
  visible?: boolean;
  /**
   * Supplies the note string when a 'text' drawing is placed. Return null /
   * empty to cancel the placement. Defaults to a `window.prompt` (or null in
   * non-DOM environments / SSR).
   */
  textPrompt?: () => string | null;
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

// Finance-shape rendering.
const LABEL_FONT = '10px sans-serif';
const LABEL_BG = 'rgba(0,0,0,0.7)';
const FIB_FILL = 'rgba(250,204,21,0.06)';
const MEASURE_UP = '#22c55e';
const MEASURE_DOWN = '#ef4444';

function defaultTextPrompt(): string | null {
  return typeof window !== 'undefined' ? window.prompt('Note text:') : null;
}

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

  /** Bar interval (seconds) for 'measure' Δbars; unset → measure omits Δbars. */
  private barSeconds: number | null = null;
  private readonly textPrompt: () => string | null;

  constructor(adapter: Adapter, opts: DrawingOverlayOptions = {}) {
    super(opts.id ?? 'drawings');
    this.adapter = adapter;
    this.zIndex = opts.zIndex ?? 50;
    this.visible = opts.visible ?? true;
    this.textPrompt = opts.textPrompt ?? defaultTextPrompt;
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

  /**
   * Set the bar interval (in seconds) used by 'measure' to report Δbars.
   * Leave unset (or pass a non-finite value) and measure omits Δbars.
   */
  setBarSeconds(sec: number): void {
    this.barSeconds = Number.isFinite(sec) && sec > 0 ? sec : null;
  }

  getBarSeconds(): number | null {
    return this.barSeconds;
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
    const sty = { stroke, fill, lineWidth };

    switch (d.type) {
      case 'line': {
        const a = pts[0];
        const b = pts[1];
        if (a && b && isFinitePt(a) && isFinitePt(b)) {
          ctx.line(a.x, a.y, b.x, b.y, { stroke, lineWidth });
        }
        break;
      }
      case 'rect': {
        const a = pts[0];
        const b = pts[1];
        if (a && b && isFinitePt(a) && isFinitePt(b)) {
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const w = Math.abs(b.x - a.x);
          const h = Math.abs(b.y - a.y);
          ctx.rect(x, y, w, h, { stroke, fill, lineWidth });
        }
        break;
      }
      case 'hline':
        this.drawHLine(ctx, d, sty);
        break;
      case 'fib':
        this.drawFib(ctx, d, sty);
        break;
      case 'measure':
        this.drawMeasure(ctx, d, sty);
        break;
      case 'channel':
        this.drawChannel(ctx, d, sty);
        break;
      case 'cone':
        this.drawCone(ctx, d, sty);
        break;
      case 'text':
        this.drawNote(ctx, d, sty);
        break;
      default: {
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
        break;
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

  // -- finance-shape renderers ----------------------------------------------
  // Each takes the resolved { stroke, fill, lineWidth } and reprojects the
  // drawing's data-space points through adapter.toPixel so it scales/pans.

  /** Horizontal level across the full plot width, labeled with the price. */
  private drawHLine(ctx: CanvasContext, d: Drawing, sty: ResolvedStyle): void {
    const p0 = d.points[0];
    if (!p0) return;
    const { y } = this.adapter.toPixel(p0.x, p0.y);
    if (!Number.isFinite(y)) return;
    ctx.line(0, y, ctx.width, y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
    drawLabel(ctx, fmtPrice(p0.y), ctx.width - 4, y - 2, sty.stroke, 'right', 'bottom');
  }

  /** Fibonacci retracement: a level line per FIB_LEVELS, right-extended. */
  private drawFib(ctx: CanvasContext, d: Drawing, sty: ResolvedStyle): void {
    const p0 = d.points[0];
    const p1 = d.points[1];
    if (!p0 || !p1) return;
    const xStartData = Math.min(p0.x, p1.x);
    const left = this.adapter.toPixel(xStartData, p0.y).x;
    const x0 = Number.isFinite(left) ? left : 0;
    const right = ctx.width;

    const levelYs: number[] = [];
    for (const level of FIB_LEVELS) {
      const priceL = fibPrice(p0.y, p1.y, level);
      const { y } = this.adapter.toPixel(xStartData, priceL);
      levelYs.push(y);
    }
    // Faint fill between adjacent levels.
    for (let i = 1; i < levelYs.length; i++) {
      const ya = levelYs[i - 1]!;
      const yb = levelYs[i]!;
      if (!Number.isFinite(ya) || !Number.isFinite(yb)) continue;
      const top = Math.min(ya, yb);
      ctx.rect(x0, top, Math.max(0, right - x0), Math.abs(yb - ya), { fill: FIB_FILL });
    }
    // Level lines + labels.
    for (let i = 0; i < FIB_LEVELS.length; i++) {
      const y = levelYs[i]!;
      if (!Number.isFinite(y)) continue;
      const level = FIB_LEVELS[i]!;
      const priceL = fibPrice(p0.y, p1.y, level);
      ctx.line(x0, y, right, y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      drawLabel(
        ctx,
        `${(level * 100).toFixed(1)}%  ${fmtPrice(priceL)}`,
        x0 + 4,
        y - 2,
        sty.stroke,
        'left',
        'bottom',
      );
    }
  }

  /** Range box + signed Δprice / Δ% / Δtime (and Δbars when barSeconds set). */
  private drawMeasure(ctx: CanvasContext, d: Drawing, sty: ResolvedStyle): void {
    const p0 = d.points[0];
    const p1 = d.points[1];
    if (!p0 || !p1) return;
    const a = this.adapter.toPixel(p0.x, p0.y);
    const b = this.adapter.toPixel(p1.x, p1.y);
    if (!isFinitePt(a) || !isFinitePt(b)) return;

    const dPrice = p1.y - p0.y;
    const up = dPrice >= 0;
    const color = up ? MEASURE_UP : MEASURE_DOWN;
    const tint = up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    ctx.rect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y), {
      stroke: color,
      fill: tint,
      lineWidth: sty.lineWidth,
    });

    const dPct = p0.y !== 0 ? (dPrice / p0.y) * 100 : 0;
    const lines = [
      `${dPrice >= 0 ? '+' : ''}${fmtPrice(dPrice)}  (${dPct >= 0 ? '+' : ''}${dPct.toFixed(2)}%)`,
      humanDuration(Math.abs(p1.x - p0.x)),
    ];
    if (this.barSeconds && this.barSeconds > 0) {
      lines[1] += `  ${Math.round(Math.abs(p1.x - p0.x) / this.barSeconds)} bars`;
    }
    drawBox(ctx, lines, b.x + 6, b.y, color);
  }

  /** Trendline p0→p1 + a parallel line through p2, with the band shaded. */
  private drawChannel(ctx: CanvasContext, d: Drawing, sty: ResolvedStyle): void {
    const p0 = d.points[0];
    const p1 = d.points[1];
    const p2 = d.points[2];
    if (!p0 || !p1) return;
    const a = this.adapter.toPixel(p0.x, p0.y);
    const b = this.adapter.toPixel(p1.x, p1.y);
    // Vertical trendline → can't compute a slope; just draw the segment.
    if (p1.x === p0.x) {
      if (isFinitePt(a) && isFinitePt(b)) ctx.line(a.x, a.y, b.x, b.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      return;
    }
    const slope = (p1.y - p0.y) / (p1.x - p0.x);

    if (p2) {
      // Parallel line y(x) = p2.y + slope*(x - p2.x), evaluated at p0.x / p1.x.
      const q0 = this.adapter.toPixel(p0.x, p2.y + slope * (p0.x - p2.x));
      const q1 = this.adapter.toPixel(p1.x, p2.y + slope * (p1.x - p2.x));
      if (isFinitePt(a) && isFinitePt(b) && isFinitePt(q0) && isFinitePt(q1)) {
        // Shade the band (quad a→b→q1→q0).
        ctx.path(
          (c) => {
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.lineTo(q1.x, q1.y);
            c.lineTo(q0.x, q0.y);
            c.closePath();
          },
          { fill: sty.fill },
        );
        ctx.line(q0.x, q0.y, q1.x, q1.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      }
    }
    if (isFinitePt(a) && isFinitePt(b)) ctx.line(a.x, a.y, b.x, b.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
  }

  /** Forecast cone: filled triangle apex(p0)–p1–p2 + the two edge lines. */
  private drawCone(ctx: CanvasContext, d: Drawing, sty: ResolvedStyle): void {
    const p0 = d.points[0];
    const p1 = d.points[1];
    const p2 = d.points[2];
    if (!p0) return;
    const apex = this.adapter.toPixel(p0.x, p0.y);
    if (!isFinitePt(apex)) return;
    const up = p1 ? this.adapter.toPixel(p1.x, p1.y) : null;
    const lo = p2 ? this.adapter.toPixel(p2.x, p2.y) : null;
    if (up && lo && isFinitePt(up) && isFinitePt(lo)) {
      ctx.path(
        (c) => {
          c.moveTo(apex.x, apex.y);
          c.lineTo(up.x, up.y);
          c.lineTo(lo.x, lo.y);
          c.closePath();
        },
        { fill: sty.fill },
      );
      ctx.line(apex.x, apex.y, up.x, up.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      ctx.line(apex.x, apex.y, lo.x, lo.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
    } else {
      if (up && isFinitePt(up)) ctx.line(apex.x, apex.y, up.x, up.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      if (lo && isFinitePt(lo)) ctx.line(apex.x, apex.y, lo.x, lo.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
    }
  }

  /** Free text note with a subtle background rect for legibility. */
  private drawNote(ctx: CanvasContext, d: Drawing, sty: ResolvedStyle): void {
    const p0 = d.points[0];
    if (!p0) return;
    const a = this.adapter.toPixel(p0.x, p0.y);
    if (!isFinitePt(a)) return;
    const text = d.text ?? '';
    if (text === '') return;
    drawLabel(ctx, text, a.x, a.y, sty.stroke, 'left', 'middle');
  }

  private drawInProgress(ctx: CanvasContext): void {
    if (this.inProgress.length === 0 || this.inProgressType === null) return;
    const stroke = this.style.stroke ?? DEFAULT_STROKE;
    const fill = this.style.fill ?? DEFAULT_FILL;
    const lineWidth = this.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    const pts = this.inProgress.map((p) => this.adapter.toPixel(p.x, p.y));

    if (this.inProgressType === 'rect' || this.inProgressType === 'measure') {
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
    if (isRightClick) return; // right-click is meaningless for non-polygon shapes

    const type = this.tool;
    const data = this.adapter.toData(e.x, e.y);
    if (this.inProgressType === null) this.inProgressType = type;
    this.inProgress.push({ x: data.x, y: data.y });

    const needed = POINTS_NEEDED[type];
    // polygon (needed < 0) is finalized by right-click, handled above.
    if (needed > 0 && this.inProgress.length >= needed) {
      const points = this.inProgress.slice(0, needed);
      if (type === 'text') {
        // Obtain the note string; cancel the placement on null/empty.
        const text = this.textPrompt();
        if (text === null || text === '') {
          this.clearInProgress();
          this.adapter.invalidate();
          return;
        }
        this.finalizeShape(type, points, text);
      } else {
        this.finalizeShape(type, points);
      }
      return;
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
      } else if (d.type === 'rect' || d.type === 'measure') {
        if (pts.length === 2) {
          const x = Math.min(pts[0]!.x, pts[1]!.x);
          const y = Math.min(pts[0]!.y, pts[1]!.y);
          const w = Math.abs(pts[1]!.x - pts[0]!.x);
          const h = Math.abs(pts[1]!.y - pts[0]!.y);
          if (pointInRect(px, py, x, y, w, h, BODY_HIT_PX)) return d.id;
        }
      } else if (d.type === 'hline') {
        // Near the full-width horizontal level (y distance only).
        if (pts.length >= 1 && Math.abs(py - pts[0]!.y) <= BODY_HIT_PX) return d.id;
      } else if (d.type === 'fib') {
        // Near any level line: each level shares the p0/p1 y-range mapping.
        if (pts.length === 2) {
          for (const level of FIB_LEVELS) {
            const yl = this.adapter.toPixel(d.points[0]!.x, fibPrice(d.points[0]!.y, d.points[1]!.y, level)).y;
            if (Number.isFinite(yl) && Math.abs(py - yl) <= BODY_HIT_PX) return d.id;
          }
        }
      } else if (d.type === 'channel') {
        // Near trendline or parallel line (both clamped to BODY_HIT_PX).
        if (pts.length >= 2 && segDist(px, py, pts[0]!, pts[1]!) <= BODY_HIT_PX) return d.id;
        if (pts.length >= 3 && segDist(px, py, pts[1]!, pts[2]!) <= BODY_HIT_PX) return d.id;
        if (pts.length >= 3 && segDist(px, py, pts[0]!, pts[2]!) <= BODY_HIT_PX) return d.id;
      } else if (d.type === 'text') {
        // Near the anchor point.
        if (pts.length >= 1 && dist(px, py, pts[0]!.x, pts[0]!.y) <= HANDLE_HIT_PX) return d.id;
      } else {
        // polygon / cone: inside fill, or near an edge (including the closing edge).
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

  private finalizeShape(type: DrawingType, points: DrawingPoint[], text?: string): void {
    const d: Drawing = {
      id: nextId(),
      type,
      points: points.map((p) => ({ x: p.x, y: p.y })),
      style: { ...this.style },
    };
    if (text !== undefined) d.text = text;
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

// ---------------- render helpers ----------------

/** Resolved per-shape style (no undefineds), passed to the type renderers. */
interface ResolvedStyle {
  stroke: string;
  fill: string;
  lineWidth: number;
}

/** Fibonacci level price: p0 + (p1 - p0) * level. */
function fibPrice(y0: number, y1: number, level: number): number {
  return y0 + (y1 - y0) * level;
}

/** Compact price formatting — trims to ~5 significant digits, no trailing dust. */
function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : 6;
  // Strip trailing zeros from the fixed representation.
  return Number(v.toFixed(digits)).toString();
}

/** |seconds| → a short human duration like "2d 4h", "35m", "12s". */
function humanDuration(seconds: number): string {
  const s = Math.abs(Math.round(seconds));
  if (s === 0) return '0s';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`); // drop minutes once we're in the days range
  if (sec && !d && !h && !m) parts.push(`${sec}s`);
  return parts.length ? parts.slice(0, 2).join(' ') : `${s}s`;
}

/** Text with a subtle background rect for legibility, anchored at (x,y). */
function drawLabel(
  ctx: CanvasContext,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline,
): void {
  const padX = 3;
  const padY = 2;
  const fontH = 10;
  const w = approxTextWidth(text, fontH);
  let bx = x;
  if (align === 'right') bx = x - w;
  else if (align === 'center') bx = x - w / 2;
  let by = y;
  if (baseline === 'bottom') by = y - fontH;
  else if (baseline === 'middle') by = y - fontH / 2;
  ctx.rect(bx - padX, by - padY, w + padX * 2, fontH + padY * 2, { fill: LABEL_BG });
  ctx.text(text, x, y, { font: LABEL_FONT, color, align, baseline });
}

/** Multi-line label box anchored at its top-left (x,y), colored border. */
function drawBox(ctx: CanvasContext, lines: string[], x: number, y: number, color: string): void {
  const fontH = 11;
  const lineGap = 3;
  const padX = 5;
  const padY = 4;
  const w = Math.max(...lines.map((l) => approxTextWidth(l, fontH)));
  const h = lines.length * fontH + (lines.length - 1) * lineGap;
  ctx.rect(x, y, w + padX * 2, h + padY * 2, {
    fill: 'rgba(0,0,0,0.78)',
    stroke: color,
    lineWidth: 1,
  });
  let ty = y + padY;
  for (const l of lines) {
    ctx.text(l, x + padX, ty, { font: `${fontH}px sans-serif`, color, align: 'left', baseline: 'top' });
    ty += fontH + lineGap;
  }
}

/**
 * Rough text-width estimate (we don't measure on the 2d ctx here to keep the
 * helpers ctx-measure-free and SSR-safe). ~0.58em per char for sans-serif.
 */
function approxTextWidth(text: string, fontH: number): number {
  return Math.ceil(text.length * fontH * 0.58);
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
  const out: Drawing = {
    id: d.id,
    type: d.type,
    points: d.points.map((p) => ({ x: p.x, y: p.y })),
    style: d.style ? { ...d.style } : undefined,
  };
  if (d.text !== undefined) out.text = d.text;
  return out;
}

function nextId(): string {
  idCounter += 1;
  return `draw-${idCounter}`;
}
