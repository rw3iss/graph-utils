// src/adapters/VanillaChartAdapter.ts
var VanillaChartAdapter = class {
  chart;
  interactive = false;
  pointerListeners = [];
  constructor(chart) {
    this.chart = chart;
  }
  getCanvas() {
    return this.chart.canvas;
  }
  getViewport() {
    return this.chart.viewport;
  }
  addLayer(layer) {
    this.chart.addLayer(layer);
  }
  removeLayer(idOrLayer) {
    this.chart.removeLayer(idOrLayer);
  }
  invalidate() {
    this.chart.invalidate();
  }
  toPixel(x, y) {
    return { x: this.chart.xScale.scale(x), y: this.chart.yScale.scale(y) };
  }
  toData(px, py) {
    return { x: this.chart.xScale.invert(px), y: this.chart.yScale.invert(py) };
  }
  setInteractive(on) {
    if (on === this.interactive) return;
    this.interactive = on;
    if (on) this.attachPointerListeners();
    else this.detachPointerListeners();
  }
  getInteractive() {
    return this.interactive;
  }
  // -- private --------------------------------------------------------------
  attachPointerListeners() {
    if (this.pointerListeners.length) return;
    const canvas = this.chart.canvas;
    const down = (ev) => this.dispatchPointer("down", ev);
    const move = (ev) => this.dispatchPointer("move", ev);
    const up = (ev) => this.dispatchPointer("up", ev);
    const cancel = (ev) => this.dispatchPointer("up", ev);
    const ctx = (ev) => ev.preventDefault();
    const add = (type, fn) => {
      canvas.addEventListener(type, fn);
      this.pointerListeners.push({ type, fn });
    };
    add("pointerdown", down);
    add("pointermove", move);
    add("pointerup", up);
    add("pointercancel", cancel);
    add("contextmenu", ctx);
  }
  detachPointerListeners() {
    const canvas = this.chart.canvas;
    for (const { type, fn } of this.pointerListeners) {
      canvas.removeEventListener(type, fn);
    }
    this.pointerListeners = [];
  }
  dispatchPointer(kind, ev) {
    const rect = this.chart.canvas.getBoundingClientRect();
    const le = {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      source: ev
    };
    const layers = this.chart.getLayers();
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!l.visible) continue;
      const handler = kind === "down" ? l.onPointerDown : kind === "move" ? l.onPointerMove : l.onPointerUp;
      if (handler) handler.call(l, le);
    }
  }
};

