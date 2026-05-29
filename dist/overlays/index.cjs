'use strict';

// src/chart/Layer.ts
var Layer = class {
  id;
  visible = true;
  /** Higher zIndex draws on top; default 0. */
  zIndex = 0;
  constructor(id) {
    this.id = id;
  }
};

// src/overlays/OverlayBase.ts
var OverlayBase = class extends Layer {
  adapter;
  data = null;
  constructor(adapter, options) {
    super(options.id);
    this.adapter = adapter;
    this.zIndex = options.zIndex ?? 0;
    this.visible = options.visible ?? true;
  }
  setData(data) {
    this.data = data;
    this.adapter.invalidate();
    return this;
  }
  getData() {
    return this.data;
  }
};

// src/overlays/SignalArrows.ts
var SignalArrows = class extends OverlayBase {
  size;
  offset;
  buyColor;
  sellColor;
  labelFont;
  labelColor;
  constructor(adapter, options) {
    super(adapter, options);
    this.size = options.size ?? 8;
    this.offset = options.offset ?? 10;
    this.buyColor = options.buyColor ?? "#16a34a";
    this.sellColor = options.sellColor ?? "#dc2626";
    this.labelFont = options.labelFont ?? "10px sans-serif";
    this.labelColor = options.labelColor ?? "#ddd";
  }
  draw(ctx, _vp) {
    const data = this.data;
    if (!data) return;
    for (const s of data) {
      const { x, y } = this.adapter.toPixel(s.ts, s.price);
      const color = s.side === "buy" ? this.buyColor : this.sellColor;
      drawArrow(ctx, x, y, s.side, this.size, this.offset, color);
      if (s.label) {
        const ty = s.side === "buy" ? y + this.offset + this.size + 10 : y - this.offset - this.size - 6;
        ctx.text(s.label, x, ty, {
          font: this.labelFont,
          color: this.labelColor,
          align: "center",
          baseline: s.side === "buy" ? "top" : "bottom"
        });
      }
    }
  }
};
function drawArrow(ctx, px, py, side, size, offset, color) {
  const tip = side === "buy" ? py + offset : py - offset;
  const tail = side === "buy" ? tip + size * 2 : tip - size * 2;
  ctx.path(
    (c) => {
      c.moveTo(px, tip);
      c.lineTo(px - size, tail);
      c.lineTo(px + size, tail);
      c.closePath();
    },
    { fill: color }
  );
}

// src/overlays/ZoneBoxes.ts
var ZoneBoxes = class extends OverlayBase {
  labelFont;
  labelColor;
  constructor(adapter, options) {
    super(adapter, options);
    this.labelFont = options.labelFont ?? "10px sans-serif";
    this.labelColor = options.labelColor ?? "rgba(255,255,255,0.75)";
  }
  draw(ctx, vp) {
    const data = this.data;
    if (!data) return;
    const [yLo, yHi] = vp.yDomain;
    for (const z of data) {
      const x1 = this.adapter.toPixel(z.from, 0).x;
      const x2 = this.adapter.toPixel(z.to, 0).x;
      const top = this.adapter.toPixel(0, z.yMax ?? yHi).y;
      const bot = this.adapter.toPixel(0, z.yMin ?? yLo).y;
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const yTop = Math.min(top, bot);
      const yBot = Math.max(top, bot);
      ctx.rect(left, yTop, right - left, yBot - yTop, {
        fill: z.fill,
        stroke: z.stroke,
        lineWidth: z.stroke ? 1 : void 0
      });
      if (z.label) {
        ctx.text(z.label, left + 4, yTop + 4, {
          font: this.labelFont,
          color: this.labelColor,
          align: "left",
          baseline: "top"
        });
      }
    }
  }
};

