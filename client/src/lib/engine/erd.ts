import type { NodeDef, Parsed } from "./parse";
import { layeredLayout, type LItem } from "./layered";
import { routeEdges, sideNormal, type Box, type RouteReq } from "./route";
import { iconSvg, resolveIcon } from "./icons";
import { mix, paintFor, resolveColor } from "./theme";
import { grow, newBounds, shadowAttr, text, tw, type Ctx } from "./svg";
import { r1, type Pt } from "./util";

const HEAD = 38;
const ROW = 26;

interface Dim {
  w: number;
  h: number;
  nameW: number;
  typeW: number;
}

function dims(ctx: Ctx, nd: NodeDef): Dim {
  let nameW = 0;
  let typeW = 0;
  for (const a of nd.attrs) {
    nameW = Math.max(nameW, tw(ctx, a.name, 13));
    typeW = Math.max(typeW, a.type ? tw(ctx, a.type, 12, true) : 0);
  }
  const head = tw(ctx, nd.label, 14) + (resolveIcon(nd.props.icon) ? 26 : 0) + 32;
  const body = 34 + nameW + (typeW ? 24 + typeW : 0) + 20;
  return { w: Math.max(150, head, body), h: HEAD + Math.max(1, nd.attrs.length) * ROW + (nd.attrs.length ? 6 : 0), nameW, typeW };
}