// src/core/primitives.ts
function applyCommon(ctx, opts) {
  if (opts.alpha !== void 0) ctx.globalAlpha = opts.alpha;
  if (opts.lineCap !== void 0) ctx.lineCap = opts.lineCap;
  if (opts.lineJoin !== void 0) ctx.lineJoin = opts.lineJoin;
  if (opts.lineDash !== void 0) ctx.setLineDash(opts.lineDash);
}
function applyStroke(ctx, opts) {
  ctx.strokeStyle = opts.stroke;
  ctx.lineWidth = opts.lineWidth ?? 1;
  ctx.stroke();
}
function applyFill(ctx, opts) {
  ctx.fillStyle = opts.fill;
  ctx.fill();
}
function clearRect(ctx, x, y, w, h) {
  ctx.clearRect(x, y, w, h);
}
function drawLine(ctx, x1, y1, x2, y2, opts = {}) {
  const stroke = opts.stroke ?? "#000";
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = opts.lineWidth ?? 1;
  ctx.stroke();
  ctx.restore();
}
function drawRect(ctx, x, y, w, h, opts = {}) {
  ctx.save();
  applyCommon(ctx, opts);
  if (opts.fill !== void 0) {
    ctx.fillStyle = opts.fill;
    ctx.fillRect(x, y, w, h);
  }
  if (opts.stroke !== void 0) {
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.lineWidth ?? 1;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}
function drawCircle(ctx, x, y, r, opts = {}) {
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (opts.fill !== void 0) applyFill(ctx, opts);
  if (opts.stroke !== void 0) applyStroke(ctx, opts);
  ctx.restore();
}
function drawPolyline(ctx, points, opts = {}) {
  if (points.length < 2) return;
  const stroke = opts.stroke ?? "#000";
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (opts.fill !== void 0) applyFill(ctx, opts);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = opts.lineWidth ?? 1;
  ctx.stroke();
  ctx.restore();
}
function drawPath(ctx, fn, opts = {}) {
  ctx.save();
  applyCommon(ctx, opts);
  ctx.beginPath();
  fn(ctx);
  if (opts.fill !== void 0) applyFill(ctx, opts);
  if (opts.stroke !== void 0) applyStroke(ctx, opts);
  ctx.restore();
}
function drawText(ctx, text, x, y, options = {}) {
  ctx.save();
  if (options.alpha !== void 0) ctx.globalAlpha = options.alpha;
  if (options.font !== void 0) ctx.font = options.font;
  if (options.color !== void 0) ctx.fillStyle = options.color;
  if (options.align !== void 0) ctx.textAlign = options.align;
  if (options.baseline !== void 0) ctx.textBaseline = options.baseline;
  if (options.angle !== void 0 && options.angle !== 0) {
    ctx.translate(x, y);
    ctx.rotate(options.angle * Math.PI / 180);
    ctx.fillText(text, 0, 0);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}
function createLinearGradient(ctx, x1, y1, x2, y2, stops) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  const n = Math.max(1, stops.length - 1);
  for (let i = 0; i < stops.length; i++) {
    g.addColorStop(i / n, stops[i]);
  }
  return g;
}

// src/core/CanvasContext.ts
var CanvasContext = class {
  canvas;
  ctx;
  _dpr;
  _cssWidth = 0;
  _cssHeight = 0;
  constructor(canvas, options = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CanvasContext: failed to acquire 2d context");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this._dpr = options.dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1) ?? 1;
    const cssW = canvas.clientWidth || canvas.width || 0;
    const cssH = canvas.clientHeight || canvas.height || 0;
    this.resize(cssW, cssH);
  }
  get dpr() {
    return this._dpr;
  }
  get width() {
    return this._cssWidth;
  }
  get height() {
    return this._cssHeight;
  }
  /**
   * Reconcile backing buffer with CSS size. Idempotent.
   * Applies a setTransform so all subsequent drawing is in CSS pixels.
   */
  resize(cssWidth, cssHeight, dpr) {
    if (dpr !== void 0) this._dpr = dpr;
    this._cssWidth = cssWidth;
    this._cssHeight = cssHeight;
    const buffW = Math.max(1, Math.floor(cssWidth * this._dpr));
    const buffH = Math.max(1, Math.floor(cssHeight * this._dpr));
    if (this.canvas.width !== buffW) this.canvas.width = buffW;
    if (this.canvas.height !== buffH) this.canvas.height = buffH;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
  }
  /** Save / restore wrap helper for layered clipping. */
  withClip(x, y, w, h, fn) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    try {
      fn();
    } finally {
      this.ctx.restore();
    }
  }
  // ---- thin delegates over primitives ----------------------------------
  // Uniform shape: positional geometry, one DrawStyle options bag.
  clear() {
    clearRect(this.ctx, 0, 0, this._cssWidth, this._cssHeight);
  }
  line(x1, y1, x2, y2, opts = {}) {
    drawLine(this.ctx, x1, y1, x2, y2, opts);
  }
  rect(x, y, w, h, opts = {}) {
    drawRect(this.ctx, x, y, w, h, opts);
  }
  circle(x, y, r, opts = {}) {
    drawCircle(this.ctx, x, y, r, opts);
  }
  polyline(points, opts = {}) {
    drawPolyline(this.ctx, points, opts);
  }
  path(fn, opts = {}) {
    drawPath(this.ctx, fn, opts);
  }
  text(text, x, y, style = {}) {
    drawText(this.ctx, text, x, y, style);
  }
  gradient(x1, y1, x2, y2, stops) {
    return createLinearGradient(this.ctx, x1, y1, x2, y2, stops);
  }
};

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