// src/overlays/OrderMarkers.ts
var OrderMarkers = class extends OverlayBase {
  size;
  buyColor;
  sellColor;
  pendingAlpha;
  labelFont;
  labelColor;
  constructor(adapter, options) {
    super(adapter, options);
    this.size = options.size ?? 6;
    this.buyColor = options.buyColor ?? "#22c55e";
    this.sellColor = options.sellColor ?? "#ef4444";
    this.pendingAlpha = options.pendingAlpha ?? 0.5;
    this.labelFont = options.labelFont ?? "10px sans-serif";
    this.labelColor = options.labelColor ?? "#ddd";
  }
  draw(ctx, _vp) {
    const data = this.data;
    if (!data) return;
    for (const o of data) {
      const { x, y } = this.adapter.toPixel(o.ts, o.price);
      const base = o.side === "buy" ? this.buyColor : this.sellColor;
      const fill = o.status === "pending" ? withAlpha(base, this.pendingAlpha) : base;
      const stroke = o.status === "cancelled" ? "#888" : void 0;
      ctx.path(
        (c) => {
          c.moveTo(x, y - this.size);
          c.lineTo(x + this.size, y);
          c.lineTo(x, y + this.size);
          c.lineTo(x - this.size, y);
          c.closePath();
        },
        { fill, stroke, lineWidth: stroke ? 1 : void 0 }
      );
      if (o.label) {
        ctx.text(o.label, x + this.size + 3, y, {
          font: this.labelFont,
          color: this.labelColor,
          align: "left",
          baseline: "middle"
        });
      }
    }
  }
};
function withAlpha(hex, alpha) {
  if (hex.startsWith("#")) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

// src/overlays/PriceLine.ts
var PriceLine = class extends OverlayBase {
  color;
  lineWidth;
  lineDash;
  labelFont;
  labelBg;
  labelColor;
  labelPad;
  constructor(adapter, options) {
    super(adapter, options);
    this.color = options.color ?? "#888";
    this.lineWidth = options.lineWidth ?? 1;
    this.lineDash = options.lineDash ?? [4, 3];
    this.labelFont = options.labelFont ?? "10px sans-serif";
    this.labelBg = options.labelBg ?? "rgba(0,0,0,0.7)";
    this.labelColor = options.labelColor ?? "#fff";
    this.labelPad = options.labelPad ?? 4;
  }
  draw(ctx, _vp) {
    const d = this.data;
    if (!d) return;
    const { y } = this.adapter.toPixel(0, d.price);
    if (!isFinite(y)) return;
    const stroke = d.color ?? this.color;
    ctx.line(0, y, ctx.width, y, {
      stroke,
      lineWidth: this.lineWidth,
      lineDash: d.lineDash ?? this.lineDash
    });
    const text = d.label;
    if (text) {
      ctx.text(text, ctx.width - this.labelPad, y - 2, {
        font: this.labelFont,
        color: d.labelColor ?? this.labelColor,
        align: "right",
        baseline: "bottom"
      });
    }
  }
};

// src/overlays/ThresholdBand.ts
var ThresholdBand = class extends OverlayBase {
  fill;
  stroke;
  labelFont;
  labelColor;
  constructor(adapter, options) {
    super(adapter, options);
    this.fill = options.fill ?? "rgba(244,114,182,0.10)";
    this.stroke = options.stroke;
    this.labelFont = options.labelFont ?? "10px sans-serif";
    this.labelColor = options.labelColor ?? "rgba(255,255,255,0.6)";
  }
  draw(ctx, _vp) {
    const d = this.data;
    if (!d) return;
    const y1 = this.adapter.toPixel(0, d.yMin).y;
    const y2 = this.adapter.toPixel(0, d.yMax).y;
    if (!isFinite(y1) || !isFinite(y2)) return;
    const top = Math.min(y1, y2);
    const bot = Math.max(y1, y2);
    ctx.rect(0, top, ctx.width, bot - top, {
      fill: d.fill ?? this.fill,
      stroke: d.stroke ?? this.stroke,
      lineWidth: d.stroke || this.stroke ? 1 : void 0
    });
    if (d.label) {
      ctx.text(d.label, 4, top + 2, {
        font: this.labelFont,
        color: this.labelColor,
        align: "left",
        baseline: "top"
      });
    }
  }
};

// src/overlays/BollingerBands.ts
var BollingerBands = class extends OverlayBase {
  window;
  standardDeviations;
  midColor;
  bandColor;
  fill;
  lineWidth;
  constructor(adapter, options) {
    super(adapter, options);
    this.window = options.window ?? 20;
    this.standardDeviations = options.standardDeviations ?? 2;
    this.midColor = options.midColor ?? "#f59e0b";
    this.bandColor = options.bandColor ?? "rgba(245,158,11,0.5)";
    this.fill = options.fill ?? "rgba(245,158,11,0.08)";
    this.lineWidth = options.lineWidth ?? 1;
  }
  draw(ctx, _vp) {
    const data = this.data;
    if (!data || data.length === 0) return;
    const { upper, mid, lower } = computeBands(data, this.window, this.standardDeviations);
    const ups = [];
    const mids = [];
    const lows = [];
    for (let i = 0; i < data.length; i++) {
      if (isNaN(mid[i])) continue;
      const t = data[i].t;
      const u = this.adapter.toPixel(t, upper[i]);
      const m = this.adapter.toPixel(t, mid[i]);
      const l = this.adapter.toPixel(t, lower[i]);
      if (isFinite(u.x) && isFinite(u.y)) ups.push(u);
      if (isFinite(m.x) && isFinite(m.y)) mids.push(m);
      if (isFinite(l.x) && isFinite(l.y)) lows.push(l);
    }
    if (this.fill && ups.length > 1 && lows.length > 1) {
      ctx.path(
        (c) => {
          c.moveTo(ups[0].x, ups[0].y);
          for (let i = 1; i < ups.length; i++) c.lineTo(ups[i].x, ups[i].y);
          for (let i = lows.length - 1; i >= 0; i--) c.lineTo(lows[i].x, lows[i].y);
          c.closePath();
        },
        { fill: this.fill }
      );
    }
    ctx.polyline(ups, { stroke: this.bandColor, lineWidth: this.lineWidth });
    ctx.polyline(lows, { stroke: this.bandColor, lineWidth: this.lineWidth });
    ctx.polyline(mids, { stroke: this.midColor, lineWidth: this.lineWidth });
  }
};
function computeBands(data, window2, k) {
  const n = data.length;
  const upper = new Array(n).fill(NaN);
  const mid = new Array(n).fill(NaN);
  const lower = new Array(n).fill(NaN);
  if (window2 <= 0 || n < window2) return { upper, mid, lower };
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i].v;
    sum += v;
    sumSq += v * v;
    if (i >= window2) {
      const out = data[i - window2].v;
      sum -= out;
      sumSq -= out * out;
    }
    if (i >= window2 - 1) {
      const m = sum / window2;
      const variance = Math.max(0, sumSq / window2 - m * m);
      const sd = Math.sqrt(variance);
      mid[i] = m;
      upper[i] = m + k * sd;
      lower[i] = m - k * sd;
    }
  }
  return { upper, mid, lower };
}

