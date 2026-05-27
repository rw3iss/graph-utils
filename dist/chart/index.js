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

// src/core/Scale.ts
var BaseScale = class {
  _domain;
  _range;
  constructor(domain, range) {
    this._domain = domain;
    this._range = range;
  }
  setDomain(domain) {
    this._domain = domain;
  }
  setRange(range) {
    this._range = range;
  }
  domain() {
    return this._domain;
  }
  range() {
    return this._range;
  }
};
var LinearScale = class extends BaseScale {
  scale(value) {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (d1 === d0) return r0;
    return r0 + (value - d0) / (d1 - d0) * (r1 - r0);
  }
  invert(pixel) {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (r1 === r0) return d0;
    return d0 + (pixel - r0) / (r1 - r0) * (d1 - d0);
  }
  ticks(count) {
    return niceLinearTicks(this._domain[0], this._domain[1], count);
  }
};
function niceLinearTicks(d0, d1, count) {
  if (d1 === d0) return [d0];
  const span = d1 - d0;
  const step = niceStep(span / Math.max(1, count));
  const start = Math.ceil(d0 / step) * step;
  const out = [];
  for (let v = start; v <= d1 + step * 1e-9; v += step) {
    out.push(roundToStep(v, step));
  }
  return out;
}
function niceStep(rough) {
  if (rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const f = rough / Math.pow(10, exp);
  let nice;
  if (f < 1.5) nice = 1;
  else if (f < 3) nice = 2;
  else if (f < 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}
function roundToStep(v, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

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
var GridLayer = class extends Layer {
  color = "rgba(128,128,128,0.18)";
  lineWidth = 1;
  xScale;
  yScale;
  bounds;
  tickCount;
  constructor(id, xScale, yScale, bounds, tickCount = { x: 8, y: 5 }) {
    super(id);
    this.xScale = xScale;
    this.yScale = yScale;
    this.bounds = bounds;
    this.tickCount = tickCount;
    this.zIndex = -100;
  }
  draw(ctx, _vp) {
    const b = this.bounds();
    const xs = this.xScale();
    const ys = this.yScale();
    for (const tx of xs.ticks(this.tickCount.x)) {
      const x = xs.scale(tx);
      if (x < b.left || x > b.right) continue;
      ctx.line(x, b.top, x, b.bottom, { stroke: this.color, lineWidth: this.lineWidth });
    }
    for (const ty of ys.ticks(this.tickCount.y)) {
      const y = ys.scale(ty);
      if (y < b.top || y > b.bottom) continue;
      ctx.line(b.left, y, b.right, y, { stroke: this.color, lineWidth: this.lineWidth });
    }
  }
};
var AxisLayer = class extends Layer {
  color = "#aaa";
  font = "11px sans-serif";
  tickCount = 6;
  formatter = (v) => String(v);
  side;
  scale;
  bounds;
  constructor(id, side, scale, bounds) {
    super(id);
    this.side = side;
    this.scale = scale;
    this.bounds = bounds;
    this.zIndex = 100;
  }
  draw(ctx, _vp) {
    const b = this.bounds();
    const s = this.scale();
    const stroke = { stroke: this.color, lineWidth: 1 };
    if (this.side === "bottom") {
      ctx.line(b.left, b.bottom, b.right, b.bottom, stroke);
      for (const t of s.ticks(this.tickCount)) {
        const x = s.scale(t);
        if (x < b.left || x > b.right) continue;
        ctx.line(x, b.bottom, x, b.bottom + 4, stroke);
        ctx.text(this.formatter(t), x, b.bottom + 6, {
          font: this.font,
          color: this.color,
          align: "center",
          baseline: "top"
        });
      }
    } else {
      ctx.line(b.left, b.top, b.left, b.bottom, stroke);
      for (const t of s.ticks(this.tickCount)) {
        const y = s.scale(t);
        if (y < b.top || y > b.bottom) continue;
        ctx.line(b.left - 4, y, b.left, y, stroke);
        ctx.text(this.formatter(t), b.left - 6, y, {
          font: this.font,
          color: this.color,
          align: "right",
          baseline: "middle"
        });
      }
    }
  }
};

// src/chart/interactions.ts
function attachInteractions(canvas, viewport, size, options = {}) {
  const o = {
    panX: options.panX ?? true,
    panY: options.panY ?? true,
    zoomX: options.zoomX ?? true,
    zoomY: options.zoomY ?? false,
    wheelZoomSensitivity: options.wheelZoomSensitivity ?? 15e-4,
    shiftSwapsAxis: options.shiftSwapsAxis ?? true
  };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  function localCoords(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  const onDown = (ev) => {
    dragging = true;
    const p = localCoords(ev);
    lastX = p.x;
    lastY = p.y;
    canvas.setPointerCapture(ev.pointerId);
  };
  const onMove = (ev) => {
    if (!dragging) return;
    const p = localCoords(ev);
    const dxPx = p.x - lastX;
    const dyPx = p.y - lastY;
    lastX = p.x;
    lastY = p.y;
    const s = size();
    if (s.width <= 0 || s.height <= 0) return;
    const x = viewport.xDomain;
    const y = viewport.yDomain;
    const dxData = o.panX ? -(dxPx / s.width) * (x[1] - x[0]) : 0;
    const dyData = o.panY ? dyPx / s.height * (y[1] - y[0]) : 0;
    if (dxData !== 0 || dyData !== 0) viewport.pan(dxData, dyData);
  };
  const onUp = (ev) => {
    dragging = false;
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  };
  const onWheel = (ev) => {
    ev.preventDefault();
    const p = localCoords(ev);
    const s = size();
    if (s.width <= 0 || s.height <= 0) return;
    const factor = Math.exp(ev.deltaY * o.wheelZoomSensitivity);
    const useY = o.shiftSwapsAxis && ev.shiftKey;
    const anchor = {};
    if (useY) {
      if (o.zoomY) anchor.y = p.y / s.height;
    } else {
      if (o.zoomX) anchor.x = p.x / s.width;
      else if (o.zoomY) anchor.y = p.y / s.height;
    }
    if (anchor.x === void 0 && anchor.y === void 0) return;
    viewport.zoom(factor, anchor);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("wheel", onWheel);
  };
}

// src/chart/Chart.ts
var DEFAULT_PADDING = { top: 12, right: 16, bottom: 28, left: 48 };
var Chart = class {
  canvas;
  ctx;
  viewport;
  xScale;
  yScale;
  padding;
  background;
  layers = [];
  resizeObserver = null;
  detachInteractions = null;
  rafHandle = null;
  destroyed = false;
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = new CanvasContext(canvas);
    this.padding = { ...DEFAULT_PADDING, ...options.padding ?? {} };
    this.background = options.background ?? null;
    this.viewport = new Viewport(options);
    this.xScale = options.xScale ?? new LinearScale(this.viewport.xDomain, [0, 0]);
    this.yScale = options.yScale ?? new LinearScale(this.viewport.yDomain, [0, 0]);
    this.refreshScales();
    if (options.grid !== false) {
      const grid = new GridLayer(
        "__grid__",
        () => this.xScale,
        () => this.yScale,
        () => this.plotBounds()
      );
      this.addLayer(grid);
    }
    if (options.axes !== false) {
      const bottomAxis = new AxisLayer(
        "__axis-x__",
        "bottom",
        () => this.xScale,
        () => this.plotBounds()
      );
      const leftAxis = new AxisLayer(
        "__axis-y__",
        "left",
        () => this.yScale,
        () => this.plotBounds()
      );
      if (options.xTickFormatter) bottomAxis.formatter = options.xTickFormatter;
      if (options.yTickFormatter) leftAxis.formatter = options.yTickFormatter;
      this.addLayer(bottomAxis);
      this.addLayer(leftAxis);
    }
    if (options.interactions !== false) {
      this.detachInteractions = attachInteractions(
        canvas,
        this.viewport,
        () => ({ width: this.plotWidth(), height: this.plotHeight() }),
        options.interactions ?? {}
      );
    }
    this.viewport.bus.on("change", () => {
      this.refreshScales();
      this.invalidate();
    });
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(canvas);
    }
    this.handleResize();
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
  getLayers() {
    return this.layers;
  }
  /** Request a redraw on the next animation frame. */
  invalidate() {
    if (this.rafHandle !== null || this.destroyed) return;
    if (typeof requestAnimationFrame === "undefined") {
      return;
    }
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.render();
    });
  }
  /** Synchronous draw of all visible layers. */
  render() {
    if (this.destroyed) return;
    this.ctx.clear();
    if (this.background !== null) {
      this.ctx.rect(0, 0, this.ctx.width, this.ctx.height, { fill: this.background });
    }
    for (const l of this.layers) {
      if (!l.visible) continue;
      l.draw(this.ctx, this.viewport);
    }
  }
  /** Top-left and bottom-right of the plot area in CSS pixels. */
  plotBounds() {
    return {
      left: this.padding.left,
      top: this.padding.top,
      right: this.ctx.width - this.padding.right,
      bottom: this.ctx.height - this.padding.bottom
    };
  }
  plotWidth() {
    return Math.max(0, this.ctx.width - this.padding.left - this.padding.right);
  }
  plotHeight() {
    return Math.max(0, this.ctx.height - this.padding.top - this.padding.bottom);
  }
  /** Dispatch a synthetic pointer event to layers (Chart calls this itself). */
  dispatchPointerMove(e) {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (l.visible && l.onPointerMove) l.onPointerMove(e);
    }
  }
  destroy() {
    this.destroyed = true;
    if (this.rafHandle !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.detachInteractions) {
      this.detachInteractions();
      this.detachInteractions = null;
    }
    this.viewport.bus.clear();
  }
  handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.clientWidth;
    const h = rect.height || this.canvas.clientHeight;
    if (w > 0 && h > 0) {
      this.ctx.resize(w, h);
      this.refreshScales();
      this.invalidate();
    }
  }
  refreshScales() {
    const b = this.plotBounds();
    this.xScale.setDomain(this.viewport.xDomain);
    this.xScale.setRange([b.left, b.right]);
    this.yScale.setDomain(this.viewport.yDomain);
    this.yScale.setRange([b.bottom, b.top]);
  }
};

