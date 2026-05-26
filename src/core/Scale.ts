/**
 * Scale
 *
 * Maps a data-space `domain` ([d0, d1]) to a pixel-space `range` ([r0, r1]).
 * Three flavours:
 *
 *   LinearScale  — straight affine mapping
 *   LogScale     — log10; domain must be > 0
 *   TimeScale    — same math as linear, but tick() emits Date-aware steps
 *
 * Scales are immutable except for `setDomain`/`setRange`. The math is the
 * point of unit tests.
 */

export type Domain = readonly [number, number];
export type Range = readonly [number, number];

export interface Scale {
  setDomain(domain: Domain): void;
  setRange(range: Range): void;
  domain(): Domain;
  range(): Range;
  /** data → pixel */
  scale(value: number): number;
  /** pixel → data */
  invert(pixel: number): number;
  /** Suggested tick positions in data space. */
  ticks(count: number): number[];
}

abstract class BaseScale implements Scale {
  protected _domain: Domain;
  protected _range: Range;

  constructor(domain: Domain, range: Range) {
    this._domain = domain;
    this._range = range;
  }

  setDomain(domain: Domain): void {
    this._domain = domain;
  }

  setRange(range: Range): void {
    this._range = range;
  }

  domain(): Domain {
    return this._domain;
  }

  range(): Range {
    return this._range;
  }

  abstract scale(value: number): number;
  abstract invert(pixel: number): number;
  abstract ticks(count: number): number[];
}

export class LinearScale extends BaseScale {
  scale(value: number): number {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (d1 === d0) return r0;
    return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
  }

  invert(pixel: number): number {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (r1 === r0) return d0;
    return d0 + ((pixel - r0) / (r1 - r0)) * (d1 - d0);
  }

  ticks(count: number): number[] {
    return niceLinearTicks(this._domain[0], this._domain[1], count);
  }
}

export class LogScale extends BaseScale {
  constructor(domain: Domain, range: Range) {
    super(domain, range);
    if (domain[0] <= 0 || domain[1] <= 0) {
      throw new Error('LogScale: domain values must be > 0');
    }
  }

  override setDomain(domain: Domain): void {
    if (domain[0] <= 0 || domain[1] <= 0) {
      throw new Error('LogScale: domain values must be > 0');
    }
    super.setDomain(domain);
  }

  scale(value: number): number {
    if (value <= 0) return this._range[0];
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    const ld0 = Math.log10(d0);
    const ld1 = Math.log10(d1);
    if (ld1 === ld0) return r0;
    return r0 + ((Math.log10(value) - ld0) / (ld1 - ld0)) * (r1 - r0);
  }

  invert(pixel: number): number {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (r1 === r0) return d0;
    const ld0 = Math.log10(d0);
    const ld1 = Math.log10(d1);
    const lv = ld0 + ((pixel - r0) / (r1 - r0)) * (ld1 - ld0);
    return Math.pow(10, lv);
  }

  ticks(_count: number): number[] {
    const [d0, d1] = this._domain;
    const start = Math.floor(Math.log10(d0));
    const end = Math.ceil(Math.log10(d1));
    const out: number[] = [];
    for (let p = start; p <= end; p++) {
      const v = Math.pow(10, p);
      if (v >= d0 && v <= d1) out.push(v);
    }
    return out;
  }
}

/**
 * TimeScale — domain is in ms-since-epoch. Otherwise identical to LinearScale.
 */
export class TimeScale extends LinearScale {
  override ticks(count: number): number[] {
    return niceTimeTicks(this._domain[0], this._domain[1], count);
  }
}

// ---------- tick helpers (kept internal; exported for unit testing) ----------

export function niceLinearTicks(d0: number, d1: number, count: number): number[] {
  if (d1 === d0) return [d0];
  const span = d1 - d0;
  const step = niceStep(span / Math.max(1, count));
  const start = Math.ceil(d0 / step) * step;
  const out: number[] = [];
  for (let v = start; v <= d1 + step * 1e-9; v += step) {
    out.push(roundToStep(v, step));
  }
  return out;
}

export function niceTimeTicks(t0: number, t1: number, count: number): number[] {
  if (t1 === t0) return [t0];
  const ms = t1 - t0;
  const target = ms / Math.max(1, count);
  const buckets = [
    1_000, // 1s
    5_000,
    15_000,
    30_000,
    60_000, // 1m
    5 * 60_000,
    15 * 60_000,
    30 * 60_000,
    60 * 60_000, // 1h
    3 * 60 * 60_000,
    6 * 60 * 60_000,
    12 * 60 * 60_000,
    24 * 60 * 60_000, // 1d
    7 * 24 * 60 * 60_000,
    30 * 24 * 60 * 60_000,
    365 * 24 * 60 * 60_000,
  ];
  let step = buckets[buckets.length - 1]!;
  for (const b of buckets) {
    if (b >= target) {
      step = b;
      break;
    }
  }
  const start = Math.ceil(t0 / step) * step;
  const out: number[] = [];
  for (let v = start; v <= t1; v += step) out.push(v);
  return out;
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const f = rough / Math.pow(10, exp);
  let nice: number;
  if (f < 1.5) nice = 1;
  else if (f < 3) nice = 2;
  else if (f < 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

function roundToStep(v: number, step: number): number {
  // avoid floating-point fuzz on tick labels
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}