// src/overlays/VWAP.ts
var VWAP = class extends OverlayBase {
  color;
  lineWidth;
  resets;
  constructor(adapter, options) {
    super(adapter, options);
    this.color = options.color ?? "#a78bfa";
    this.lineWidth = options.lineWidth ?? 1.5;
    this.resets = options.resets ?? [];
  }
  setResets(resets) {
    this.resets = resets;
    this.adapter.invalidate();
    return this;
  }
  draw(ctx, _vp) {
    const data = this.data;
    if (!data || data.length === 0) return;
    const vwap = computeVWAP(data, this.resets);
    let run = [];
    const flush = () => {
      if (run.length > 1)
        ctx.polyline(run, { stroke: this.color, lineWidth: this.lineWidth });
      run = [];
    };
    let resetIx = 0;
    for (let i = 0; i < data.length; i++) {
      const t = data[i].t;
      while (resetIx < this.resets.length && t >= this.resets[resetIx]) {
        flush();
        resetIx++;
      }
      const v = vwap[i];
      if (isNaN(v)) continue;
      const p = this.adapter.toPixel(t, v);
      if (isFinite(p.x) && isFinite(p.y)) run.push(p);
    }
    flush();
  }
};
function computeVWAP(data, resets = []) {
  const n = data.length;
  const out = new Array(n).fill(NaN);
  if (n === 0) return out;
  let pv = 0;
  let v = 0;
  let resetIx = 0;
  for (let i = 0; i < n; i++) {
    const s = data[i];
    while (resetIx < resets.length && s.t >= resets[resetIx]) {
      pv = 0;
      v = 0;
      resetIx++;
    }
    pv += s.price * s.volume;
    v += s.volume;
    out[i] = v > 0 ? pv / v : NaN;
  }
  return out;
}

// src/overlays/Crosshair.ts
var Crosshair = class extends OverlayBase {
  color;
  lineWidth;
  lineDash;
  labelFont;
  labelBg;
  labelColor;
  labelPad;
  formatX;
  formatY;
  showLabel;
  px = null;
  py = null;
  listenerEl = null;
  listeners = [];
  constructor(adapter, options) {
    super(adapter, options);
    this.color = options.color ?? "rgba(255,255,255,0.4)";
    this.lineWidth = options.lineWidth ?? 1;
    this.lineDash = options.lineDash ?? [3, 3];
    this.labelFont = options.labelFont ?? "10px sans-serif";
    this.labelBg = options.labelBg ?? "rgba(0,0,0,0.75)";
    this.labelColor = options.labelColor ?? "#fff";
    this.labelPad = options.labelPad ?? 4;
    this.formatX = options.formatX ?? defaultFormatX;
    this.formatY = options.formatY ?? defaultFormatY;
    this.showLabel = options.showLabel ?? true;
  }
  /**
   * Wire the crosshair to a pointer source. Returns a detach fn (also
   * stored internally so `destroy()` works).
   */
  attach(element) {
    this.listenerEl = element;
    const onMove = (ev) => {
      const pe = ev;
      const rect = element.getBoundingClientRect();
      this.px = pe.clientX - rect.left;
      this.py = pe.clientY - rect.top;
      this.adapter.invalidate();
    };
    const onLeave = () => {
      this.px = null;
      this.py = null;
      this.adapter.invalidate();
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    this.listeners.push({ ev: "pointermove", fn: onMove });
    this.listeners.push({ ev: "pointerleave", fn: onLeave });
    return () => this.detach();
  }
  detach() {
    if (!this.listenerEl) return;
    for (const { ev, fn } of this.listeners) {
      this.listenerEl.removeEventListener(ev, fn);
    }
    this.listeners = [];
    this.listenerEl = null;
  }
  /** Programmatic position (mostly for tests / synthetic events). */
  setCursor(px, py) {
    this.px = px;
    this.py = py;
    this.adapter.invalidate();
  }
  draw(ctx, _vp) {
    const px = this.px;
    const py = this.py;
    if (px === null || py === null) return;
    if (px < 0 || px > ctx.width || py < 0 || py > ctx.height) return;
    ctx.line(px, 0, px, ctx.height, {
      stroke: this.color,
      lineWidth: this.lineWidth,
      lineDash: this.lineDash
    });
    ctx.line(0, py, ctx.width, py, {
      stroke: this.color,
      lineWidth: this.lineWidth,
      lineDash: this.lineDash
    });
    if (!this.showLabel) return;
    const data = this.adapter.toData(px, py);
    if (!isFinite(data.x) || !isFinite(data.y)) return;
    const text = `${this.formatX(data.x)}  ${this.formatY(data.y)}`;
    const w = approxTextWidth(text, this.labelFont) + this.labelPad * 2;
    const h = 16;
    let x = px + 8;
    let y = py + 8;
    if (x + w > ctx.width) x = px - w - 8;
    if (y + h > ctx.height) y = py - h - 8;
    ctx.rect(x, y, w, h, { fill: this.labelBg });
    ctx.text(text, x + this.labelPad, y + h / 2, {
      font: this.labelFont,
      color: this.labelColor,
      align: "left",
      baseline: "middle"
    });
  }
};
function defaultFormatX(x) {
  if (x > 1e11) return new Date(x).toISOString().slice(11, 19);
  if (x > 1e8) return new Date(x * 1e3).toISOString().slice(11, 19);
  return x.toFixed(2);
}
function defaultFormatY(y) {
  return y.toFixed(2);
}
function approxTextWidth(text, font) {
  const m = /([\d.]+)px/.exec(font);
  const px = m ? parseFloat(m[1]) : 10;
  return text.length * px * 0.55;
}

// src/core/EventBus.ts
var EventBus = class {
  handlers = /* @__PURE__ */ new Map();
  on(event, handler) {
    let set = this.handlers.get(event);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }
  emit(event, payload) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) h(payload);
  }
  clear() {
    this.handlers.clear();
  }
};

