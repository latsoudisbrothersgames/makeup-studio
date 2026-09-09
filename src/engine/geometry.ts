import type { Poly, Pt, RegionId } from '../types/face';

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function polyBBox(poly: Poly): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function expandBBox(b: BBox, pad: number, limit = 512): BBox {
  const x = Math.max(0, Math.floor(b.x - pad));
  const y = Math.max(0, Math.floor(b.y - pad));
  const x2 = Math.min(limit, Math.ceil(b.x + b.w + pad));
  const y2 = Math.min(limit, Math.ceil(b.y + b.h + pad));
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
}

export function unionBBox(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: x2 - x, h: y2 - y };
}

export function centroid(poly: Poly): Pt {
  if (poly.length === 0) return [0, 0];
  let sx = 0, sy = 0;
  for (const [x, y] of poly) { sx += x; sy += y; }
  return [sx / poly.length, sy / poly.length];
}

/** Ray casting. */
export function pointInPolygon([px, py]: Pt, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distToPolyline(p: Pt, line: Poly): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    best = Math.min(best, distToSegment(p, line[i], line[i + 1]));
  }
  return line.length === 1 ? Math.hypot(p[0] - line[0][0], p[1] - line[0][1]) : best;
}

export function distToSegment([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function tracePoly(ctx: CanvasRenderingContext2D, poly: Poly, ox = 0, oy = 0): void {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x - ox, y - oy) : ctx.lineTo(x - ox, y - oy)));
  ctx.closePath();
}

export function tracePolyline(ctx: CanvasRenderingContext2D, line: Poly, ox = 0, oy = 0): void {
  ctx.beginPath();
  line.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x - ox, y - oy) : ctx.lineTo(x - ox, y - oy)));
}

export function polyPath(poly: Poly): Path2D {
  const p = new Path2D();
  poly.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  return p;
}

export function polylinePath(line: Poly): Path2D {
  const p = new Path2D();
  line.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  return p;
}

/** Δείγματα κατά μήκος πολυγραμμής με κάθετη διεύθυνση (για βλεφαρίδες). */
export function samplePolyline(line: Poly, step: number): { p: Pt; n: Pt }[] {
  const out: { p: Pt; n: Pt }[] = [];
  let carry = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const nx = -dy / len, ny = dx / len;
    let d = carry;
    while (d <= len) {
      const t = d / len;
      out.push({ p: [ax + dx * t, ay + dy * t], n: [nx, ny] });
      d += step;
    }
    carry = d - len;
  }
  return out;
}

export function mirrorPoly(poly: Poly, axisX: number): Poly {
  return poly.map(([x, y]) => [Math.round(2 * axisX - x), y]);
}

/** Ζεύγη αριστερά ↔ δεξιά. */
export const MIRROR: Partial<Record<RegionId, RegionId>> = {
  cheekL: 'cheekR', cheekR: 'cheekL',
  cheekboneL: 'cheekboneR', cheekboneR: 'cheekboneL',
  lidL: 'lidR', lidR: 'lidL',
  lashL: 'lashR', lashR: 'lashL',
  underEyeL: 'underEyeR', underEyeR: 'underEyeL',
  browL: 'browR', browR: 'browL',
  eyeHoleL: 'eyeHoleR', eyeHoleR: 'eyeHoleL',
  accL: 'accR', accR: 'accL',
};

/** Ντετερμινιστικός PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Έλλειψη ως πολύγωνο (για placeholder πρόσωπα και προεπιλεγμένες περιοχές). */
export function ellipsePoly(cx: number, cy: number, rx: number, ry: number, n = 24, rot = 0): Poly {
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([
      Math.round(cx + x * Math.cos(rot) - y * Math.sin(rot)),
      Math.round(cy + x * Math.sin(rot) + y * Math.cos(rot)),
    ]);
  }
  return out;
}
