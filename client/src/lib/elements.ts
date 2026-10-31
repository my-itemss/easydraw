import { nanoid } from "nanoid";
import type { El, ElType, Pt, Style } from "../types";
import { dist, distToSegment, pointInPolygon, rand, rotatePoint, segmentIntersect } from "./math";
import { measureText } from "./text";

export const newId = () => nanoid(12);
export const isLinear = (el: El) => el.type === "arrow" || el.type === "line";
export const isPointsEl = (el: El) => isLinear(el) || el.type === "freedraw";
export const isShape = (el: El) => el.type === "rectangle" || el.type === "diamond" || el.type === "ellipse";
export const BINDABLE: ElType[] = ["rectangle", "diamond", "ellipse", "text", "image"];

export function createElement(type: ElType, x: number, y: number, s: Style, extra: Partial<El> = {}): El {
  const el: El = {
    id: newId(), type, x, y, width: 0, height: 0, angle: 0,
    strokeColor: s.strokeColor, backgroundColor: s.backgroundColor, fillStyle: s.fillStyle,
    strokeWidth: s.strokeWidth, strokeStyle: s.strokeStyle, roughness: s.roughness, opacity: s.opacity,
    rounded: s.rounded, seed: rand(), version: 1, versionNonce: rand(), isDeleted: false, groupIds: [], locked: false,
  };
  if (type === "arrow" || type === "line") {
    el.points = [[0, 0], [0, 0]];
    el.startArrowhead = type === "arrow" ? s.startArrowhead : "none";
    el.endArrowhead = type === "arrow" ? s.endArrowhead : "none";
    el.startBinding = null;
    el.endBinding = null;
  }
  if (type === "freedraw") { el.points = [[0, 0]]; el.backgroundColor = "transparent"; }
  if (type === "text") {
    el.text = ""; el.fontSize = s.fontSize; el.fontFamily = s.fontFamily; el.textAlign = s.textAlign;
    el.backgroundColor = "transparent";
  }
  if (isShapeType(type)) { el.fontSize = s.fontSize; el.fontFamily = s.fontFamily; el.textAlign = "center"; }
  return { ...el, ...extra };
}
const isShapeType = (t: ElType) => t === "rectangle" || t === "diamond" || t === "ellipse";

export const mutate = (el: El, patch: Partial<El>): El => ({ ...el, ...patch, version: el.version + 1, versionNonce: rand() });

export const center = (el: El): Pt => [el.x + el.width / 2, el.y + el.height / 2];

export function corners(el: El): Pt[] {
  const c = center(el);
  const cs: Pt[] = [[el.x, el.y], [el.x + el.width, el.y], [el.x + el.width, el.y + el.height], [el.x, el.y + el.height]];
  return el.angle ? cs.map((p) => rotatePoint(p, c, el.angle)) : cs;
}

export type Bounds = [number, number, number, number];

export function getBounds(el: El): Bounds {
  const cs = corners(el);
  const xs = cs.map((p) => p[0]), ys = cs.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function commonBounds(els: El[]): Bounds | null {
  if (!els.length) return null;
  let b: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const el of els) {
    const e = getBounds(el);
    b = [Math.min(b[0], e[0]), Math.min(b[1], e[1]), Math.max(b[2], e[2]), Math.max(b[3], e[3])];
  }
  return b;
}

/** Absolute (rotated) positions of a points element. */
export function absPoints(el: El): Pt[] {
  const c = center(el);
  return (el.points ?? []).map((p) => rotatePoint([p[0] + el.x, p[1] + el.y], c, el.angle));
}

/** Rebuild x/y/width/height/points from absolute points (flattens rotation). */
export function setPointsAbs(el: El, abs: Pt[]): El {
  const xs = abs.map((p) => p[0]), ys = abs.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return mutate(el, {
    x: minX, y: minY, angle: 0,
    width: Math.max(...xs) - minX, height: Math.max(...ys) - minY,
    points: abs.map((p) => [p[0] - minX, p[1] - minY] as Pt),
  });
}

export function refreshText(el: El): El {
  const m = measureText(el.text ?? "", el.fontSize ?? 20, el.fontFamily ?? "hand");
  return { ...el, width: m.width, height: m.height };
}

/* ---------------- shape outline & hit testing ---------------- */

export function localOutline(el: El): Pt[] {
  const { x, y, width: w, height: h } = el;
  if (el.type === "diamond") return [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
  if (el.type === "ellipse") {
    const pts: Pt[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push([x + w / 2 + (Math.cos(a) * w) / 2, y + h / 2 + (Math.sin(a) * h) / 2]);
    }
    return pts;
  }
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

const nearPolygonEdge = (p: Pt, poly: Pt[], tol: number) => {
  for (let i = 0; i < poly.length; i++) if (distToSegment(p, poly[i], poly[(i + 1) % poly.length]) <= tol) return true;
  return false;
};

export function hitElement(el: El, pt: Pt, zoom: number): boolean {
  const tol = Math.max(7 / zoom, el.strokeWidth / 2 + 2);
  const p = el.angle ? rotatePoint(pt, center(el), -el.angle) : pt;
  switch (el.type) {
    case "text":
    case "image":
      return p[0] >= el.x - tol / 2 && p[0] <= el.x + el.width + tol / 2 && p[1] >= el.y - tol / 2 && p[1] <= el.y + el.height + tol / 2;
    case "arrow":
    case "line":
    case "freedraw": {
      const pts = (el.points ?? []).map((q) => [q[0] + el.x, q[1] + el.y] as Pt);
      if (pts.length === 1) return dist(p, pts[0]) <= tol;
      const t = el.type === "freedraw" ? tol * 0.9 : tol;
      for (let i = 0; i < pts.length - 1; i++) if (distToSegment(p, pts[i], pts[i + 1]) <= t) return true;
      return false;
    }
    default: {
      const outline = localOutline(el);
      const filled = el.backgroundColor !== "transparent";
      if (filled && pointInPolygon(p, outline)) return true;
      return nearPolygonEdge(p, outline, tol);
    }
  }
}

export function hitTest(elements: El[], pt: Pt, zoom: number, filter?: (e: El) => boolean): El | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted || (filter && !filter(el))) continue;
    if (hitElement(el, pt, zoom)) return el;
  }
  return null;
}

