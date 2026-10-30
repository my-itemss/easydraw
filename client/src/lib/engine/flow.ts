// Flow chart + cloud architecture renderer (they share one grammar and layout).
import type { NodeDef, Parsed } from "./parse";
import { layeredLayout, type LayerResult, type LItem } from "./layered";
import { routeEdges, type Box, type RouteReq } from "./route";
import { iconSvg, resolveIcon } from "./icons";
import { mix, paintFor, resolveColor, type Theme } from "./theme";
import { grow, markerId, newBounds, shadowAttr, text, tw, type Ctx } from "./svg";
import { r1, type Pt } from "./util";

const FS = 14;
const PADX = 24;
const PADT = 44;
const PADB = 24;

interface Level {
  res: LayerResult;
  items: LItem[];
  origin: Pt;
}

function nodeSize(ctx: Ctx, nd: NodeDef): { w: number; h: number } {
  const icon = resolveIcon(nd.props.icon);
  const content = tw(ctx, nd.label, FS) + (icon ? 26 : 0);
  switch (nd.props.shape) {
    case "diamond": {
      const w = Math.max(124, content * 1.55 + 30);
      return { w, h: Math.max(72, w * 0.52) };
    }
    case "circle": {
      const d = Math.max(68, content + 30);
      return { w: d, h: d };
    }
    case "cylinder":
      return { w: Math.max(104, content + 40), h: 66 };
    case "hexagon":
      return { w: Math.max(116, content + 56), h: 56 };
    case "parallelogram":
      return { w: Math.max(120, content + 60), h: 50 };
    case "document":
      return { w: Math.max(104, content + 40), h: 58 };
    case "oval":
      return { w: Math.max(100, content + 44), h: 46 };
    default:
      return { w: Math.max(100, content + 40), h: 46 };
  }
}

function shapePath(shape: string | undefined, b: Box): { el: string; centered: boolean } {
  const { x, y, w, h } = b;
  const r = (n: number) => r1(n);
  switch (shape) {
    case "oval":
      return { el: `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(h / 2)}"`, centered: true };
    case "circle":
      return { el: `<circle cx="${r(x + w / 2)}" cy="${r(y + h / 2)}" r="${r(w / 2)}"`, centered: true };
    case "diamond":
      return { el: `<polygon points="${r(x + w / 2)},${r(y)} ${r(x + w)},${r(y + h / 2)} ${r(x + w / 2)},${r(y + h)} ${r(x)},${r(y + h / 2)}"`, centered: true };
    case "hexagon": {
      const k = Math.min(18, w * 0.18);
      return { el: `<polygon points="${r(x + k)},${r(y)} ${r(x + w - k)},${r(y)} ${r(x + w)},${r(y + h / 2)} ${r(x + w - k)},${r(y + h)} ${r(x + k)},${r(y + h)} ${r(x)},${r(y + h / 2)}"`, centered: true };
    }
    case "parallelogram": {
      const k = 16;
      return { el: `<polygon points="${r(x + k)},${r(y)} ${r(x + w)},${r(y)} ${r(x + w - k)},${r(y + h)} ${r(x)},${r(y + h)}"`, centered: true };
    }
    case "cylinder": {
      const ry = 8;
      return {
        el: `<path d="M${r(x)} ${r(y + ry)}A${r(w / 2)} ${ry} 0 0 1 ${r(x + w)} ${r(y + ry)}V${r(y + h - ry)}A${r(w / 2)} ${ry} 0 0 1 ${r(x)} ${r(y + h - ry)}Z"`,
        centered: false,
      };
    }
    case "document": {
      const wv = 7;
      return {
        el: `<path d="M${r(x)} ${r(y)}H${r(x + w)}V${r(y + h - wv)}C${r(x + w * 0.75)} ${r(y + h - wv * 2.2)} ${r(x + w * 0.6)} ${r(y + h + wv * 0.4)} ${r(x + w / 2)} ${r(y + h - wv * 0.4)}S${r(x + w * 0.2)} ${r(y + h - wv * 1.6)} ${r(x)} ${r(y + h - wv)}Z"`,
        centered: false,
      };
    }
    default:
      return { el: `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="9"`, centered: false };
  }
}

