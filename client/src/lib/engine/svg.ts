import type { Globals } from "./parse";
import type { Theme } from "./theme";
import { esc, r1, textWidth } from "./util";

export interface Ctx {
  theme: Theme;
  g: Globals;
  uid: string;
  markers: Map<string, string>;
  defs: string[];
}

export function makeCtx(theme: Theme, g: Globals, uid: string): Ctx {
  const ctx: Ctx = { theme, g, uid, markers: new Map(), defs: [] };
  if (g.styleMode === "shadow") {
    ctx.defs.push(
      `<filter id="${uid}-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000" flood-opacity="${theme.dark ? 0.4 : 0.12}"/></filter>`,
    );
  }
  return ctx;
}

export const shadowAttr = (ctx: Ctx) => (ctx.g.styleMode === "shadow" ? ` filter="url(#${ctx.uid}-sh)"` : "");

export function markerId(ctx: Ctx, color: string): string {
  let id = ctx.markers.get(color);
  if (!id) {
    id = `${ctx.uid}-m${ctx.markers.size}`;
    ctx.markers.set(color, id);
    ctx.defs.push(
      `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5 1 L9.5 5 L0.5 9 z" fill="${color}" stroke="${color}" stroke-linejoin="round"/></marker>`,
    );
  }
  return id;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const newBounds = (): Bounds => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
export function grow(b: Bounds, x: number, y: number, w = 0, h = 0) {
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x + w);
  b.maxY = Math.max(b.maxY, y + h);
}

export function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  o: { size?: number; weight?: number | string; fill?: string; anchor?: "start" | "middle" | "end"; mono?: boolean; halo?: boolean } = {},
): string {
  const size = o.size ?? 14;
  const halo = o.halo ? ` stroke="${ctx.theme.bg}" stroke-width="4" stroke-linejoin="round" paint-order="stroke"` : "";
  const fam = o.mono ? ctx.theme.mono : ctx.theme.font;
  return `<text x="${r1(x)}" y="${r1(y)}" font-family="${fam}" font-size="${size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? ctx.theme.fg}" text-anchor="${o.anchor ?? "start"}" dominant-baseline="central"${halo}>${esc(s)}</text>`;
}

export const tw = (ctx: Ctx, s: string, size: number, mono = false) => textWidth(s, size, mono || ctx.g.typeface === "mono");

export function wrapSvg(
  ctx: Ctx,
  body: string,
  b: Bounds,
  opts: { background?: boolean; padding?: number },
): { svg: string; width: number; height: number } {
  const pad = opts.padding ?? 28;
  if (!isFinite(b.minX)) {
    b.minX = 0;
    b.minY = 0;
    b.maxX = 120;
    b.maxY = 40;
  }
  let title = "";
  let top = b.minY;
  if (ctx.g.title) {
    const tWidth = tw(ctx, ctx.g.title, 17);
    title = text(ctx, ctx.g.title, b.minX, b.minY - 22, { size: 17, weight: 650 });
    top = b.minY - 44;
    b.maxX = Math.max(b.maxX, b.minX + tWidth);
  }
  const x0 = b.minX - pad;
  const y0 = top - pad;
  const width = Math.ceil(b.maxX - b.minX + pad * 2);
  const height = Math.ceil(b.maxY - top + pad * 2);
  const bg = opts.background ? `<rect x="${r1(x0)}" y="${r1(y0)}" width="${width}" height="${height}" fill="${ctx.theme.bg}"/>` : "";
  const defs = ctx.defs.length ? `<defs>${ctx.defs.join("")}</defs>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${r1(x0)} ${r1(y0)} ${width} ${height}" font-family="${ctx.theme.font}">${defs}${bg}${title}${body}</svg>`;
  return { svg, width, height };
}

export function errorSvg(message: string, theme: Theme): { svg: string; width: number; height: number } {
  const w = Math.max(260, Math.ceil(textWidth(message, 13)) + 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="64" viewBox="0 0 ${w} 64"><rect x="1" y="1" width="${w - 2}" height="62" rx="10" fill="${theme.dark ? "#3b1d1d" : "#fef2f2"}" stroke="#ef4444"/><text x="20" y="32" font-family="${theme.font}" font-size="13" fill="${theme.dark ? "#fecaca" : "#b91c1c"}" dominant-baseline="central">${esc(message)}</text></svg>`;
  return { svg, width: w, height: 64 };
}