// src/overlays/DrawingOverlay.ts
var FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
var POINTS_NEEDED = {
  hline: 1,
  text: 1,
  line: 2,
  rect: 2,
  measure: 2,
  fib: 2,
  channel: 3,
  cone: 3,
  polygon: -1
};
var DEFAULT_STROKE = "#facc15";
var DEFAULT_FILL = "rgba(250,204,21,0.12)";
var DEFAULT_LINE_WIDTH = 1.5;
var HANDLE_RADIUS = 4;
var HANDLE_HIT_PX = 10;
var BODY_HIT_PX = 8;
var LABEL_FONT = "10px sans-serif";
var LABEL_BG = "rgba(0,0,0,0.7)";
var FIB_FILL = "rgba(250,204,21,0.06)";
var MEASURE_UP = "#22c55e";
var MEASURE_DOWN = "#ef4444";
function defaultTextPrompt() {
  return typeof window !== "undefined" ? window.prompt("Note text:") : null;
}
var idCounter = 0;
var DrawingOverlay = class extends Layer {
  adapter;
  bus = new EventBus();
  drawings = [];
  tool = null;
  style = {};
  /** Points of the shape currently being placed (data space). */
  inProgress = [];
  inProgressType = null;
  /** Live cursor pixel for the rubber-band segment. */
  cursorPx = null;
  selectedId = null;
  /** Handle currently dragged: index into the selected drawing's points. */
  dragPointIndex = null;
  /** While dragging a whole drawing by its body, the previous pointer data point. */
  dragWholeLast = null;
  /** Handle currently hovered (for highlight), as (drawingId, pointIndex). */
  hoverHandle = null;
  /** Bar interval (seconds) for 'measure' Δbars; unset → measure omits Δbars. */
  barSeconds = null;
  textPrompt;
  constructor(adapter, opts = {}) {
    super(opts.id ?? "drawings");
    this.adapter = adapter;
    this.zIndex = opts.zIndex ?? 50;
    this.visible = opts.visible ?? true;
    this.textPrompt = opts.textPrompt ?? defaultTextPrompt;
  }
  // -- public API -----------------------------------------------------------
  setTool(tool) {
    this.clearInProgress();
    this.tool = tool;
    if (tool === null) {
      this.adapter.setInteractive?.(false);
    } else {
      this.adapter.setInteractive?.(true);
    }
    if (tool !== "select") this.setSelected(null);
    this.adapter.invalidate();
  }
  getTool() {
    return this.tool;
  }
  /** Deep copy of all drawings (safe to hand to a persistence layer). */
  getDrawings() {
    return this.drawings.map(cloneDrawing);
  }
  /** Replace all drawings (persistence restore). Emits 'change'. */
  setDrawings(d) {
    this.drawings = d.map(cloneDrawing);
    this.setSelected(null);
    this.clearInProgress();
    this.emitChange();
    this.adapter.invalidate();
  }
  clear() {
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
  deleteSelected() {
    if (this.selectedId === null) return;
    const before = this.drawings.length;
    this.drawings = this.drawings.filter((d) => d.id !== this.selectedId);
    this.setSelected(null);
    if (this.drawings.length !== before) this.emitChange();
    this.adapter.invalidate();
  }
  /** Style applied to new shapes and to the current selection. */
  setStyle(s) {
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
  getStyle() {
    return { ...this.style };
  }
  /**
   * Set the bar interval (in seconds) used by 'measure' to report Δbars.
   * Leave unset (or pass a non-finite value) and measure omits Δbars.
   */
  setBarSeconds(sec) {
    this.barSeconds = Number.isFinite(sec) && sec > 0 ? sec : null;
  }
  getBarSeconds() {
    return this.barSeconds;
  }
  /** Subscribe to a drawing event. Returns an unsubscribe fn. */
  on(event, cb) {
    return this.bus.on(event, cb);
  }
  /** Cancel the in-progress shape (host wires this to Esc). */
  cancelInProgress() {
    if (this.inProgress.length === 0 && this.cursorPx === null) return;
    this.clearInProgress();
    this.adapter.invalidate();
  }
  /** Currently selected drawing id, or null. */
  getSelectedId() {
    return this.selectedId;
  }
  // -- drawing --------------------------------------------------------------
  draw(ctx, _vp) {
    for (const d of this.drawings) {
      this.drawShape(ctx, d, d.id === this.selectedId);
    }
    this.drawInProgress(ctx);
  }
  drawShape(ctx, d, selected) {
    const stroke = d.style?.stroke ?? DEFAULT_STROKE;
    const fill = d.style?.fill ?? DEFAULT_FILL;
    const lineWidth = d.style?.lineWidth ?? DEFAULT_LINE_WIDTH;
    const pts = d.points.map((p) => this.adapter.toPixel(p.x, p.y));
    const sty = { stroke, fill, lineWidth };
    switch (d.type) {
      case "line": {
        const a = pts[0];
        const b = pts[1];
        if (a && b && isFinitePt(a) && isFinitePt(b)) {
          ctx.line(a.x, a.y, b.x, b.y, { stroke, lineWidth });
        }
        break;
      }
      case "rect": {
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
      case "hline":
        this.drawHLine(ctx, d, sty);
        break;
      case "fib":
        this.drawFib(ctx, d, sty);
        break;
      case "measure":
        this.drawMeasure(ctx, d, sty);
        break;
      case "channel":
        this.drawChannel(ctx, d, sty);
        break;
      case "cone":
        this.drawCone(ctx, d, sty);
        break;
      case "text":
        this.drawNote(ctx, d, sty);
        break;
      default: {
        const finite = pts.filter(isFinitePt);
        if (finite.length >= 3) {
          ctx.path(
            (c) => {
              c.moveTo(finite[0].x, finite[0].y);
              for (let i = 1; i < finite.length; i++) c.lineTo(finite[i].x, finite[i].y);
              c.closePath();
            },
            { stroke, fill, lineWidth }
          );
        } else if (finite.length === 2) {
          ctx.line(finite[0].x, finite[0].y, finite[1].x, finite[1].y, { stroke, lineWidth });
        }
        break;
      }
    }
    const inSelect = this.tool === "select";
    const showHandles = selected || inSelect || this.hoverHandle?.id === d.id;
    if (showHandles) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!isFinitePt(p)) continue;
        const hot = this.dragPointIndex === i && this.selectedId === d.id || this.hoverHandle?.id === d.id && this.hoverHandle.index === i;
        const emphasized = selected || hot;
        ctx.circle(p.x, p.y, hot ? HANDLE_RADIUS + 2 : HANDLE_RADIUS, {
          fill: hot ? "#fff" : emphasized ? stroke : "transparent",
          stroke,
          lineWidth: emphasized ? 1 : 1.5
        });
      }
    }
  }
  // -- finance-shape renderers ----------------------------------------------
  // Each takes the resolved { stroke, fill, lineWidth } and reprojects the
  // drawing's data-space points through adapter.toPixel so it scales/pans.
  /** Horizontal level across the full plot width, labeled with the price. */
  drawHLine(ctx, d, sty) {
    const p0 = d.points[0];
    if (!p0) return;
    const { y } = this.adapter.toPixel(p0.x, p0.y);
    if (!Number.isFinite(y)) return;
    ctx.line(0, y, ctx.width, y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
    drawLabel(ctx, fmtPrice(p0.y), ctx.width - 4, y - 2, sty.stroke, "right", "bottom");
  }
  /** Fibonacci retracement: a level line per FIB_LEVELS, right-extended. */
  drawFib(ctx, d, sty) {
    const p0 = d.points[0];
    const p1 = d.points[1];
    if (!p0 || !p1) return;
    const xStartData = Math.min(p0.x, p1.x);
    const left = this.adapter.toPixel(xStartData, p0.y).x;
    const x0 = Number.isFinite(left) ? left : 0;
    const right = ctx.width;
    const levelYs = [];
    for (const level of FIB_LEVELS) {
      const priceL = fibPrice(p0.y, p1.y, level);
      const { y } = this.adapter.toPixel(xStartData, priceL);
      levelYs.push(y);
    }
    for (let i = 1; i < levelYs.length; i++) {
      const ya = levelYs[i - 1];
      const yb = levelYs[i];
      if (!Number.isFinite(ya) || !Number.isFinite(yb)) continue;
      const top = Math.min(ya, yb);
      ctx.rect(x0, top, Math.max(0, right - x0), Math.abs(yb - ya), { fill: FIB_FILL });
    }
    for (let i = 0; i < FIB_LEVELS.length; i++) {
      const y = levelYs[i];
      if (!Number.isFinite(y)) continue;
      const level = FIB_LEVELS[i];
      const priceL = fibPrice(p0.y, p1.y, level);
      ctx.line(x0, y, right, y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      drawLabel(
        ctx,
        `${(level * 100).toFixed(1)}%  ${fmtPrice(priceL)}`,
        x0 + 4,
        y - 2,
        sty.stroke,
        "left",
        "bottom"
      );
    }
  }
  /** Range box + signed Δprice / Δ% / Δtime (and Δbars when barSeconds set). */
  drawMeasure(ctx, d, sty) {
    const p0 = d.points[0];
    const p1 = d.points[1];
    if (!p0 || !p1) return;
    const a = this.adapter.toPixel(p0.x, p0.y);
    const b = this.adapter.toPixel(p1.x, p1.y);
    if (!isFinitePt(a) || !isFinitePt(b)) return;
    const dPrice = p1.y - p0.y;
    const up = dPrice >= 0;
    const color = up ? MEASURE_UP : MEASURE_DOWN;
    const tint = up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    ctx.rect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y), {
      stroke: color,
      fill: tint,
      lineWidth: sty.lineWidth
    });
    const dPct = p0.y !== 0 ? dPrice / p0.y * 100 : 0;
    const lines = [
      `${dPrice >= 0 ? "+" : ""}${fmtPrice(dPrice)}  (${dPct >= 0 ? "+" : ""}${dPct.toFixed(2)}%)`,
      humanDuration(Math.abs(p1.x - p0.x))
    ];
    if (this.barSeconds && this.barSeconds > 0) {
      lines[1] += `  ${Math.round(Math.abs(p1.x - p0.x) / this.barSeconds)} bars`;
    }
    drawBox(ctx, lines, b.x + 6, b.y, color);
  }
  /** Trendline p0→p1 + a parallel line through p2, with the band shaded. */
  drawChannel(ctx, d, sty) {
    const p0 = d.points[0];
    const p1 = d.points[1];
    const p2 = d.points[2];
    if (!p0 || !p1) return;
    const a = this.adapter.toPixel(p0.x, p0.y);
    const b = this.adapter.toPixel(p1.x, p1.y);
    if (p1.x === p0.x) {
      if (isFinitePt(a) && isFinitePt(b)) ctx.line(a.x, a.y, b.x, b.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      return;
    }
    const slope = (p1.y - p0.y) / (p1.x - p0.x);
    if (p2) {
      const q0 = this.adapter.toPixel(p0.x, p2.y + slope * (p0.x - p2.x));
      const q1 = this.adapter.toPixel(p1.x, p2.y + slope * (p1.x - p2.x));
      if (isFinitePt(a) && isFinitePt(b) && isFinitePt(q0) && isFinitePt(q1)) {
        ctx.path(
          (c) => {
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.lineTo(q1.x, q1.y);
            c.lineTo(q0.x, q0.y);
            c.closePath();
          },
          { fill: sty.fill }
        );
        ctx.line(q0.x, q0.y, q1.x, q1.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      }
    }
    if (isFinitePt(a) && isFinitePt(b)) ctx.line(a.x, a.y, b.x, b.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
  }
  /** Forecast cone: filled triangle apex(p0)–p1–p2 + the two edge lines. */
  drawCone(ctx, d, sty) {
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
        { fill: sty.fill }
      );
      ctx.line(apex.x, apex.y, up.x, up.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      ctx.line(apex.x, apex.y, lo.x, lo.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
    } else {
      if (up && isFinitePt(up)) ctx.line(apex.x, apex.y, up.x, up.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
      if (lo && isFinitePt(lo)) ctx.line(apex.x, apex.y, lo.x, lo.y, { stroke: sty.stroke, lineWidth: sty.lineWidth });
    }
  }
  /** Free text note with a subtle background rect for legibility. */
  drawNote(ctx, d, sty) {
    const p0 = d.points[0];
    if (!p0) return;
    const a = this.adapter.toPixel(p0.x, p0.y);
    if (!isFinitePt(a)) return;
    const text = d.text ?? "";
    if (text === "") return;
    drawLabel(ctx, text, a.x, a.y, sty.stroke, "left", "middle");
  }
  drawInProgress(ctx) {
    if (this.inProgress.length === 0 || this.inProgressType === null) return;
    const stroke = this.style.stroke ?? DEFAULT_STROKE;
    const fill = this.style.fill ?? DEFAULT_FILL;
    const lineWidth = this.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    const pts = this.inProgress.map((p) => this.adapter.toPixel(p.x, p.y));
    if (this.inProgressType === "rect" || this.inProgressType === "measure") {
      const a = pts[0];
      const b = this.cursorPx ?? pts[1] ?? null;
      if (a && b && isFinitePt(a) && isFinitePt(b)) {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        ctx.rect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y), { stroke, fill, lineWidth });
      }
    } else {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (isFinitePt(a) && isFinitePt(b)) ctx.line(a.x, a.y, b.x, b.y, { stroke, lineWidth });
      }
      const last = pts[pts.length - 1];
      if (last && isFinitePt(last) && this.cursorPx) {
        ctx.line(last.x, last.y, this.cursorPx.x, this.cursorPx.y, {
          stroke,
          lineWidth,
          lineDash: [4, 4]
        });
      }
    }
    for (const p of pts) {
      if (isFinitePt(p)) ctx.circle(p.x, p.y, HANDLE_RADIUS, { fill: stroke });
    }
  }
  // -- pointer handlers -----------------------------------------------------
  onPointerDown(e) {
    if (this.tool === null) return;
    const isRightClick = e.source.button === 2;
    if (this.tool === "select") {
      this.handleSelectDown(e);
      return;
    }
    if (this.tool === "polygon" && isRightClick) {
      this.finalizePolygon();
      return;
    }
    if (isRightClick) return;
    const type = this.tool;
    const data = this.toDataSafe(e);
    if (this.inProgressType === null) this.inProgressType = type;
    this.inProgress.push({ x: data.x, y: data.y });
    const needed = POINTS_NEEDED[type];
    if (needed > 0 && this.inProgress.length >= needed) {
      const points = this.inProgress.slice(0, needed);
      if (type === "text") {
        const text = this.textPrompt();
        if (text === null || text === "") {
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
  onPointerMove(e) {
    this.cursorPx = { x: e.x, y: e.y };
    if (this.dragPointIndex !== null && this.selectedId !== null) {
      const sel = this.drawings.find((d) => d.id === this.selectedId);
      if (sel) {
        const data = this.toDataSafe(e);
        sel.points[this.dragPointIndex] = { x: data.x, y: data.y };
        this.emitChange();
        this.adapter.invalidate();
      }
      return;
    }
    if (this.dragWholeLast !== null && this.selectedId !== null) {
      const sel = this.drawings.find((d) => d.id === this.selectedId);
      if (sel) {
        const cur = this.toDataSafe(e);
        const dx = cur.x - this.dragWholeLast.x;
        const dy = cur.y - this.dragWholeLast.y;
        if (dx !== 0 || dy !== 0) {
          sel.points = sel.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          this.dragWholeLast = cur;
          this.emitChange();
          this.adapter.invalidate();
        }
      }
      return;
    }
    if (this.tool === "select") {
      const hit = this.hitHandle(e.x, e.y);
      const changed = (hit?.id ?? null) !== (this.hoverHandle?.id ?? null) || (hit?.index ?? -1) !== (this.hoverHandle?.index ?? -1);
      this.hoverHandle = hit;
      if (changed) this.adapter.invalidate();
      return;
    }
    if (this.inProgress.length > 0) this.adapter.invalidate();
  }
  onPointerUp(_e) {
    this.dragPointIndex = null;
    this.dragWholeLast = null;
  }
  /**
   * Pointer → data, but if the time axis can't map the pixel (a click in the
   * empty/future area right of the last bar, where TV's coordinateToTime is
   * null), snap x to a clamped time interpolated from the visible domain so the
   * point is still finite + reprojectable (otherwise it would never render).
   */
  toDataSafe(e) {
    const d = this.adapter.toData(e.x, e.y);
    if (!Number.isFinite(d.x)) {
      const dom = this.adapter.getViewport()?.xDomain;
      let w = 0;
      try {
        w = this.adapter.getCanvas().getBoundingClientRect().width || this.adapter.getCanvas().width;
      } catch {
        w = 0;
      }
      if (dom && Number.isFinite(dom[0]) && Number.isFinite(dom[1]) && w > 0) {
        const lo = Math.min(dom[0], dom[1]);
        const hi = Math.max(dom[0], dom[1]);
        const t = dom[0] + e.x / w * (dom[1] - dom[0]);
        d.x = Math.min(Math.max(t, lo), hi);
      }
    }
    return d;
  }
  // -- select / hit-testing -------------------------------------------------
  handleSelectDown(e) {
    const handle = this.hitHandle(e.x, e.y);
    if (handle) {
      this.setSelected(handle.id);
      this.dragPointIndex = handle.index;
      this.adapter.invalidate();
      return;
    }
    const body = this.hitBody(e.x, e.y);
    if (body) {
      this.setSelected(body);
      this.dragWholeLast = this.toDataSafe(e);
      this.adapter.invalidate();
      return;
    }
    this.setSelected(null);
    this.adapter.invalidate();
  }
  /** Topmost drawing whose handle is within HANDLE_HIT_PX of (px,py). */
  hitHandle(px, py) {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      for (let j = 0; j < d.points.length; j++) {
        const p = this.adapter.toPixel(d.points[j].x, d.points[j].y);
        if (!isFinitePt(p)) continue;
        if (dist(px, py, p.x, p.y) <= HANDLE_HIT_PX) return { id: d.id, index: j };
      }
    }
    return null;
  }
  /** Topmost drawing whose body contains / is near (px,py). */
  hitBody(px, py) {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      const pts = d.points.map((p) => this.adapter.toPixel(p.x, p.y)).filter(isFinitePt);
      if (d.type === "line") {
        if (pts.length === 2 && segDist(px, py, pts[0], pts[1]) <= BODY_HIT_PX) return d.id;
      } else if (d.type === "rect" || d.type === "measure") {
        if (pts.length === 2) {
          const x = Math.min(pts[0].x, pts[1].x);
          const y = Math.min(pts[0].y, pts[1].y);
          const w = Math.abs(pts[1].x - pts[0].x);
          const h = Math.abs(pts[1].y - pts[0].y);
          if (pointInRect(px, py, x, y, w, h, BODY_HIT_PX)) return d.id;
        }
      } else if (d.type === "hline") {
        if (pts.length >= 1 && Math.abs(py - pts[0].y) <= BODY_HIT_PX) return d.id;
      } else if (d.type === "fib") {
        if (pts.length === 2) {
          for (const level of FIB_LEVELS) {
            const yl = this.adapter.toPixel(d.points[0].x, fibPrice(d.points[0].y, d.points[1].y, level)).y;
            if (Number.isFinite(yl) && Math.abs(py - yl) <= BODY_HIT_PX) return d.id;
          }
        }
      } else if (d.type === "channel") {
        if (pts.length >= 2 && segDist(px, py, pts[0], pts[1]) <= BODY_HIT_PX) return d.id;
        if (pts.length >= 3 && segDist(px, py, pts[1], pts[2]) <= BODY_HIT_PX) return d.id;
        if (pts.length >= 3 && segDist(px, py, pts[0], pts[2]) <= BODY_HIT_PX) return d.id;
      } else if (d.type === "text") {
        if (pts.length >= 1 && dist(px, py, pts[0].x, pts[0].y) <= HANDLE_HIT_PX) return d.id;
      } else {
        if (pts.length >= 3 && pointInPolygon(px, py, pts)) return d.id;
        for (let k = 0; k < pts.length; k++) {
          const a = pts[k];
          const b = pts[(k + 1) % pts.length];
          if (segDist(px, py, a, b) <= BODY_HIT_PX) return d.id;
        }
      }
    }
    return null;
  }
  // -- internals ------------------------------------------------------------
  finalizeShape(type, points, text) {
    const d = {
      id: nextId(),
      type,
      points: points.map((p) => ({ x: p.x, y: p.y })),
      style: { ...this.style }
    };
    if (text !== void 0) d.text = text;
    this.drawings.push(d);
    this.clearInProgress();
    this.emitChange();
    this.bus.emit("toolidle", type);
    this.adapter.invalidate();
  }
  finalizePolygon() {
    if (this.inProgress.length < 3) {
      return;
    }
    this.finalizeShape("polygon", this.inProgress.slice());
  }
  clearInProgress() {
    this.inProgress = [];
    this.inProgressType = null;
    this.cursorPx = null;
  }
  setSelected(id) {
    this.selectedId = id;
    this.dragPointIndex = null;
    if (id === null) this.hoverHandle = null;
  }
  emitChange() {
    this.bus.emit("change", this.getDrawings());
  }
};
function fibPrice(y0, y1, level) {
  return y0 + (y1 - y0) * level;
}
function fmtPrice(v) {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  const digits = abs >= 1e3 ? 2 : abs >= 1 ? 2 : 6;
  return Number(v.toFixed(digits)).toString();
}
function humanDuration(seconds) {
  const s = Math.abs(Math.round(seconds));
  if (s === 0) return "0s";
  const d = Math.floor(s / 86400);
  const h = Math.floor(s % 86400 / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`);
  if (sec && !d && !h && !m) parts.push(`${sec}s`);
  return parts.length ? parts.slice(0, 2).join(" ") : `${s}s`;
}
function drawLabel(ctx, text, x, y, color, align, baseline) {
  const padX = 3;
  const padY = 2;
  const fontH = 10;
  const w = approxTextWidth2(text, fontH);
  let bx = x;
  if (align === "right") bx = x - w;
  else if (align === "center") bx = x - w / 2;
  let by = y;
  if (baseline === "bottom") by = y - fontH;
  else if (baseline === "middle") by = y - fontH / 2;
  ctx.rect(bx - padX, by - padY, w + padX * 2, fontH + padY * 2, { fill: LABEL_BG });
  ctx.text(text, x, y, { font: LABEL_FONT, color, align, baseline });
}
function drawBox(ctx, lines, x, y, color) {
  const fontH = 11;
  const lineGap = 3;
  const padX = 5;
  const padY = 4;
  const w = Math.max(...lines.map((l) => approxTextWidth2(l, fontH)));
  const h = lines.length * fontH + (lines.length - 1) * lineGap;
  ctx.rect(x, y, w + padX * 2, h + padY * 2, {
    fill: "rgba(0,0,0,0.78)",
    stroke: color,
    lineWidth: 1
  });
  let ty = y + padY;
  for (const l of lines) {
    ctx.text(l, x + padX, ty, { font: `${fontH}px sans-serif`, color, align: "left", baseline: "top" });
    ty += fontH + lineGap;
  }
}
function approxTextWidth2(text, fontH) {
  return Math.ceil(text.length * fontH * 0.58);
}
function isFinitePt(p) {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function segDist(px, py, a, b) {
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
function pointInRect(px, py, x, y, w, h, tol) {
  return px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h + tol;
}
function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect = yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function cloneDrawing(d) {
  const out = {
    id: d.id,
    type: d.type,
    points: d.points.map((p) => ({ x: p.x, y: p.y })),
    style: d.style ? { ...d.style } : void 0
  };
  if (d.text !== void 0) out.text = d.text;
  return out;
}
function nextId() {
  idCounter += 1;
  return `draw-${idCounter}`;
}

exports.BollingerBands = BollingerBands;
exports.Crosshair = Crosshair;
exports.DrawingOverlay = DrawingOverlay;
exports.FIB_LEVELS = FIB_LEVELS;
exports.OrderMarkers = OrderMarkers;
exports.OverlayBase = OverlayBase;
exports.PriceLine = PriceLine;
exports.SignalArrows = SignalArrows;
exports.ThresholdBand = ThresholdBand;
exports.VWAP = VWAP;
exports.ZoneBoxes = ZoneBoxes;
exports.computeBands = computeBands;
exports.computeVWAP = computeVWAP;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map