import type { Pt } from "../types";

export const rotatePoint = (p: Pt, c: Pt, a: number): Pt => {
  if (!a) return p;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = p[0] - c[0], dy = p[1] - c[1];
  return [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
};

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const distToSegment = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
};

export const pointInPolygon = (p: Pt, poly: Pt[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** intersection of segment p->q with segment a->b, returns t along p->q or null */
export const segmentIntersect = (p: Pt, q: Pt, a: Pt, b: Pt): number | null => {
  const r: Pt = [q[0] - p[0], q[1] - p[1]];
  const s: Pt = [b[0] - a[0], b[1] - a[1]];
  const d = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(d) < 1e-9) return null;
  const t = ((a[0] - p[0]) * s[1] - (a[1] - p[1]) * s[0]) / d;
  const u = ((a[0] - p[0]) * r[1] - (a[1] - p[1]) * r[0]) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const snap = (v: number, step: number) => Math.round(v / step) * step;
export const rand = () => Math.floor(Math.random() * 2 ** 31);
