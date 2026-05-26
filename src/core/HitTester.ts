/**
 * HitTester
 *
 * Spatial index of drawn shapes with attached payloads. Used by Chart /
 * overlays to translate a pointer event into the topmost interactive object.
 *
 * - Internally just an array (linear scan) until size crosses a threshold;
 *   at that point it lazily builds a quadtree. Saves us from paying for
 *   the quadtree on small charts.
 * - Insertion order is preserved; `pick()` returns the LAST matching entry
 *   (= topmost in draw order).
 *
 * Coordinates here are PIXEL space — call after scaling.
 */

export type HitShape =
  | { kind: 'point'; x: number; y: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'polyline'; points: ReadonlyArray<{ x: number; y: number }>; lineWidth?: number };

export interface HitEntry<T = unknown> {
  shape: HitShape;
  payload: T;
}

const QUADTREE_THRESHOLD = 1000;

export class HitTester<T = unknown> {
  private entries: HitEntry<T>[] = [];
  private tree: Quadtree<T> | null = null;
  private dirty = false;

  add(shape: HitShape, payload: T): void {
    this.entries.push({ shape, payload });
    this.dirty = true;
  }

  clear(): void {
    this.entries = [];
    this.tree = null;
    this.dirty = false;
  }

  get size(): number {
    return this.entries.length;
  }

  /**
   * Returns the topmost entry whose shape contains the point (with
   * `tolerance` pixels of slop on points / polylines), or null.
   */
  pick(x: number, y: number, tolerance = 4): HitEntry<T> | null {
    this.ensureIndex();

    // candidate set: quadtree query or full array
    let candidates: HitEntry<T>[];
    if (this.tree) {
      candidates = this.tree.queryAabb(x - tolerance, y - tolerance, x + tolerance, y + tolerance);
    } else {
      candidates = this.entries;
    }

    // iterate in draw order; remember the last hit (= topmost)
    let result: HitEntry<T> | null = null;
    for (const e of candidates) {
      if (containsShape(e.shape, x, y, tolerance)) result = e;
    }
    return result;
  }

  /** Force-rebuild the index (mostly for tests). */
  ensureIndex(): void {
    if (!this.dirty) return;
    if (this.entries.length >= QUADTREE_THRESHOLD) {
      this.tree = buildQuadtree(this.entries);
    } else {
      this.tree = null;
    }
    this.dirty = false;
  }
}

// ----------------- geometry -----------------

function containsShape(s: HitShape, x: number, y: number, tol: number): boolean {
  switch (s.kind) {
    case 'point': {
      const dx = x - s.x;
      const dy = y - s.y;
      return dx * dx + dy * dy <= tol * tol;
    }
    case 'circle': {
      const dx = x - s.x;
      const dy = y - s.y;
      const r = s.r + tol;
      return dx * dx + dy * dy <= r * r;
    }
    case 'rect': {
      return x >= s.x - tol && x <= s.x + s.w + tol && y >= s.y - tol && y <= s.y + s.h + tol;
    }
    case 'polyline': {
      const w = (s.lineWidth ?? 1) / 2 + tol;
      const pts = s.points;
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y) <= w) {
          return true;
        }
      }
      return false;
    }
  }
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
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

// ----------------- quadtree -----------------

interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeAabb(s: HitShape): Aabb {
  switch (s.kind) {
    case 'point':
      return { minX: s.x, minY: s.y, maxX: s.x, maxY: s.y };
    case 'circle':
      return { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r };
    case 'rect':
      return { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h };
    case 'polyline': {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
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

interface QtIndexEntry<T> {
  aabb: Aabb;
  entry: HitEntry<T>;
}

const QT_CAPACITY = 16;
const QT_MAX_DEPTH = 8;

class Quadtree<T> {
  private nodes: QtIndexEntry<T>[] = [];
  private bounds: Aabb;
  private children: Quadtree<T>[] | null = null;
  private depth: number;

  constructor(bounds: Aabb, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }

  insert(e: QtIndexEntry<T>): void {
    if (this.children) {
      const ix = this.childIndex(e.aabb);
      if (ix >= 0) {
        this.children[ix]!.insert(e);
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

  private split(): void {
    const { minX, minY, maxX, maxY } = this.bounds;
    const mx = (minX + maxX) / 2;
    const my = (minY + maxY) / 2;
    this.children = [
      new Quadtree({ minX, minY, maxX: mx, maxY: my }, this.depth + 1),
      new Quadtree({ minX: mx, minY, maxX, maxY: my }, this.depth + 1),
      new Quadtree({ minX, minY: my, maxX: mx, maxY }, this.depth + 1),
      new Quadtree({ minX: mx, minY: my, maxX, maxY }, this.depth + 1),
    ];
    const old = this.nodes;
    this.nodes = [];
    for (const n of old) {
      const ix = this.childIndex(n.aabb);
      if (ix >= 0) this.children[ix]!.insert(n);
      else this.nodes.push(n);
    }
  }

  private childIndex(a: Aabb): number {
    if (!this.children) return -1;
    for (let i = 0; i < 4; i++) {
      const c = this.children[i]!.bounds;
      if (a.minX >= c.minX && a.maxX <= c.maxX && a.minY >= c.minY && a.maxY <= c.maxY) return i;
    }
    return -1;
  }

  queryAabb(qMinX: number, qMinY: number, qMaxX: number, qMaxY: number): HitEntry<T>[] {
    if (
      qMaxX < this.bounds.minX ||
      qMinX > this.bounds.maxX ||
      qMaxY < this.bounds.minY ||
      qMinY > this.bounds.maxY
    ) {
      return [];
    }
    const out: HitEntry<T>[] = [];
    for (const n of this.nodes) {
      if (
        n.aabb.maxX >= qMinX &&
        n.aabb.minX <= qMaxX &&
        n.aabb.maxY >= qMinY &&
        n.aabb.minY <= qMaxY
      ) {
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
}

function buildQuadtree<T>(entries: HitEntry<T>[]): Quadtree<T> {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const e of entries) {
    const a = shapeAabb(e.shape);
    if (a.minX < minX) minX = a.minX;
    if (a.minY < minY) minY = a.minY;
    if (a.maxX > maxX) maxX = a.maxX;
    if (a.maxY > maxY) maxY = a.maxY;
  }
  // pad a hair so points-on-edges aren't lost
  const pad = 1;
  const tree = new Quadtree<T>({
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  });
  for (const e of entries) {
    tree.insert({ aabb: shapeAabb(e.shape), entry: e });
  }
  return tree;
}
