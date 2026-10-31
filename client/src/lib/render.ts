import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";
import type { RoughCanvas } from "roughjs/bin/canvas";
import { getStroke } from "perfect-freehand";
import type { El, Peer, Pt } from "../types";
import { darkColor } from "./colors";
import { center, commonBounds, isLinear, absPoints, type Bounds } from "./elements";
import { dist } from "./math";
import { fontString, LINE_HEIGHT, wrapText, labelFont } from "./text";

export const gen = rough.generator();
export const ACCENT = "#6965db";

const tc = (c: string, dark: boolean) => (dark ? darkColor(c) : c);

/* ---------------- drawable construction ---------------- */

function baseOptions(el: El, dark: boolean): Options {
  const sw = el.strokeWidth;
  const dash = el.strokeStyle === "dashed" ? [8, 8 + sw] : el.strokeStyle === "dotted" ? [1.5, 6 + sw] : undefined;
  return {
    seed: el.seed,
    roughness: el.roughness,
    stroke: tc(el.strokeColor, dark),
    strokeWidth: sw,
    fill: el.backgroundColor === "transparent" ? undefined : tc(el.backgroundColor, dark),
    fillStyle: el.fillStyle,
    fillWeight: sw / 2,
    hachureGap: sw * 4,
    hachureAngle: -41,
    strokeLineDash: dash,
    disableMultiStroke: el.roughness === 0,
    disableMultiStrokeFill: true,
  };
}

function roundedPath(pts: Pt[], r: number): string {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v1: Pt = [p0[0] - p1[0], p0[1] - p1[1]], v2: Pt = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a: Pt = [p1[0] + (v1[0] / l1) * rr, p1[1] + (v1[1] / l1) * rr];
    const b: Pt = [p1[0] + (v2[0] / l2) * rr, p1[1] + (v2[1] / l2) * rr];
    d += `${i === 0 ? "M" : "L"} ${a[0]} ${a[1]} Q ${p1[0]} ${p1[1]} ${b[0]} ${b[1]} `;
  }
  return d + "Z";
}

function arrowhead(kind: string, tip: Pt, from: Pt, el: El, o: Options): Drawable[] {
  if (kind === "none") return [];
  const len = dist(tip, from);
  if (len < 1) return [];
  const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const size = Math.min(12 + el.strokeWidth * 3, len * 0.6);
  const solid: Options = { ...o, fill: o.stroke, fillStyle: "solid", strokeLineDash: undefined };
  const line: Options = { ...o, fill: undefined, strokeLineDash: undefined };
  const spread = 0.46;
  const wing = (s: number): Pt => [tip[0] - Math.cos(ang + s) * size, tip[1] - Math.sin(ang + s) * size];
  switch (kind) {
    case "arrow":
      return [gen.line(tip[0], tip[1], wing(spread)[0], wing(spread)[1], line), gen.line(tip[0], tip[1], wing(-spread)[0], wing(-spread)[1], line)];
    case "triangle":
      return [gen.polygon([tip, wing(spread), wing(-spread)], solid)];
    case "dot": {
      const r = size * 0.7;
      return [gen.circle(tip[0] - Math.cos(ang) * r / 2, tip[1] - Math.sin(ang) * r / 2, r, solid)];
    }
    case "bar": {
      const nx = -Math.sin(ang) * size * 0.55, ny = Math.cos(ang) * size * 0.55;
      return [gen.line(tip[0] - nx, tip[1] - ny, tip[0] + nx, tip[1] + ny, line)];
    }
  }
  return [];
}

const cache = new Map<string, { key: string; list: Drawable[] }>();