// src/core/Viewport.ts
var Viewport = class {
  _xDomain;
  _yDomain;
  opts;
  bus = new EventBus();
  constructor(opts) {
    this.opts = opts;
    this._xDomain = [opts.xDomain[0], opts.xDomain[1]];
    this._yDomain = [opts.yDomain[0], opts.yDomain[1]];
  }
  get xDomain() {
    return this._xDomain;
  }
  get yDomain() {
    return this._yDomain;
  }
  state() {
    return { xDomain: this._xDomain, yDomain: this._yDomain };
  }
  setXDomain(d) {
    this._xDomain = [d[0], d[1]];
    this.applyBounds();
    this.bus.emit("change", this.state());
  }
  setYDomain(d) {
    this._yDomain = [d[0], d[1]];
    this.applyBounds();
    this.bus.emit("change", this.state());
  }
  /** Translate by (dx, dy) in data units. */
  pan(dx, dy) {
    this._xDomain = [this._xDomain[0] + dx, this._xDomain[1] + dx];
    this._yDomain = [this._yDomain[0] + dy, this._yDomain[1] + dy];
    this.applyBounds();
    this.bus.emit("change", this.state());
  }
  /**
   * Zoom by `factor` (>1 = zoom out, <1 = zoom in) around an anchor in [0,1]
   * along each axis. Axes with anchor `undefined` are left unchanged.
   */
  zoom(factor, anchor = {}) {
    if (anchor.x !== void 0) {
      const [a, b] = this._xDomain;
      const span = b - a;
      const center = a + span * anchor.x;
      const newSpan = clampSpan(span * factor, this.opts.xMinSpan, this.opts.xMaxSpan);
      this._xDomain = [center - newSpan * anchor.x, center + newSpan * (1 - anchor.x)];
    }
    if (anchor.y !== void 0) {
      const [a, b] = this._yDomain;
      const span = b - a;
      const center = a + span * anchor.y;
      const newSpan = clampSpan(span * factor, this.opts.yMinSpan, this.opts.yMaxSpan);
      this._yDomain = [center - newSpan * anchor.y, center + newSpan * (1 - anchor.y)];
    }
    this.applyBounds();
    this.bus.emit("change", this.state());
  }
  applyBounds() {
    if (this.opts.xBounds) this._xDomain = clampDomain(this._xDomain, this.opts.xBounds);
    if (this.opts.yBounds) this._yDomain = clampDomain(this._yDomain, this.opts.yBounds);
  }
};
function clampSpan(span, min, max) {
  let s = span;
  if (min !== void 0 && s < min) s = min;
  if (max !== void 0 && s > max) s = max;
  return s;
}
function clampDomain(d, bounds) {
  const span = d[1] - d[0];
  const boundSpan = bounds[1] - bounds[0];
  if (span >= boundSpan) return [bounds[0], bounds[1]];
  let lo = d[0];
  let hi = d[1];
  if (lo < bounds[0]) {
    lo = bounds[0];
    hi = lo + span;
  }
  if (hi > bounds[1]) {
    hi = bounds[1];
    lo = hi - span;
  }
  return [lo, hi];
}

