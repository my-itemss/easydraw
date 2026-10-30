import type { NodeDef, Parsed, SeqBranch, SeqItem } from "./parse";
import { iconSvg, resolveIcon } from "./icons";
import { mix, paintFor, resolveColor } from "./theme";
import { grow, markerId, newBounds, shadowAttr, text, tw, type Ctx } from "./svg";
import { r1 } from "./util";

const HEAD_H = 44;
const ROW = 38;

interface Frame {
  kind: string;
  label?: string;
  y0: number;
  y1: number;
  cols: Set<number>;
  depth: number;
  seps: { y: number; kind: string; label?: string }[];
}
interface Msg {
  y: number;
  from: number;
  to: number;
  op: string;
  label: string;
  color: string | null;
  self: boolean;
  num: number | null;
}
interface Act {
  col: number;
  y0: number;
  y1: number;
  depth: number;
}

export function renderSequence(P: Parsed, ctx: Ctx) {
  const cols = P.order.filter((n) => !P.nodes.get(n)?.isGroup);
  const idx = new Map(cols.map((n, i) => [n, i]));
  const bounds = newBounds();
  if (cols.length === 0) return { body: "", bounds };

  const colW = cols.map((n) => {
    const nd = P.nodes.get(n) as NodeDef;
    return Math.max(112, tw(ctx, nd.label, 14) + (resolveIcon(nd.props.icon) ? 26 : 0) + 36);
  });

  // gather message text widths to size the gaps
  const msgs: { a: number; b: number; w: number }[] = [];
  const scan = (items: SeqItem[]) => {
    for (const it of items) {
      if (it.t === "msg") {
        const a = idx.get(it.from) as number;
        const b = idx.get(it.to) as number;
        msgs.push({ a: Math.min(a, b), b: Math.max(a, b), w: tw(ctx, it.label, 12.5) + 56 });
      } else if (it.t === "block") for (const br of it.branches) scan(br.items);
    }
  };
  scan(P.seq);
  const gaps: number[] = [];
  for (let i = 0; i < cols.length - 1; i++) gaps.push(Math.max(150, (colW[i] as number) / 2 + (colW[i + 1] as number) / 2 + 28));
  msgs.sort((p, q) => p.b - p.a - (q.b - q.a));
  for (const m of msgs) {
    if (m.a === m.b) {
      if (m.a < cols.length - 1) gaps[m.a] = Math.max(gaps[m.a] as number, m.w);
      continue;
    }
    let sum = 0;
    for (let i = m.a; i < m.b; i++) sum += gaps[i] as number;
    if (sum < m.w) for (let i = m.a; i < m.b; i++) gaps[i] = (gaps[i] as number) + (m.w - sum) / (m.b - m.a);
  }
  const cx: number[] = [];
  let x = (colW[0] as number) / 2;
  cx.push(x);
  for (let i = 1; i < cols.length; i++) {
    x += gaps[i - 1] as number;
    cx.push(x);
  }

  // vertical layout
  let y = HEAD_H + 34;
  const frames: Frame[] = [];
  const messages: Msg[] = [];
  const acts: Act[] = [];
  const open: Act[][] = cols.map(() => []);
  const openFrames: Frame[] = [];
  let num = 1;

  const walk = (items: SeqItem[]) => {
    for (const it of items) {
      if (it.t === "msg") {
        const a = idx.get(it.from) as number;
        const b = idx.get(it.to) as number;
        for (const f of openFrames) {
          f.cols.add(a);
          f.cols.add(b);
        }
        const self = a === b;
        messages.push({
          y: y + (self ? 6 : 0),
          from: a,
          to: b,
          op: it.op,
          label: it.label,
          color: resolveColor(it.props.color),
          self,
          num: P.globals.autoNumber ? num++ : null,
        });
        y += self ? ROW + 22 : ROW;
      } else if (it.t === "act") {
        const c = idx.get(it.name) as number;
        (open[c] as Act[]).push({ col: c, y0: y - 14, y1: y, depth: (open[c] as Act[]).length });
      } else if (it.t === "deact") {
        const c = idx.get(it.name) as number;
        const a = (open[c] as Act[]).pop();
        if (a) {
          a.y1 = y - 14;
          acts.push(a);
        }
      } else {
        const f: Frame = { kind: it.kind, label: it.branches[0]?.label, y0: y, y1: y, cols: new Set(), depth: openFrames.length, seps: [] };
        openFrames.push(f);
        y += 40;
        it.branches.forEach((br: SeqBranch, bi) => {
          if (bi > 0) {
            f.seps.push({ y: y - 2, kind: br.kind, label: br.label });
            y += 40;
          }
          walk(br.items);
          y += 8;
        });
        openFrames.pop();
        f.y1 = y;
        y += 12;
        frames.push(f);
      }
    }
  };
  walk(P.seq);
  for (const stackOf of open) for (const a of stackOf) acts.push({ ...a, y1: y - 10 });
  const bottom = y + 16;

  // draw
  let body = "";
  const theme = ctx.theme;
  // lifelines
  cols.forEach((n, i) => {
    body += `<line x1="${r1(cx[i] as number)}" y1="${HEAD_H}" x2="${r1(cx[i] as number)}" y2="${r1(bottom)}" stroke="${theme.nodeStroke}" stroke-width="1.4" stroke-dasharray="5 5"/>`;
    void n;
  });
  // frames (outer first)
  frames.sort((p, q) => p.depth - q.depth);
  for (const f of frames) {
    const minC = f.cols.size ? Math.min(...f.cols) : 0;
    const maxC = f.cols.size ? Math.max(...f.cols) : cols.length - 1;
    const pad = Math.max(16, 34 - f.depth * 8);
    const fx0 = (cx[minC] as number) - pad;
    const fx1 = (cx[maxC] as number) + pad + (messages.some((m) => m.self && m.from === maxC && m.y >= f.y0 && m.y <= f.y1) ? 44 : 0);
    body += `<rect x="${r1(fx0)}" y="${r1(f.y0)}" width="${r1(fx1 - fx0)}" height="${r1(f.y1 - f.y0)}" rx="8" fill="${theme.groupFill}" stroke="${theme.groupStroke}" stroke-width="1.3"/>`;
    const tag = f.kind;
    const tagW = tw(ctx, tag, 12) + 20;
    body += `<path d="M${r1(fx0)} ${r1(f.y0)}h${r1(tagW)}v18l-8 7h${r1(-tagW + 8)}z" fill="${theme.dark ? "#2c2c38" : "#ececf0"}" stroke="${theme.groupStroke}" stroke-width="1.2"/>`;
    body += text(ctx, tag, fx0 + 10, f.y0 + 12, { size: 12, weight: 650 });
    if (f.label) body += text(ctx, `[${f.label}]`, fx0 + tagW + 10, f.y0 + 12, { size: 12.5, fill: theme.muted });
    for (const s of f.seps) {
      body += `<line x1="${r1(fx0)}" y1="${r1(s.y)}" x2="${r1(fx1)}" y2="${r1(s.y)}" stroke="${theme.groupStroke}" stroke-width="1.3" stroke-dasharray="6 4"/>`;
      if (s.label) body += text(ctx, `[${s.label}]`, fx0 + 12, s.y + 14, { size: 12.5, fill: theme.muted });
    }
    grow(bounds, fx0, f.y0, fx1 - fx0, f.y1 - f.y0);
  }
  // activations
  for (const a of acts) {
    const ax = (cx[a.col] as number) - 5 + a.depth * 5;
    body += `<rect x="${r1(ax)}" y="${r1(a.y0)}" width="10" height="${r1(Math.max(8, a.y1 - a.y0))}" rx="2" fill="${mix("#5b5bd6", theme.bg, theme.dark ? 0.35 : 0.18)}" stroke="#5b5bd6" stroke-width="1.2"/>`;
  }
  // messages
  for (const m of messages) {
    const color = m.color ?? theme.line;
    const dashed = m.op === "--" || m.op === "-->";
    const arrowEnd = m.op === ">" || m.op === "-->" || m.op === "<>";
    const arrowStart = m.op === "<>" || m.op === "<";
    const mk = arrowEnd || arrowStart ? markerId(ctx, color) : "";
    const label = (m.num !== null ? `${m.num}. ` : "") + m.label;
    if (m.self) {
      const x0 = (cx[m.from] as number) + 5;
      const d = `M${r1(x0)} ${r1(m.y)}h30v22h-30`;
      body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ""}${arrowEnd ? ` marker-end="url(#${mk})"` : ""}/>`;
      if (label) body += text(ctx, label, x0 + 38, m.y + 11, { size: 12.5, fill: theme.fg });
      grow(bounds, x0, m.y, 38 + tw(ctx, label, 12.5), 22);
      continue;
    }
    const dir = (cx[m.to] as number) > (cx[m.from] as number) ? 1 : -1;
    const x0 = (cx[m.from] as number) + dir * 5;
    const x1 = (cx[m.to] as number) - dir * 5;
    let x0b = x0;
    let x1b = x1;
    if (m.op === "<") {
      [x0b, x1b] = [x1, x0];
    }
    body += `<line x1="${r1(x0b)}" y1="${r1(m.y)}" x2="${r1(x1b)}" y2="${r1(m.y)}" stroke="${color}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ""}${arrowEnd ? ` marker-end="url(#${mk})"` : ""}${arrowStart && m.op === "<>" ? ` marker-start="url(#${mk})"` : ""}/>`;
    if (label) body += text(ctx, label, (x0 + x1) / 2, m.y - 11, { size: 12.5, fill: theme.fg, anchor: "middle" });
  }
  // column heads (top)
  cols.forEach((n, i) => {
    const nd = P.nodes.get(n) as NodeDef;
    const paint = paintFor(theme, nd.props.color, P.globals.colorMode);
    const w = colW[i] as number;
    const bx = (cx[i] as number) - w / 2;
    body += `<rect x="${r1(bx)}" y="0" width="${r1(w)}" height="${HEAD_H}" rx="9" fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="1.5"${shadowAttr(ctx)}/>`;
    const icon = resolveIcon(nd.props.icon);
    const lw = tw(ctx, nd.label, 14);
    let tx = (cx[i] as number) - (lw + (icon ? 26 : 0)) / 2;
    if (icon) {
      body += iconSvg(nd.props.icon, tx, HEAD_H / 2 - 9, 18, paint.text);
      tx += 26;
    }
    body += text(ctx, nd.label, tx, HEAD_H / 2, { size: 14, weight: 500, fill: paint.text });
    grow(bounds, bx, 0, w, HEAD_H);
  });
  grow(bounds, 0, 0, 0, bottom);
  return { body, bounds };
}