export function buildDrawables(el: El, dark: boolean): Drawable[] {
  const key = `${el.version}:${dark ? 1 : 0}`;
  const hit = cache.get(el.id);
  if (hit && hit.key === key) return hit.list;
  const o = baseOptions(el, dark);
  const { width: w, height: h } = el;
  let list: Drawable[] = [];
  switch (el.type) {
    case "rectangle": {
      if (w < 1 || h < 1) break;
      const pts: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
      list = [el.rounded ? gen.path(roundedPath(pts, Math.min(32, Math.min(w, h) * 0.25)), o) : gen.rectangle(0, 0, w, h, o)];
      break;
    }
    case "diamond": {
      if (w < 1 || h < 1) break;
      const pts: Pt[] = [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
      list = [el.rounded ? gen.path(roundedPath(pts, Math.min(w, h) * 0.18), o) : gen.polygon(pts, o)];
      break;
    }
    case "ellipse":
      if (w < 1 || h < 1) break;
      list = [gen.ellipse(w / 2, h / 2, w, h, o)];
      break;
    case "arrow":
    case "line": {
      const pts = el.points ?? [];
      if (pts.length < 2) break;
      const noFill: Options = { ...o, fill: undefined };
      list = [el.rounded && pts.length > 2 ? gen.curve(pts, noFill) : gen.linearPath(pts, noFill)];
      if (el.type === "arrow") {
        const n = pts.length;
        list.push(...arrowhead(el.endArrowhead ?? "arrow", pts[n - 1], pts[n - 2], el, o));
        list.push(...arrowhead(el.startArrowhead ?? "none", pts[0], pts[1], el, o));
      }
      break;
    }
  }
  cache.set(el.id, { key, list });
  return list;
}

const pathCache = new Map<string, { v: number; d: string }>();
export function freedrawPath(el: El): string {
  const hit = pathCache.get(el.id);
  if (hit && hit.v === el.version) return hit.d;
  const pts = (el.points ?? []).map((p) => [p[0], p[1]]);
  const stroke = getStroke(pts, { size: el.strokeWidth * 3.4 + 1, thinning: 0.55, smoothing: 0.55, streamline: 0.5, simulatePressure: true });
  let d = "";
  if (stroke.length) {
    const parts: (string | number)[] = ["M", stroke[0][0], stroke[0][1], "Q"];
    stroke.forEach(([x0, y0], i) => {
      const [x1, y1] = stroke[(i + 1) % stroke.length];
      parts.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    });
    parts.push("Z");
    d = parts.join(" ");
  }
  pathCache.set(el.id, { v: el.version, d });
  return d;
}

/* ---------------- images ---------------- */

const images = new Map<string, { src: string; img: HTMLImageElement }>();
let onImageLoad: () => void = () => {};
export const setImageLoadHandler = (fn: () => void) => { onImageLoad = fn; };
export function getImage(el: El): HTMLImageElement | null {
  if (!el.src) return null;
  let hit = images.get(el.id);
  if (!hit || hit.src !== el.src) {
    const img = new Image();
    img.onload = () => onImageLoad();
    img.src = el.src;
    hit = { src: el.src, img };
    images.set(el.id, hit);
  }
  return hit.img.complete && hit.img.naturalWidth ? hit.img : null;
}

/* ---------------- element drawing ---------------- */

export function labelLines(el: El): { lines: string[]; size: number; lh: number } {
  const { size, family } = labelFont(el);
  const inset = el.type === "rectangle" ? 0.9 : 0.62;
  const maxW = Math.max(20, el.width * inset - 16);
  return { lines: wrapText(el.text ?? "", size, family, maxW), size, lh: size * LINE_HEIGHT };
}

export function drawElement(ctx: CanvasRenderingContext2D, rc: RoughCanvas, el: El, dark: boolean, hideText = false) {
  ctx.save();
  ctx.globalAlpha = el.opacity / 100;
  const c = center(el);
  ctx.translate(c[0], c[1]);
  if (el.angle) ctx.rotate(el.angle);
  ctx.translate(-el.width / 2, -el.height / 2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (el.type) {
    case "freedraw": {
      ctx.fillStyle = tc(el.strokeColor, dark);
      ctx.fill(new Path2D(freedrawPath(el)));
      break;
    }
    case "text": {
      if (hideText) break;
      const lines = (el.text ?? "").split("\n");
      const size = el.fontSize ?? 20, lh = size * LINE_HEIGHT;
      ctx.font = fontString(size, el.fontFamily ?? "hand");
      ctx.fillStyle = tc(el.strokeColor, dark);
      ctx.textBaseline = "middle";
      ctx.textAlign = el.textAlign ?? "left";
      const x = el.textAlign === "center" ? el.width / 2 : el.textAlign === "right" ? el.width : 0;
      lines.forEach((l, i) => ctx.fillText(l, x, (i + 0.5) * lh));
      break;
    }
    case "image": {
      const img = getImage(el);
      if (img) ctx.drawImage(img, 0, 0, el.width, el.height);
      else {
        ctx.fillStyle = dark ? "#2a2a32" : "#eceef1";
        ctx.fillRect(0, 0, el.width, el.height);
      }
      break;
    }
    default: {
      for (const d of buildDrawables(el, dark)) rc.draw(d);
      if (el.text && !hideText && el.type !== "arrow" && el.type !== "line") {
        const { lines, size, lh } = labelLines(el);
        ctx.font = fontString(size, labelFont(el).family);
        ctx.fillStyle = tc(el.strokeColor, dark);
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        const top = el.height / 2 - (lines.length * lh) / 2;
        lines.forEach((l, i) => ctx.fillText(l, el.width / 2, top + (i + 0.5) * lh));
      }
    }
  }
  ctx.restore();
}

/* ---------------- selection geometry (shared with hit-testing) ---------------- */

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate";
export interface SelGeo {
  cx: number; cy: number; w: number; h: number; angle: number; pad: number;
  handles: Partial<Record<HandleId, Pt>>;
  linear?: { el: El; pts: Pt[]; mids: Pt[] };
}

const HANDLE_DIRS: Record<Exclude<HandleId, "rotate">, [number, number]> = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};
export const handleDir = (h: HandleId) => HANDLE_DIRS[h as Exclude<HandleId, "rotate">];

export function selectionGeometry(sel: El[], zoom: number): SelGeo | null {
  if (!sel.length) return null;
  const pad = 7 / zoom;
  if (sel.length === 1 && isLinear(sel[0])) {
    const el = sel[0];
    const pts = absPoints(el);
    const mids = pts.slice(1).map((p, i) => [(p[0] + pts[i][0]) / 2, (p[1] + pts[i][1]) / 2] as Pt);
    const c = center(el);
    return { cx: c[0], cy: c[1], w: el.width, h: el.height, angle: el.angle, pad, handles: {}, linear: { el, pts, mids } };
  }
  let cx: number, cy: number, w: number, h: number, angle = 0;
  if (sel.length === 1) {
    const el = sel[0];
    [cx, cy] = center(el); w = el.width; h = el.height; angle = el.angle;
  } else {
    const b = commonBounds(sel) as Bounds;
    cx = (b[0] + b[2]) / 2; cy = (b[1] + b[3]) / 2; w = b[2] - b[0]; h = b[3] - b[1];
  }
  const hw = w / 2 + pad, hh = h / 2 + pad;
  const rot = (x: number, y: number): Pt => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  };
  const handles: SelGeo["handles"] = {};
  const small = Math.min(w, h) * zoom < 36;
  (Object.keys(HANDLE_DIRS) as Exclude<HandleId, "rotate">[]).forEach((k) => {
    const [dx, dy] = HANDLE_DIRS[k];
    if (small && (dx === 0 || dy === 0)) return;
    handles[k] = rot(dx * hw, dy * hh);
  });
  handles.rotate = rot(0, -hh - 22 / zoom);
  return { cx, cy, w, h, angle, pad, handles };
}