// src/adapters/TradingViewOverlayAdapter.ts
var TradingViewTimeScaleAdapter = class {
  ts;
  toTime;
  fromTime;
  constructor(ts, unit) {
    this.ts = ts;
    if (unit === "milliseconds") {
      this.toTime = (v) => Math.floor(v / 1e3);
      this.fromTime = (t) => typeof t === "number" ? t * 1e3 : Number(t);
    } else {
      this.toTime = (v) => v;
      this.fromTime = (t) => typeof t === "number" ? t : Number(t);
    }
  }
  setDomain(_domain) {
  }
  setRange(_range) {
  }
  domain() {
    const r = this.ts.getVisibleRange();
    if (!r) return [0, 0];
    return [this.fromTime(r.from), this.fromTime(r.to)];
  }
  range() {
    return [NaN, NaN];
  }
  scale(value) {
    const x = this.ts.timeToCoordinate(this.toTime(value));
    return x === null ? NaN : x;
  }
  invert(pixel) {
    const t = this.ts.coordinateToTime(pixel);
    return t === null ? NaN : this.fromTime(t);
  }
  ticks(count) {
    const r = this.ts.getVisibleRange();
    if (!r) return [];
    const from = this.fromTime(r.from);
    const to = this.fromTime(r.to);
    if (!isFinite(from) || !isFinite(to) || from === to) return [from];
    const out = [];
    for (let i = 0; i <= count; i++) {
      out.push(from + (to - from) * i / count);
    }
    return out;
  }
};
var TradingViewPriceScaleAdapter = class {
  s;
  constructor(series) {
    this.s = series;
  }
  setDomain(_d) {
  }
  setRange(_r) {
  }
  domain() {
    return [NaN, NaN];
  }
  range() {
    return [NaN, NaN];
  }
  scale(price) {
    const y = this.s.priceToCoordinate(price);
    return y === null ? NaN : y;
  }
  invert(pixel) {
    const p = this.s.coordinateToPrice(pixel);
    return p === null ? NaN : p;
  }
  ticks(_count) {
    return [];
  }
};
var TradingViewOverlayAdapter = class {
  tvChart;
  priceSeries;
  xScale;
  yScale;
  viewport;
  canvas;
  ctx;
  container;
  chartElement;
  layers = [];
  resizeObserver = null;
  rafHandle = null;
  destroyed = false;
  timeUnit;
  onLogical;
  onCrosshair = null;
  interactive = false;
  pointerListeners = [];
  constructor(options) {
    this.tvChart = options.chart;
    this.priceSeries = options.priceSeries;
    this.timeUnit = options.timeUnit ?? "seconds";
    this.chartElement = this.tvChart.chartElement();
    this.container = options.container ?? this.chartElement.parentElement;
    if (!this.container) {
      throw new Error(
        "TradingViewOverlayAdapter: no container \u2014 pass `container` explicitly when the chart is not yet attached to a parent."
      );
    }
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.left = "0";
    this.canvas.style.top = "0";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = String(options.zIndex ?? 10);
    const cs = getComputedStyle(this.container);
    if (cs.position === "static") this.container.style.position = "relative";
    this.container.appendChild(this.canvas);
    this.ctx = new CanvasContext(this.canvas, { dpr: options.dpr });
    this.xScale = new TradingViewTimeScaleAdapter(this.tvChart.timeScale(), this.timeUnit);
    this.yScale = new TradingViewPriceScaleAdapter(this.priceSeries);
    this.viewport = new Viewport({
      xDomain: this.xScale.domain(),
      yDomain: [0, 1]
    });
    this.onLogical = () => {
      this.syncViewportDomain();
      this.invalidate();
    };
    this.tvChart.timeScale().subscribeVisibleLogicalRangeChange(this.onLogical);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.chartElement);
    }
    this.handleResize();
    if (typeof this.tvChart.subscribeCrosshairMove === "function") {
      this.onCrosshair = () => this.invalidate();
      this.tvChart.subscribeCrosshairMove(this.onCrosshair);
    }
  }
  // -- Adapter implementation ------------------------------------------------
  getCanvas() {
    return this.canvas;
  }
  getViewport() {
    return this.viewport;
  }
  addLayer(layer) {
    this.layers.push(layer);
    this.layers.sort((a, b) => a.zIndex - b.zIndex);
    this.invalidate();
  }
  removeLayer(idOrLayer) {
    const id = typeof idOrLayer === "string" ? idOrLayer : idOrLayer.id;
    this.layers = this.layers.filter((l) => l.id !== id);
    this.invalidate();
  }
  invalidate() {
    if (this.rafHandle !== null || this.destroyed) return;
    if (typeof requestAnimationFrame === "undefined") return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.render();
    });
  }
  /**
   * Map a (time, price) pair in data space to overlay-canvas pixel coords.
   * Returns `{ NaN, NaN }` if either coordinate is outside the visible
   * range (TV returns null in that case).
   */
  toPixel(time, price) {
    return { x: this.xScale.scale(time), y: this.yScale.scale(price) };
  }
  toData(px, py) {
    return { x: this.xScale.invert(px), y: this.yScale.invert(py) };
  }
  /**
   * Toggle pointer interaction. The overlay canvas is `pointer-events: none`
   * by default so TV keeps pan/zoom. Turning interaction on flips it to
   * `'auto'` and attaches pointer listeners that dispatch to layers'
   * `onPointerDown/Move/Up`; turning it off restores `'none'` and detaches.
   * Idempotent.
   */
  setInteractive(on) {
    if (on === this.interactive) return;
    this.interactive = on;
    if (on) {
      this.canvas.style.pointerEvents = "auto";
      this.attachPointerListeners();
    } else {
      this.canvas.style.pointerEvents = "none";
      this.detachPointerListeners();
    }
  }
  getInteractive() {
    return this.interactive;
  }
  /** Synchronously draw all visible layers. Mostly internal — prefer `invalidate()`. */
  render() {
    if (this.destroyed) return;
    this.ctx.clear();
    for (const l of this.layers) {
      if (!l.visible) continue;
      l.draw(this.ctx, this.viewport);
    }
  }
  destroy() {
    this.destroyed = true;
    this.detachPointerListeners();
    if (this.rafHandle !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.tvChart.timeScale().unsubscribeVisibleLogicalRangeChange(this.onLogical);
    if (this.onCrosshair && this.tvChart.unsubscribeCrosshairMove) {
      this.tvChart.unsubscribeCrosshairMove(this.onCrosshair);
    }
    this.canvas.parentElement?.removeChild(this.canvas);
    this.viewport.bus.clear();
  }
  // -- private --------------------------------------------------------------
  attachPointerListeners() {
    if (this.pointerListeners.length) return;
    const down = (ev) => this.dispatchPointer("down", ev);
    const move = (ev) => this.dispatchPointer("move", ev);
    const up = (ev) => this.dispatchPointer("up", ev);
    const cancel = (ev) => this.dispatchPointer("up", ev);
    const ctx = (ev) => ev.preventDefault();
    const add = (type, fn) => {
      this.canvas.addEventListener(type, fn);
      this.pointerListeners.push({ type, fn });
    };
    add("pointerdown", down);
    add("pointermove", move);
    add("pointerup", up);
    add("pointercancel", cancel);
    add("contextmenu", ctx);
  }
  detachPointerListeners() {
    for (const { type, fn } of this.pointerListeners) {
      this.canvas.removeEventListener(type, fn);
    }
    this.pointerListeners = [];
  }
  /**
   * Translate a DOM pointer event into a `LayerPointerEvent` (canvas-local
   * CSS pixels) and dispatch to layers implementing the matching handler,
   * topmost (highest zIndex) first.
   */
  dispatchPointer(kind, ev) {
    const rect = this.canvas.getBoundingClientRect();
    const le = {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      source: ev
    };
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (!l.visible) continue;
      const handler = kind === "down" ? l.onPointerDown : kind === "move" ? l.onPointerMove : l.onPointerUp;
      if (handler) handler.call(l, le);
    }
  }
  handleResize() {
    const rect = this.chartElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w > 0 && h > 0) {
      const containerRect = this.container.getBoundingClientRect();
      this.canvas.style.left = `${rect.left - containerRect.left}px`;
      this.canvas.style.top = `${rect.top - containerRect.top}px`;
      this.ctx.resize(w, h);
      this.syncViewportDomain();
      this.invalidate();
    }
  }
  syncViewportDomain() {
    const xd = this.xScale.domain();
    if (isFinite(xd[0]) && isFinite(xd[1])) {
      this.viewport.setXDomain(xd);
    }
  }
};

export { TradingViewOverlayAdapter, VanillaChartAdapter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map