function drawNode(ctx: Ctx, nd: NodeDef, b: Box): { svg: string; centered: boolean } {
  const paint = paintFor(ctx.theme, nd.props.color, ctx.g.colorMode);
  const sp = shapePath(nd.props.shape, b);
  let svg = `${sp.el} fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="1.5"${shadowAttr(ctx)}/>`;
  if (nd.props.shape === "cylinder") {
    const ry = 8;
    svg += `<path d="M${r1(b.x)} ${r1(b.y + ry)}A${r1(b.w / 2)} ${ry} 0 0 0 ${r1(b.x + b.w)} ${r1(b.y + ry)}" fill="none" stroke="${paint.stroke}" stroke-width="1.5"/>`;
    svg += `<path d="M${r1(b.x)} ${r1(b.y + ry)}A${r1(b.w / 2)} ${ry} 0 0 1 ${r1(b.x + b.w)} ${r1(b.y + ry)}" fill="none" stroke="${paint.stroke}" stroke-width="1.5"/>`;
  }
  const icon = resolveIcon(nd.props.icon);
  const label = nd.label;
  const lw = tw(ctx, label, FS);
  const total = lw + (icon ? 26 : 0);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2 + (nd.props.shape === "cylinder" ? 4 : 0);
  let x0 = cx - total / 2;
  if (icon) {
    svg += iconSvg(nd.props.icon, x0, cy - 9, 18, paint.text);
    x0 += 26;
  }
  svg += text(ctx, label, x0, cy, { size: FS, weight: 500, fill: paint.text });
  if (nd.props.link) {
    svg = `<a href="${nd.props.link.replace(/"/g, "&quot;")}" target="_blank">${svg}</a>`;
  }
  return { svg, centered: sp.centered };
}

function drawGroup(ctx: Ctx, nd: NodeDef, b: Box, arch: boolean): string {
  const theme: Theme = ctx.theme;
  const c = resolveColor(nd.props.color);
  const fill = c ? mix(c, theme.bg, theme.dark ? 0.12 : 0.07) : theme.groupFill;
  const stroke = c ?? theme.groupStroke;
  const dash = arch ? ' stroke-dasharray="6 4"' : "";
  let svg = `<rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${dash}/>`;
  const icon = resolveIcon(nd.props.icon);
  let x = b.x + 16;
  const y = b.y + 22;
  const col = c ?? theme.muted;
  if (icon) {
    svg += iconSvg(nd.props.icon, x, y - 9, 18, col);
    x += 26;
  }
  svg += text(ctx, nd.label, x, y, { size: 13, weight: 650, fill: c ? (theme.dark ? mix(c, "#ffffff", 0.7) : mix(c, "#000000", 0.75)) : theme.fg });
  return svg;
}