export const HANDLE_PX = 9;

/* ---------------- full scene ---------------- */

export interface SceneRender {
  elements: El[];
  selected: Set<string>;
  zoom: number;
  scrollX: number;
  scrollY: number;
  dark: boolean;
  canvasBg: string;
  grid: boolean;
  width: number;
  height: number;
  dpr: number;
  editingId: string | null;
  marquee: { x: number; y: number; w: number; h: number } | null;
  bindHighlight: string | null;
  erasing: Set<string>;
  peers: Peer[];
  linearHover?: number | null;
}

export function renderScene(canvas: HTMLCanvasElement, rc: RoughCanvas, r: SceneRender) {
  const ctx = canvas.getContext("2d")!;
  const { zoom, scrollX, scrollY, dark, dpr } = r;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = tc(r.canvasBg, dark);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, scrollX * zoom * dpr, scrollY * zoom * dpr);

  if (r.grid && zoom > 0.35) drawGrid(ctx, r);

  const vx0 = -scrollX, vy0 = -scrollY, vx1 = vx0 + r.width / zoom, vy1 = vy0 + r.height / zoom;
  for (const el of r.elements) {
    if (el.isDeleted) continue;
    const b = commonBounds([el])!;
    const m = 40 + el.strokeWidth * 2;
    if (b[2] + m < vx0 || b[0] - m > vx1 || b[3] + m < vy0 || b[1] - m > vy1) continue;
    const faded = r.erasing.has(el.id);
    if (faded) ctx.globalAlpha = 0.25;
    drawElement(ctx, rc, faded ? { ...el, opacity: 25 } : el, dark, el.id === r.editingId);
    ctx.globalAlpha = 1;
  }

  const accent = dark ? "#a8a5ff" : ACCENT;
  const byId = new Map(r.elements.map((e) => [e.id, e]));

  if (r.bindHighlight) {
    const s = byId.get(r.bindHighlight);
    if (s) {
      ctx.save();
      const c = center(s);
      ctx.translate(c[0], c[1]); ctx.rotate(s.angle);
      ctx.strokeStyle = accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 4 / zoom;
      const p = 6 / zoom;
      if (s.type === "ellipse") { ctx.beginPath(); ctx.ellipse(0, 0, s.width / 2 + p, s.height / 2 + p, 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (s.type === "diamond") { ctx.beginPath(); ctx.moveTo(0, -s.height / 2 - p); ctx.lineTo(s.width / 2 + p, 0); ctx.lineTo(0, s.height / 2 + p); ctx.lineTo(-s.width / 2 - p, 0); ctx.closePath(); ctx.stroke(); }
      else ctx.strokeRect(-s.width / 2 - p, -s.height / 2 - p, s.width + p * 2, s.height + p * 2);
      ctx.restore();
    }
  }

  // selection
  const sel = r.elements.filter((e) => r.selected.has(e.id) && !e.isDeleted);
  if (sel.length && r.editingId == null) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = dark ? "#232329" : "#ffffff";
    ctx.lineWidth = 1.4 / zoom;
    const geo = selectionGeometry(sel, zoom);
    const locked = sel.every((e) => e.locked);
    if (sel.length > 1) {
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      for (const e of sel) {
        const c = center(e);
        ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(e.angle);
        ctx.strokeRect(-e.width / 2 - 3 / zoom, -e.height / 2 - 3 / zoom, e.width + 6 / zoom, e.height + 6 / zoom);
        ctx.restore();
      }
      ctx.setLineDash([]);
    }
    if (geo && !geo.linear) {
      ctx.save();
      ctx.translate(geo.cx, geo.cy); ctx.rotate(geo.angle);
      if (locked) ctx.setLineDash([6 / zoom, 5 / zoom]);
      if (sel.length === 1 || true) ctx.strokeRect(-geo.w / 2 - geo.pad, -geo.h / 2 - geo.pad, geo.w + geo.pad * 2, geo.h + geo.pad * 2);
      ctx.restore();
      if (!locked) {
        const hs = HANDLE_PX / zoom;
        for (const [k, p] of Object.entries(geo.handles) as [HandleId, Pt][]) {
          ctx.beginPath();
          if (k === "rotate") ctx.arc(p[0], p[1], hs * 0.62, 0, Math.PI * 2);
          else { ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(geo.angle); ctx.roundRect(-hs / 2, -hs / 2, hs, hs, 2 / zoom); ctx.restore(); }
          ctx.fill(); ctx.stroke();
        }
      }
    }
    if (geo?.linear && !locked) {
      const hs = 5.5 / zoom;
      for (const p of geo.linear.mids) { ctx.beginPath(); ctx.arc(p[0], p[1], hs * 0.55, 0, Math.PI * 2); ctx.globalAlpha = 0.6; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; }
      geo.linear.pts.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p[0], p[1], hs, 0, Math.PI * 2);
        ctx.fillStyle = r.linearHover === i ? accent : dark ? "#232329" : "#fff";
        ctx.fill(); ctx.stroke();
      });
    }
    ctx.restore();
  }

  if (r.marquee) {
    ctx.save();
    ctx.fillStyle = accent; ctx.globalAlpha = 0.08;
    ctx.fillRect(r.marquee.x, r.marquee.y, r.marquee.w, r.marquee.h);
    ctx.globalAlpha = 0.9; ctx.strokeStyle = accent; ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(r.marquee.x, r.marquee.y, r.marquee.w, r.marquee.h);
    ctx.restore();
  }

  // remote cursors (screen space)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const p of r.peers) {
    if (p.x == null || p.y == null) continue;
    const sx = (p.x + scrollX) * zoom, sy = (p.y + scrollY) * zoom;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = p.color; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16); ctx.lineTo(4.4, 12.3); ctx.lineTo(8.6, 19.5); ctx.lineTo(11.2, 18); ctx.lineTo(7, 11); ctx.lineTo(12.5, 11); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.font = "600 12px Nunito, system-ui, sans-serif";
    const tw = ctx.measureText(p.name).width;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.roundRect(12, 18, tw + 14, 20, 10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(p.name, 19, 28.5);
    ctx.restore();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, r: SceneRender) {
  const { zoom, scrollX, scrollY } = r;
  const step = 20;
  const x0 = Math.floor(-scrollX / step) * step, y0 = Math.floor(-scrollY / step) * step;
  const x1 = -scrollX + r.width / zoom, y1 = -scrollY + r.height / zoom;
  const minor = r.dark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)";
  const major = r.dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1 / zoom;
  for (let x = x0; x <= x1; x += step) {
    ctx.strokeStyle = Math.round(x / step) % 5 === 0 ? major : minor;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  }
  for (let y = y0; y <= y1; y += step) {
    ctx.strokeStyle = Math.round(y / step) % 5 === 0 ? major : minor;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }
}
