// Edge routing: port selection, spreading of parallel ports, and smooth (Hermite → cubic Bézier) paths.
import type { Pt } from "./util";
import { r1 } from "./util";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Side = "top" | "bottom" | "left" | "right";

export interface RouteReq {
  fromKey: string;
  toKey: string;
  from: Box;
  to: Box;
  mids: Pt[];
  /** shapes whose outline is not the bounding box only get centred ports */
  fromCentered?: boolean;
  toCentered?: boolean;
  fromY?: number; // absolute y anchor (ERD attribute rows) when the side is left/right
  toY?: number;
}

export interface Routed {
  d: string;
  start: Pt;
  end: Pt;
  startSide: Side;
  endSide: Side;
  mid: Pt;
  points: Pt[]; // all anchor points (for bounds)
  loop: boolean;
}

const centre = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function sideToward(b: Box, t: Pt): Side {
  const c = centre(b);
  const dx = (t.x - c.x) / (b.w / 2 || 1);
  const dy = (t.y - c.y) / (b.h / 2 || 1);
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? "bottom" : "top";
  return dx >= 0 ? "right" : "left";
}

const NORMAL: Record<Side, Pt> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function portAt(b: Box, side: Side, f: number): Pt {
  switch (side) {
    case "top":
      return { x: b.x + b.w * f, y: b.y };
    case "bottom":
      return { x: b.x + b.w * f, y: b.y + b.h };
    case "left":
      return { x: b.x, y: b.y + b.h * f };
    default:
      return { x: b.x + b.w, y: b.y + b.h * f };
  }
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function routeEdges(reqs: RouteReq[]): Routed[] {
  type End = { req: number; end: 0 | 1; side: Side; toward: Pt; key: string; centered: boolean; box: Box };
  const ends: End[] = [];
  const results: (Routed | null)[] = reqs.map(() => null);

  reqs.forEach((r, i) => {
    if (r.fromKey === r.toKey) {
      const b = r.from;
      const p0 = { x: b.x + b.w, y: b.y + b.h * 0.35 };
      const p1 = { x: b.x + b.w, y: b.y + b.h * 0.7 };
      const d = `M${r1(p0.x)} ${r1(p0.y)}C${r1(p0.x + 46)} ${r1(p0.y - 14)} ${r1(p1.x + 46)} ${r1(p1.y + 14)} ${r1(p1.x)} ${r1(p1.y)}`;
      results[i] = {
        d,
        start: p0,
        end: p1,
        startSide: "right",
        endSide: "right",
        mid: { x: b.x + b.w + 40, y: b.y + b.h * 0.52 },
        points: [p0, p1, { x: b.x + b.w + 46, y: b.y + b.h / 2 }],
        loop: true,
      };
      return;
    }
    const first = r.mids[0] ?? centre(r.to);
    const last = r.mids[r.mids.length - 1] ?? centre(r.from);
    ends.push({ req: i, end: 0, side: sideToward(r.from, first), toward: first, key: r.fromKey, centered: !!r.fromCentered, box: r.from });
    ends.push({ req: i, end: 1, side: sideToward(r.to, last), toward: last, key: r.toKey, centered: !!r.toCentered, box: r.to });
  });

  // spread ports sharing the same box side
  const groups = new Map<string, End[]>();
  for (const e of ends) {
    const k = `${e.key}#${e.side}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)?.push(e);
  }
  const ports = new Map<string, Pt>();
  for (const g of groups.values()) {
    const horizontalSide = g[0]?.side === "top" || g[0]?.side === "bottom";
    g.sort((a, b) => (horizontalSide ? a.toward.x - b.toward.x : a.toward.y - b.toward.y));
    g.forEach((e, idx) => {
      const r = reqs[e.req] as RouteReq;
      const n = g.length;
      let f = n === 1 || e.centered ? 0.5 : 0.5 + ((idx + 1) / (n + 1) - 0.5) * 0.8;
      let p = portAt(e.box, e.side, f);
      const fixedY = e.end === 0 ? r.fromY : r.toY;
      if (fixedY !== undefined && (e.side === "left" || e.side === "right")) {
        f = (fixedY - e.box.y) / (e.box.h || 1);
        p = portAt(e.box, e.side, Math.min(0.95, Math.max(0.05, f)));
      }
      ports.set(`${e.req}:${e.end}`, p);
    });
  }

  const sideOf = new Map<string, Side>();
  for (const e of ends) sideOf.set(`${e.req}:${e.end}`, e.side);

  reqs.forEach((r, i) => {
    if (results[i]) return;
    const p0 = ports.get(`${i}:0`) as Pt;
    const pn = ports.get(`${i}:1`) as Pt;
    const s0 = sideOf.get(`${i}:0`) as Side;
    const sn = sideOf.get(`${i}:1`) as Side;
    const pts = [p0, ...r.mids, pn];
    const tan: Pt[] = pts.map((p, k) => {
      if (k === 0) {
        const L = Math.max(30, dist(p, pts[1] as Pt) * 0.9);
        return { x: NORMAL[s0].x * L, y: NORMAL[s0].y * L };
      }
      if (k === pts.length - 1) {
        const L = Math.max(30, dist(p, pts[k - 1] as Pt) * 0.9);
        return { x: -NORMAL[sn].x * L, y: -NORMAL[sn].y * L };
      }
      const a = pts[k - 1] as Pt;
      const b = pts[k + 1] as Pt;
      return { x: (b.x - a.x) * 0.5, y: (b.y - a.y) * 0.5 };
    });
    let d = `M${r1(p0.x)} ${r1(p0.y)}`;
    const segs: [Pt, Pt, Pt, Pt][] = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k] as Pt;
      const b = pts[k + 1] as Pt;
      const ta = tan[k] as Pt;
      const tb = tan[k + 1] as Pt;
      const c1 = { x: a.x + ta.x / 3, y: a.y + ta.y / 3 };
      const c2 = { x: b.x - tb.x / 3, y: b.y - tb.y / 3 };
      segs.push([a, c1, c2, b]);
      d += `C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(b.x)} ${r1(b.y)}`;
    }
    const at = (s: [Pt, Pt, Pt, Pt], t: number): Pt => {
      const u = 1 - t;
      return {
        x: u * u * u * s[0].x + 3 * u * u * t * s[1].x + 3 * u * t * t * s[2].x + t * t * t * s[3].x,
        y: u * u * u * s[0].y + 3 * u * u * t * s[1].y + 3 * u * t * t * s[2].y + t * t * t * s[3].y,
      };
    };
    const nseg = segs.length;
    const mid = nseg % 2 === 1 ? at(segs[(nseg - 1) / 2] as [Pt, Pt, Pt, Pt], 0.5) : (pts[nseg / 2] as Pt);
    results[i] = { d, start: p0, end: pn, startSide: s0, endSide: sn, mid, points: pts, loop: false };
  });
  return results as Routed[];
}

export const sideNormal = (s: Side): Pt => NORMAL[s];