export function renderFlow(P: Parsed, ctx: Ctx): { body: string; bounds: ReturnType<typeof newBounds> } {
  const arch = P.type === "architecture";
  const nodes = P.nodes;
  const levels = new Map<string, Level>();
  const sizes = new Map<string, { w: number; h: number }>();
  const hasLabels = P.edges.some((e) => e.label);

  const ancestors = (name: string): string[] => {
    const chain: string[] = [];
    let cur: string | null = name;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      chain.unshift(cur);
      cur = nodes.get(cur)?.parent ?? null;
    }
    return chain;
  };

  // lifted edges per level
  const levelEdges = new Map<string, [string, string][]>();
  for (const e of P.edges) {
    const pu = ancestors(e.from);
    const pv = ancestors(e.to);
    let k = 0;
    while (k < pu.length && k < pv.length && pu[k] === pv[k]) k++;
    if (k >= pu.length || k >= pv.length) continue;
    const key = k > 0 ? (pu[k - 1] as string) : "";
    if (!levelEdges.has(key)) levelEdges.set(key, []);
    levelEdges.get(key)?.push([pu[k] as string, pv[k] as string]);
  }

  const doLevel = (parent: string): Level => {
    const existing = levels.get(parent);
    if (existing) return existing;
    const names = P.order.filter((n) => (nodes.get(n)?.parent ?? "") === parent);
    const items: LItem[] = names.map((n) => {
      const s = sizeOf(n);
      return { id: n, w: s.w, h: s.h };
    });
    const res = layeredLayout(items, levelEdges.get(parent) ?? [], P.globals.direction, hasLabels ? 14 : 0);
    const lv: Level = { res, items, origin: { x: 0, y: 0 } };
    levels.set(parent, lv);
    return lv;
  };

  const sizeOf = (name: string): { w: number; h: number } => {
    const cached = sizes.get(name);
    if (cached) return cached;
    const nd = nodes.get(name) as NodeDef;
    let s: { w: number; h: number };
    if (nd.isGroup) {
      const lv = doLevel(name);
      const headW = tw(ctx, nd.label, 13) + (resolveIcon(nd.props.icon) ? 26 : 0) + 40;
      const empty = lv.items.length === 0;
      s = {
        w: Math.max(empty ? 150 : 0, lv.res.w + PADX * 2, headW),
        h: empty ? 84 : lv.res.h + PADT + PADB,
      };
    } else s = nodeSize(ctx, nd);
    sizes.set(name, s);
    return s;
  };

  doLevel("");

  // absolute placement
  const abs = new Map<string, Box>();
  const place = (parent: string, ox: number, oy: number) => {
    const lv = levels.get(parent);
    if (!lv) return;
    lv.origin = { x: ox, y: oy };
    for (const it of lv.items) {
      const p = lv.res.pos.get(it.id) as Pt;
      const box = { x: ox + p.x, y: oy + p.y, w: it.w, h: it.h };
      abs.set(it.id, box);
      if (levels.has(it.id)) {
        const inner = levels.get(it.id) as Level;
        place(it.id, box.x + (box.w - inner.res.w) / 2, box.y + PADT);
      }
    }
  };
  place("", 0, 0);

  // routes
  const centeredOf = new Map<string, boolean>();
  const reqs: RouteReq[] = [];
  const edgeIdx: number[] = [];
  P.edges.forEach((e, i) => {
    const bu = abs.get(e.from);
    const bv = abs.get(e.to);
    if (!bu || !bv) return;
    const pu = ancestors(e.from);
    const pv = ancestors(e.to);
    let k = 0;
    while (k < pu.length && k < pv.length && pu[k] === pv[k]) k++;
    let mids: Pt[] = [];
    if (e.from !== e.to && k < pu.length && k < pv.length) {
      const key = k > 0 ? (pu[k - 1] as string) : "";
      const lv = levels.get(key);
      const ch = lv?.res.chains.get(`${pu[k]}|${pv[k]}`);
      if (lv && ch) mids = ch.map((p) => ({ x: lv.origin.x + p.x, y: lv.origin.y + p.y }));
    }
    const nu = nodes.get(e.from) as NodeDef;
    const nv = nodes.get(e.to) as NodeDef;
    const cu = !nu.isGroup && shapePath(nu.props.shape, bu).centered;
    const cv = !nv.isGroup && shapePath(nv.props.shape, bv).centered;
    centeredOf.set(e.from, cu);
    reqs.push({ fromKey: e.from, toKey: e.to, from: bu, to: bv, mids, fromCentered: cu, toCentered: cv });
    edgeIdx.push(i);
  });
  const routed = routeEdges(reqs);

  // draw
  const bounds = newBounds();
  let body = "";
  const groupNames = P.order.filter((n) => nodes.get(n)?.isGroup);
  groupNames.sort((a, b) => ancestors(a).length - ancestors(b).length);
  for (const g of groupNames) {
    const b = abs.get(g);
    if (!b) continue;
    body += drawGroup(ctx, nodes.get(g) as NodeDef, b, arch);
    grow(bounds, b.x, b.y, b.w, b.h);
  }

  let labels = "";
  routed.forEach((rt, ri) => {
    const e = P.edges[edgeIdx[ri] as number];
    if (!e) return;
    const color = resolveColor(e.props.color) ?? ctx.theme.line;
    const dashed = e.op === "--" || e.op === "-->";
    const arrowEnd = e.op === ">" || e.op === "-->" || e.op === "<>";
    const arrowStart = e.op === "<>";
    const mk = arrowEnd || arrowStart ? markerId(ctx, color) : "";
    body += `<path d="${rt.d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"${dashed ? ' stroke-dasharray="5 4"' : ""}${arrowEnd ? ` marker-end="url(#${mk})"` : ""}${arrowStart ? ` marker-start="url(#${mk})"` : ""}/>`;
    for (const p of rt.points) grow(bounds, p.x, p.y);
    if (e.label) {
      labels += text(ctx, e.label, rt.mid.x, rt.mid.y - (rt.loop ? 0 : 0), { size: 12.5, fill: ctx.theme.muted, anchor: "middle", halo: true });
      const w = tw(ctx, e.label, 12.5);
      grow(bounds, rt.mid.x - w / 2, rt.mid.y - 8, w, 16);
    }
  });

  for (const n of P.order) {
    const nd = nodes.get(n) as NodeDef;
    if (nd.isGroup) continue;
    const b = abs.get(n);
    if (!b) continue;
    body += drawNode(ctx, nd, b).svg;
    grow(bounds, b.x, b.y, b.w, b.h);
  }
  body += labels;
  return { body, bounds };
}