/** cardinality at one end: "many" draws a crow's foot, "one" a bar */
function endSymbol(p: Pt, n: Pt, kind: "many" | "one", color: string): string {
  const px = -n.y;
  const py = n.x; // perpendicular
  if (kind === "one") {
    const a = { x: p.x + n.x * 12, y: p.y + n.y * 12 };
    const b = { x: p.x + n.x * 17, y: p.y + n.y * 17 };
    return (
      `<path d="M${r1(a.x + px * 7)} ${r1(a.y + py * 7)}L${r1(a.x - px * 7)} ${r1(a.y - py * 7)}M${r1(b.x + px * 7)} ${r1(b.y + py * 7)}L${r1(b.x - px * 7)} ${r1(b.y - py * 7)}" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    );
  }
  const tip = { x: p.x + n.x * 14, y: p.y + n.y * 14 };
  return (
    `<path d="M${r1(tip.x)} ${r1(tip.y)}L${r1(p.x + px * 8)} ${r1(p.y + py * 8)}M${r1(tip.x)} ${r1(tip.y)}L${r1(p.x - px * 8)} ${r1(p.y - py * 8)}M${r1(tip.x)} ${r1(tip.y)}L${r1(p.x)} ${r1(p.y)}" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
  );
}

export function renderErd(P: Parsed, ctx: Ctx) {
  const names = P.order.filter((n) => !P.nodes.get(n)?.isGroup);
  const dim = new Map<string, Dim>();
  for (const n of names) dim.set(n, dims(ctx, P.nodes.get(n) as NodeDef));
  const items: LItem[] = names.map((n) => ({ id: n, w: (dim.get(n) as Dim).w, h: (dim.get(n) as Dim).h }));
  const res = layeredLayout(
    items,
    P.edges.map((e) => [e.from, e.to] as [string, string]),
    P.globals.direction,
    10,
  );
  const abs = new Map<string, Box>();
  for (const it of items) {
    const p = res.pos.get(it.id) as Pt;
    abs.set(it.id, { x: p.x, y: p.y, w: it.w, h: it.h });
  }
  const attrY = (ent: string, attr?: string): number | undefined => {
    if (!attr) return undefined;
    const nd = P.nodes.get(ent) as NodeDef;
    const i = nd.attrs.findIndex((a) => a.name === attr);
    const b = abs.get(ent);
    if (i < 0 || !b) return undefined;
    return b.y + HEAD + i * ROW + ROW / 2;
  };

  const reqs: RouteReq[] = [];
  P.edges.forEach((e) => {
    const bu = abs.get(e.from) as Box;
    const bv = abs.get(e.to) as Box;
    const ch = res.chains.get(`${e.from}|${e.to}`) ?? [];
    reqs.push({ fromKey: e.from, toKey: e.to, from: bu, to: bv, mids: ch, fromY: attrY(e.from, e.fromAttr), toY: attrY(e.to, e.toAttr) });
  });
  const routed = routeEdges(reqs);

  const bounds = newBounds();
  let body = "";
  const theme = ctx.theme;
  routed.forEach((rt, i) => {
    const e = P.edges[i] as (typeof P.edges)[number];
    const color = resolveColor(e.props.color) ?? theme.line;
    body += `<path d="${rt.d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`;
    const op = e.rawOp;
    const left = op === ">" || op === "<>" ? "many" : "one"; // source end
    const right = op === "<" || op === "<>" ? "many" : "one"; // target end
    if (!rt.loop) {
      body += endSymbol(rt.start, sideNormal(rt.startSide), left, color);
      body += endSymbol(rt.end, sideNormal(rt.endSide), right, color);
    }
    for (const p of rt.points) grow(bounds, p.x, p.y);
    if (e.label) {
      body += text(ctx, e.label, rt.mid.x, rt.mid.y, { size: 12, fill: theme.muted, anchor: "middle", halo: true });
    }
  });

  for (const n of names) {
    const nd = P.nodes.get(n) as NodeDef;
    const b = abs.get(n) as Box;
    const d = dim.get(n) as Dim;
    const paint = paintFor(theme, nd.props.color, P.globals.colorMode);
    const headFill = nd.props.color ? paint.fill : theme.dark ? "#2a2a36" : "#f3f3f6";
    body += `<g${shadowAttr(ctx)}><rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="10" fill="${theme.nodeFill}" stroke="${paint.stroke}" stroke-width="1.5"/></g>`;
    body += `<path d="M${r1(b.x)} ${r1(b.y + HEAD)}V${r1(b.y + 10)}a10 10 0 0 1 10-10H${r1(b.x + b.w - 10)}a10 10 0 0 1 10 10V${r1(b.y + HEAD)}Z" fill="${headFill}" stroke="${paint.stroke}" stroke-width="1.5"/>`;
    const icon = resolveIcon(nd.props.icon);
    let tx = b.x + 14;
    if (icon) {
      body += iconSvg(nd.props.icon, tx, b.y + HEAD / 2 - 9, 18, nd.props.color ? paint.text : theme.muted);
      tx += 26;
    }
    body += text(ctx, nd.label, tx, b.y + HEAD / 2, { size: 14, weight: 650, fill: paint.text });
    nd.attrs.forEach((a, i) => {
      const ry = b.y + HEAD + i * ROW + ROW / 2 + 3;
      if (i > 0) body += `<line x1="${r1(b.x + 1)}" y1="${r1(ry - ROW / 2)}" x2="${r1(b.x + b.w - 1)}" y2="${r1(ry - ROW / 2)}" stroke="${theme.nodeStroke}" stroke-opacity=".45"/>`;
      const badge = a.flags.includes("pk") ? "PK" : a.flags.includes("fk") ? "FK" : "";
      if (badge) {
        body += `<rect x="${r1(b.x + 8)}" y="${r1(ry - 8)}" width="22" height="15" rx="4" fill="${badge === "PK" ? mix("#eab308", theme.bg, theme.dark ? 0.35 : 0.3) : mix("#5b5bd6", theme.bg, theme.dark ? 0.35 : 0.2)}"/>`;
        body += text(ctx, badge, b.x + 19, ry, { size: 9.5, weight: 700, anchor: "middle", fill: theme.fg });
      }
      const dim2 = a.flags.includes("nullable") ? theme.muted : theme.fg;
      body += text(ctx, a.name, b.x + 36, ry, { size: 13, fill: dim2 });
      if (a.type) body += text(ctx, a.type, b.x + b.w - 12, ry, { size: 12, fill: theme.muted, anchor: "end", mono: true });
    });
    void d;
    grow(bounds, b.x, b.y, b.w, b.h);
  }
  return { body, bounds };
}
