'use strict';

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
var LogScale = class extends BaseScale {
  constructor(domain, range) {
    super(domain, range);
    if (domain[0] <= 0 || domain[1] <= 0) {
      throw new Error("LogScale: domain values must be > 0");
    }
  }
  setDomain(domain) {
    if (domain[0] <= 0 || domain[1] <= 0) {
      throw new Error("LogScale: domain values must be > 0");
    }
    super.setDomain(domain);
  }
  scale(value) {
    if (value <= 0) return this._range[0];
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    const ld0 = Math.log10(d0);
    const ld1 = Math.log10(d1);
    if (ld1 === ld0) return r0;
    return r0 + (Math.log10(value) - ld0) / (ld1 - ld0) * (r1 - r0);
  }
  invert(pixel) {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (r1 === r0) return d0;
    const ld0 = Math.log10(d0);
    const ld1 = Math.log10(d1);
    const lv = ld0 + (pixel - r0) / (r1 - r0) * (ld1 - ld0);
    return Math.pow(10, lv);
  }
  ticks(_count) {
    const [d0, d1] = this._domain;
    const start = Math.floor(Math.log10(d0));
    const end = Math.ceil(Math.log10(d1));
    const out = [];
    for (let p = start; p <= end; p++) {
      const v = Math.pow(10, p);
      if (v >= d0 && v <= d1) out.push(v);
    }
    return out;
  }
};
var TimeScale = class extends LinearScale {
  ticks(count) {
    return niceTimeTicks(this._domain[0], this._domain[1], count);
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
function niceTimeTicks(t0, t1, count) {
  if (t1 === t0) return [t0];
  const ms = t1 - t0;
  const target = ms / Math.max(1, count);
  const buckets = [
    1e3,
    // 1s
    5e3,
    15e3,
    3e4,
    6e4,
    // 1m
    5 * 6e4,
    15 * 6e4,
    30 * 6e4,
    60 * 6e4,
    // 1h
    3 * 60 * 6e4,
    6 * 60 * 6e4,
    12 * 60 * 6e4,
    24 * 60 * 6e4,
    // 1d
    7 * 24 * 60 * 6e4,
    30 * 24 * 60 * 6e4,
    365 * 24 * 60 * 6e4
  ];
  let step = buckets[buckets.length - 1];
  for (const b of buckets) {
    if (b >= target) {
      step = b;
      break;
    }
  }
  const start = Math.ceil(t0 / step) * step;
  const out = [];
  for (let v = start; v <= t1; v += step) out.push(v);
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

// src/core/HitTester.ts
var QUADTREE_THRESHOLD = 1e3;
var HitTester = class {
  entries = [];
  tree = null;
  dirty = false;
  add(shape, payload) {
    this.entries.push({ shape, payload });
    this.dirty = true;
  }
  clear() {
    this.entries = [];
    this.tree = null;
    this.dirty = false;
  }
  get size() {
    return this.entries.length;
  }
  /**
   * Returns the topmost entry whose shape contains the point (with
   * `tolerance` pixels of slop on points / polylines), or null.
   */
  pick(x, y, tolerance = 4) {
    this.ensureIndex();
    let candidates;
    if (this.tree) {
      candidates = this.tree.queryAabb(x - tolerance, y - tolerance, x + tolerance, y + tolerance);
    } else {
      candidates = this.entries;
    }
    let result = null;
    for (const e of candidates) {
      if (containsShape(e.shape, x, y, tolerance)) result = e;
    }
    return result;
  }
  /** Force-rebuild the index (mostly for tests). */
  ensureIndex() {
    if (!this.dirty) return;
    if (this.entries.length >= QUADTREE_THRESHOLD) {
      this.tree = buildQuadtree(this.entries);
    } else {
      this.tree = null;
    }
    this.dirty = false;
  }
};
function containsShape(s, x, y, tol) {
  switch (s.kind) {
    case "point": {
      const dx = x - s.x;
      const dy = y - s.y;
      return dx * dx + dy * dy <= tol * tol;
    }
    case "circle": {
      const dx = x - s.x;
      const dy = y - s.y;
      const r = s.r + tol;
      return dx * dx + dy * dy <= r * r;
    }
    case "rect": {
      return x >= s.x - tol && x <= s.x + s.w + tol && y >= s.y - tol && y <= s.y + s.h + tol;
    }
    case "polyline": {
      const w = (s.lineWidth ?? 1) / 2 + tol;
      const pts = s.points;
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= w) {
          return true;
        }
      }
      return false;
    }
  }
}
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 === 0 ? 0 : (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}
function shapeAabb(s) {
  switch (s.kind) {
    case "point":
      return { minX: s.x, minY: s.y, maxX: s.x, maxY: s.y };
    case "circle":
      return { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r };
    case "rect":
      return { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h };
    case "polyline": {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { minX, minY, maxX, maxY };
    }
  }
}
var QT_CAPACITY = 16;
var QT_MAX_DEPTH = 8;
var Quadtree = class _Quadtree {
  nodes = [];
  bounds;
  children = null;
  depth;
  constructor(bounds, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }
  insert(e) {
    if (this.children) {
      const ix = this.childIndex(e.aabb);
      if (ix >= 0) {
        this.children[ix].insert(e);
        return;
      }
      this.nodes.push(e);
      return;
    }
    this.nodes.push(e);
    if (this.nodes.length > QT_CAPACITY && this.depth < QT_MAX_DEPTH) {
      this.split();
    }
  }
  split() {
    const { minX, minY, maxX, maxY } = this.bounds;
    const mx = (minX + maxX) / 2;
    const my = (minY + maxY) / 2;
    this.children = [
      new _Quadtree({ minX, minY, maxX: mx, maxY: my }, this.depth + 1),
      new _Quadtree({ minX: mx, minY, maxX, maxY: my }, this.depth + 1),
      new _Quadtree({ minX, minY: my, maxX: mx, maxY }, this.depth + 1),
      new _Quadtree({ minX: mx, minY: my, maxX, maxY }, this.depth + 1)
    ];
    const old = this.nodes;
    this.nodes = [];
    for (const n of old) {
      const ix = this.childIndex(n.aabb);
      if (ix >= 0) this.children[ix].insert(n);
      else this.nodes.push(n);
    }
  }
  childIndex(a) {
    if (!this.children) return -1;
    for (let i = 0; i < 4; i++) {
      const c = this.children[i].bounds;
      if (a.minX >= c.minX && a.maxX <= c.maxX && a.minY >= c.minY && a.maxY <= c.maxY) return i;
    }
    return -1;
  }
  queryAabb(qMinX, qMinY, qMaxX, qMaxY) {
    if (qMaxX < this.bounds.minX || qMinX > this.bounds.maxX || qMaxY < this.bounds.minY || qMinY > this.bounds.maxY) {
      return [];
    }
    const out = [];
    for (const n of this.nodes) {
      if (n.aabb.maxX >= qMinX && n.aabb.minX <= qMaxX && n.aabb.maxY >= qMinY && n.aabb.minY <= qMaxY) {
        out.push(n.entry);
      }
    }
    if (this.children) {
      for (const c of this.children) {
        const sub = c.queryAabb(qMinX, qMinY, qMaxX, qMaxY);
        if (sub.length) out.push(...sub);
      }
    }
    return out;
  }
};
function buildQuadtree(entries) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entries) {
    const a = shapeAabb(e.shape);
    if (a.minX < minX) minX = a.minX;
    if (a.minY < minY) minY = a.minY;
    if (a.maxX > maxX) maxX = a.maxX;
    if (a.maxY > maxY) maxY = a.maxY;
  }
  const pad = 1;
  const tree = new Quadtree({
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad
  });
  for (const e of entries) {
    tree.insert({ aabb: shapeAabb(e.shape), entry: e });
  }
  return tree;
}

exports.CanvasContext = CanvasContext;
exports.EventBus = EventBus;
exports.HitTester = HitTester;
exports.LinearScale = LinearScale;
exports.LogScale = LogScale;
exports.TimeScale = TimeScale;
exports.Viewport = Viewport;
exports.clearRect = clearRect;
exports.createLinearGradient = createLinearGradient;
exports.drawCircle = drawCircle;
exports.drawLine = drawLine;
exports.drawPath = drawPath;
exports.drawPolyline = drawPolyline;
exports.drawRect = drawRect;
exports.drawText = drawText;
exports.niceLinearTicks = niceLinearTicks;
exports.niceTimeTicks = niceTimeTicks;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map