/** Topmost rectangle/diamond/ellipse whose interior contains the point (for double-click labels). */
export function containerAt(elements: El[], pt: Pt): El | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted || !isShape(el)) continue;
    const p = el.angle ? rotatePoint(pt, center(el), -el.angle) : pt;
    if (pointInPolygon(p, localOutline(el))) return el;
  }
  return null;
}

/* ---------------- arrow binding ---------------- */

export function bindableAt(elements: El[], pt: Pt, zoom: number, exclude?: string): El | null {
  const pad = 10 / zoom;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted || el.id === exclude || !BINDABLE.includes(el.type)) continue;
    const p = el.angle ? rotatePoint(pt, center(el), -el.angle) : pt;
    if (p[0] >= el.x - pad && p[0] <= el.x + el.width + pad && p[1] >= el.y - pad && p[1] <= el.y + el.height + pad) {
      if (el.type === "ellipse" || el.type === "diamond") {
        // tighter test for non-rect shapes
        const o = localOutline(el);
        if (pointInPolygon(p, o) || nearPolygonEdge(p, o, pad)) return el;
        continue;
      }
      return el;
    }
  }
  return null;
}

/** Point on shape outline facing `from` (ray from `from` towards the shape centre). */
export function bindPoint(shape: El, from: Pt, gap = 5): Pt | null {
  const c = center(shape);
  const outline = localOutline(shape).map((p) => rotatePoint(p, c, shape.angle));
  let best: number | null = null;
  for (let i = 0; i < outline.length; i++) {
    const t = segmentIntersect(from, c, outline[i], outline[(i + 1) % outline.length]);
    if (t !== null && (best === null || t < best)) best = t;
  }
  if (best === null) return null;
  const d = dist(from, c) || 1;
  const t = Math.max(0, best - gap / d);
  return [from[0] + (c[0] - from[0]) * t, from[1] + (c[1] - from[1]) * t];
}

export function recomputeArrow(arrow: El, byId: Map<string, El>): El {
  const sEl = arrow.startBinding ? byId.get(arrow.startBinding) : undefined;
  const eEl = arrow.endBinding ? byId.get(arrow.endBinding) : undefined;
  const s = sEl && !sEl.isDeleted ? sEl : undefined;
  const e = eEl && !eEl.isDeleted ? eEl : undefined;
  if (!s && !e) return arrow;
  const abs = absPoints(arrow);
  const n = abs.length;
  const sAim = n > 2 ? abs[1] : e ? center(e) : abs[n - 1];
  const eAim = n > 2 ? abs[n - 2] : s ? center(s) : abs[0];
  const next = abs.slice();
  if (s) { const b = bindPoint(s, sAim); if (b) next[0] = b; }
  if (e) { const b = bindPoint(e, eAim); if (b) next[n - 1] = b; }
  const changed = next.some((p, i) => Math.abs(p[0] - abs[i][0]) > 0.01 || Math.abs(p[1] - abs[i][1]) > 0.01);
  return changed ? setPointsAbs(arrow, next) : arrow;
}

/** After `movedIds` changed, refresh arrows bound to them. Returns a new array only if something changed. */
export function refreshBindings(elements: El[], movedIds: Set<string>): El[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  let changed = false;
  const out = elements.map((el) => {
    if (el.type !== "arrow" || el.isDeleted) return el;
    if (!((el.startBinding && movedIds.has(el.startBinding)) || (el.endBinding && movedIds.has(el.endBinding)))) return el;
    const n = recomputeArrow(el, byId);
    if (n !== el) { changed = true; byId.set(n.id, n); }
    return n;
  });
  return changed ? out : elements;
}

/* ---------------- groups ---------------- */

export const outerGroup = (el: El) => (el.groupIds.length ? el.groupIds[el.groupIds.length - 1] : null);

export function expandGroups(elements: El[], ids: Iterable<string>): Set<string> {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const groups = new Set<string>();
  const out = new Set<string>();
  for (const id of ids) {
    const el = byId.get(id);
    if (!el || el.isDeleted) continue;
    out.add(id);
    const g = outerGroup(el);
    if (g) groups.add(g);
  }
  if (groups.size) for (const el of elements) if (!el.isDeleted && el.groupIds.some((g) => groups.has(g)) && groups.has(outerGroup(el)!)) out.add(el.id);
  return out;
}