// src/chart/SharedAxis.ts
function share(viewports, axis) {
  if (viewports.length < 2) return () => {
  };
  let syncing = false;
  const unsubs = [];
  const head = viewports[0];
  syncing = true;
  for (let i = 1; i < viewports.length; i++) {
    const v = viewports[i];
    if (axis === "x") v.setXDomain(head.xDomain);
    else v.setYDomain(head.yDomain);
  }
  syncing = false;
  for (const src of viewports) {
    const off = src.bus.on("change", () => {
      if (syncing) return;
      syncing = true;
      try {
        const d = axis === "x" ? src.xDomain : src.yDomain;
        for (const dst of viewports) {
          if (dst === src) continue;
          if (axis === "x") dst.setXDomain(d);
          else dst.setYDomain(d);
        }
      } finally {
        syncing = false;
      }
    });
    unsubs.push(off);
  }
  return () => {
    for (const off of unsubs) off();
  };
}
function shareXAxis(viewports) {
  return share(viewports, "x");
}
function shareYAxis(viewports) {
  return share(viewports, "y");
}
function shareAxes(viewports) {
  if (viewports.length < 2) return () => {
  };
  let syncing = false;
  const unsubs = [];
  const head = viewports[0];
  syncing = true;
  for (let i = 1; i < viewports.length; i++) {
    viewports[i].setXDomain(head.xDomain);
    viewports[i].setYDomain(head.yDomain);
  }
  syncing = false;
  for (const src of viewports) {
    const off = src.bus.on("change", () => {
      if (syncing) return;
      syncing = true;
      try {
        const xd = src.xDomain;
        const yd = src.yDomain;
        for (const dst of viewports) {
          if (dst === src) continue;
          dst.setXDomain(xd);
          dst.setYDomain(yd);
        }
      } finally {
        syncing = false;
      }
    });
    unsubs.push(off);
  }
  return () => {
    for (const off of unsubs) off();
  };
}

export { AxisLayer, Chart, GridLayer, Layer, attachInteractions, shareAxes, shareXAxis, shareYAxis };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map