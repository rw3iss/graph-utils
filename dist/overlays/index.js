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
function computeBands(data, window, k) {
  const n = data.length;
  const upper = new Array(n).fill(NaN);
  const mid = new Array(n).fill(NaN);
  const lower = new Array(n).fill(NaN);
  if (window <= 0 || n < window) return { upper, mid, lower };
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i].v;
    sum += v;
    sumSq += v * v;
    if (i >= window) {
      const out = data[i - window].v;
      sum -= out;
      sumSq -= out * out;
    }
    if (i >= window - 1) {
      const m = sum / window;
      const variance = Math.max(0, sumSq / window - m * m);
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

export { BollingerBands, Crosshair, OrderMarkers, OverlayBase, PriceLine, SignalArrows, ThresholdBand, VWAP, ZoneBoxes, computeBands, computeVWAP };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map