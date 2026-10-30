// Layered (Sugiyama-style) layout for one level of items.
// Works in a (main, cross) coordinate system and maps to x/y for the requested direction.
import type { Pt } from "./util";

export type Dir = "down" | "up" | "left" | "right";

export interface LItem {
  id: string;
  w: number;
  h: number;
}

export interface LayerResult {
  pos: Map<string, Pt>; // top-left of every real item
  w: number;
  h: number;
  /** control points (item-relative level coordinates) per ordered pair "a|b" (both orientations stored) */
  chains: Map<string, Pt[]>;
}

const GAP_CROSS = 44;
const GAP_MAIN = 72;

export function layeredLayout(items: LItem[], edgesIn: [string, string][], dir: Dir, labelGap = 0): LayerResult {
  const vertical = dir === "down" || dir === "up";
  const ids = items.map((i) => i.id);
  const size = new Map<string, { m: number; c: number }>();
  for (const it of items) size.set(it.id, vertical ? { m: it.h, c: it.w } : { m: it.w, c: it.h });

  // unique edges, no self loops
  const seen = new Set<string>();
  const edges: [string, string][] = [];
  for (const [a, b] of edgesIn) {
    if (a === b || !size.has(a) || !size.has(b)) continue;
    const k = `${a}|${b}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push([a, b]);
  }

  // --- break cycles (DFS) -> oriented edges
  const out = new Map<string, string[]>();
  for (const id of ids) out.set(id, []);
  for (const [a, b] of edges) (out.get(a) as string[]).push(b);
  const state = new Map<string, number>();
  const back = new Set<string>();
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u) as string[]) {
      const s = state.get(v) ?? 0;
      if (s === 1) back.add(`${u}|${v}`);
      else if (s === 0) visit(v);
    }
    state.set(u, 2);
  };
  for (const id of ids) if (!state.get(id)) visit(id);
  const oriented: [string, string, boolean][] = edges.map(([a, b]) => (back.has(`${a}|${b}`) ? [b, a, true] : [a, b, false]));

  // --- longest-path ranking
  const preds = new Map<string, string[]>();
  for (const id of ids) preds.set(id, []);
  for (const [a, b] of oriented) (preds.get(b) as string[]).push(a);
  const rank = new Map<string, number>();
  const calc = (v: string, guard: Set<string>): number => {
    const known = rank.get(v);
    if (known !== undefined) return known;
    if (guard.has(v)) return 0;
    guard.add(v);
    let r = 0;
    for (const p of preds.get(v) as string[]) r = Math.max(r, calc(p, guard) + 1);
    guard.delete(v);
    rank.set(v, r);
    return r;
  };
  for (const id of ids) calc(id, new Set());

  // --- dummies for long edges
  const nodeSize = new Map(size);
  const adj = new Map<string, Set<string>>();
  const addAdj = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)?.add(b);
    adj.get(b)?.add(a);
  };
  const layerOf = new Map<string, number>(rank);
  const chainIds = new Map<string, string[]>(); // "lo|hi" -> dummy ids from lo to hi
  let dn = 0;
  for (const [a, b] of oriented) {
    const ra = rank.get(a) as number;
    const rb = rank.get(b) as number;
    if (rb - ra <= 1) {
      addAdj(a, b);
      chainIds.set(`${a}|${b}`, []);
      continue;
    }
    let prev = a;
    const ch: string[] = [];
    for (let r = ra + 1; r < rb; r++) {
      const d = `~d${dn++}`;
      nodeSize.set(d, { m: 0, c: 14 });
      layerOf.set(d, r);
      ch.push(d);
      addAdj(prev, d);
      prev = d;
    }
    addAdj(prev, b);
    chainIds.set(`${a}|${b}`, ch);
  }
  for (const id of ids) if (!adj.has(id)) adj.set(id, new Set());

  const maxRank = Math.max(0, ...Array.from(layerOf.values()));
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  const allIds = [...ids, ...Array.from(layerOf.keys()).filter((k) => k.startsWith("~d"))];
  for (const id of allIds) (layers[layerOf.get(id) as number] as string[]).push(id);

  // --- cross-axis coordinates
  const cross = new Map<string, number>(); // center
  const csize = (id: string) => (nodeSize.get(id) as { m: number; c: number }).c;
  const sep = (a: string, b: string) => csize(a) / 2 + csize(b) / 2 + (a.startsWith("~d") || b.startsWith("~d") ? 18 : GAP_CROSS);

  const pack = () => {
    for (const layer of layers) {
      let x = 0;
      layer.forEach((id, i) => {
        if (i > 0) x += sep(layer[i - 1] as string, id);
        cross.set(id, x);
      });
    }
    // centre layers on each other
    const widths = layers.map((l) => (l.length ? (cross.get(l[l.length - 1] as string) as number) : 0));
    const mx = Math.max(0, ...widths);
    layers.forEach((l, i) => {
      const off = (mx - (widths[i] as number)) / 2;
      for (const id of l) cross.set(id, (cross.get(id) as number) + off);
    });
  };
  pack();

  const bary = (id: string, filter: (n: string) => boolean): number | null => {
    const ns = Array.from(adj.get(id) ?? []).filter(filter);
    if (!ns.length) return null;
    return ns.reduce((s, n) => s + (cross.get(n) as number), 0) / ns.length;
  };

  for (let it = 0; it < 4; it++) {
    for (let r = 1; r < layers.length; r++) {
      const layer = layers[r] as string[];
      const keyed = layer.map((id, i) => ({ id, b: bary(id, (n) => (layerOf.get(n) as number) < r) ?? (cross.get(id) as number), i }));
      keyed.sort((p, q) => p.b - q.b || p.i - q.i);
      layers[r] = keyed.map((k) => k.id);
      pack();
    }
    for (let r = layers.length - 2; r >= 0; r--) {
      const layer = layers[r] as string[];
      const keyed = layer.map((id, i) => ({ id, b: bary(id, (n) => (layerOf.get(n) as number) > r) ?? (cross.get(id) as number), i }));
      keyed.sort((p, q) => p.b - q.b || p.i - q.i);
      layers[r] = keyed.map((k) => k.id);
      pack();
    }
  }

  // --- coordinate refinement: pull towards neighbours while keeping order and separation
  const relax = (layer: string[], want: (id: string) => number | null) => {
    const n = layer.length;
    if (!n) return;
    const d = layer.map((id) => want(id) ?? (cross.get(id) as number));
    const f: number[] = [];
    const b: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) f[i] = i === 0 ? (d[0] as number) : Math.max(d[i] as number, (f[i - 1] as number) + sep(layer[i - 1] as string, layer[i] as string));
    for (let i = n - 1; i >= 0; i--)
      b[i] = i === n - 1 ? (d[i] as number) : Math.min(d[i] as number, (b[i + 1] as number) - sep(layer[i] as string, layer[i + 1] as string));
    for (let i = 0; i < n; i++) cross.set(layer[i] as string, ((f[i] as number) + (b[i] as number)) / 2);
    // fix any residual overlap after averaging
    for (let i = 1; i < n; i++) {
      const need = (cross.get(layer[i - 1] as string) as number) + sep(layer[i - 1] as string, layer[i] as string);
      if ((cross.get(layer[i] as string) as number) < need) cross.set(layer[i] as string, need);
    }
  };
  for (let it = 0; it < 4; it++) {
    for (let r = 1; r < layers.length; r++) relax(layers[r] as string[], (id) => bary(id, (n) => (layerOf.get(n) as number) < r));
    for (let r = layers.length - 2; r >= 0; r--) relax(layers[r] as string[], (id) => bary(id, (n) => (layerOf.get(n) as number) > r));
  }

  let minC = Infinity;
  let maxC = -Infinity;
  for (const id of allIds) {
    const c = cross.get(id) as number;
    const half = csize(id) / 2;
    minC = Math.min(minC, c - half);
    maxC = Math.max(maxC, c + half);
  }
  if (!isFinite(minC)) {
    minC = 0;
    maxC = 0;
  }

  // --- main axis
  const mainStart: number[] = [];
  const mainSize: number[] = [];
  let m = 0;
  layers.forEach((layer, r) => {
    const sz = Math.max(0, ...layer.map((id) => (nodeSize.get(id) as { m: number; c: number }).m));
    mainSize[r] = sz;
    mainStart[r] = m;
    m += sz + GAP_MAIN + labelGap;
  });
  const totalMain = Math.max(0, m - GAP_MAIN - labelGap);
  const totalCross = maxC - minC;

  const mainCenter = (id: string) => (mainStart[layerOf.get(id) as number] as number) + (mainSize[layerOf.get(id) as number] as number) / 2;
  const toXY = (mainC: number, crossC: number): Pt => {
    const c = crossC - minC;
    switch (dir) {
      case "down":
        return { x: c, y: mainC };
      case "up":
        return { x: c, y: totalMain - mainC };
      case "right":
        return { x: mainC, y: c };
      default:
        return { x: totalMain - mainC, y: c };
    }
  };

  const pos = new Map<string, Pt>();
  for (const it of items) {
    const c = toXY(mainCenter(it.id), cross.get(it.id) as number);
    pos.set(it.id, { x: c.x - it.w / 2, y: c.y - it.h / 2 });
  }
  const chains = new Map<string, Pt[]>();
  for (const [k, ch] of chainIds) {
    const pts = ch.map((d) => toXY(mainCenter(d), cross.get(d) as number));
    const [a, b] = k.split("|") as [string, string];
    // stored by original edge orientation (a|b as oriented); callers look up both
    chains.set(`${a}|${b}`, pts);
    chains.set(`${b}|${a}`, [...pts].reverse());
  }
  const w = vertical ? totalCross : totalMain;
  const h = vertical ? totalMain : totalCross;
  return { pos, w, h, chains };
}
