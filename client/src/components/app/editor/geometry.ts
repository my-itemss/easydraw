import type { CanvasElement, DiagramType } from "../../../lib/types";
import { uid } from "../../../lib/files";
import { renderDiagram } from "../../../lib/engine";

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Tool = "select" | "hand" | "pen" | "eraser" | "note" | "text" | "rect" | "ellipse" | "diamond" | "arrow" | "image" | "comment";

export const NOTE_COLORS = ["#fde68a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#e9d5ff"];
export const INK_COLORS = ["#18181b", "#ef4444", "#f97316", "#eab308", "#22a55e", "#3b82f6", "#8b5cf6", "#ec4899"];

export function bounds(e: CanvasElement): Box {
  if (e.kind === "arrow") {
    const x = Math.min(e.x, e.x2);
    const y = Math.min(e.y, e.y2);
    return { x, y, w: Math.abs(e.x2 - e.x), h: Math.abs(e.y2 - e.y) };
  }
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

export const intersects = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function moveBy(e: CanvasElement, dx: number, dy: number): CanvasElement {
  if (e.kind === "arrow") return { ...e, x: e.x + dx, y: e.y + dy, x2: e.x2 + dx, y2: e.y2 + dy };
  if (e.kind === "stroke") return { ...e, x: e.x + dx, y: e.y + dy, points: e.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
  return { ...e, x: e.x + dx, y: e.y + dy };
}

export function resizeTo(e: CanvasElement, b: Box): CanvasElement {
  if (e.kind === "stroke") {
    const sx = e.w ? b.w / e.w : 1;
    const sy = e.h ? b.h / e.h : 1;
    return { ...e, x: b.x, y: b.y, w: b.w, h: b.h, points: e.points.map((v, i) => (i % 2 === 0 ? b.x + (v - e.x) * sx : b.y + (v - e.y) * sy)) };
  }
  if (e.kind === "arrow") return e;
  return { ...e, x: b.x, y: b.y, w: b.w, h: b.h };
}

export const minSize = (e: CanvasElement) => (e.kind === "diagram" ? { w: 200, h: 140 } : e.kind === "stroke" ? { w: 4, h: 4 } : { w: 40, h: 28 });

export function strokeFrom(points: number[], color: string, size: number): CanvasElement {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]!);
    maxX = Math.max(maxX, points[i]!);
    minY = Math.min(minY, points[i + 1]!);
    maxY = Math.max(maxY, points[i + 1]!);
  }
  return { id: uid(), kind: "stroke", x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY), points, color, size };
}

export function hitStroke(e: Extract<CanvasElement, { kind: "stroke" }>, p: Pt, r: number): boolean {
  const pad = r + e.size;
  if (p.x < e.x - pad || p.x > e.x + e.w + pad || p.y < e.y - pad || p.y > e.y + e.h + pad) return false;
  const pts = e.points;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const ax = pts[i]!;
    const ay = pts[i + 1]!;
    const bx = pts[i + 2] ?? ax;
    const by = pts[i + 3] ?? ay;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2)) : 0;
    if (Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy)) <= pad) return true;
  }
  return false;
}

export function makeElement(tool: Tool, at: Pt, drag?: Pt): CanvasElement | null {
  const big = drag && Math.hypot(drag.x - at.x, drag.y - at.y) > 8;
  const x = big ? Math.min(at.x, drag!.x) : at.x;
  const y = big ? Math.min(at.y, drag!.y) : at.y;
  const w = big ? Math.abs(drag!.x - at.x) : 0;
  const h = big ? Math.abs(drag!.y - at.y) : 0;
  switch (tool) {
    case "note":
      return { id: uid(), kind: "note", x, y, w: Math.max(w, big ? 100 : 180), h: Math.max(h, big ? 80 : 140), text: "", color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]! };
    case "text":
      return { id: uid(), kind: "text", x, y, w: Math.max(w, big ? 60 : 220), h: Math.max(h, 32), text: "", fontSize: 18, color: "#18181b" };
    case "rect":
    case "ellipse":
    case "diamond":
      return { id: uid(), kind: "shape", shape: tool, x, y, w: Math.max(w, big ? 40 : 150), h: Math.max(h, big ? 30 : 90), text: "", stroke: "#18181b", fill: "transparent" };
    default:
      return null;
  }
}

// ---- cached svg rendering (dragging a diagram must not re-render it every frame)
const cache = new Map<string, string>();
export function renderCached(code: string, type: DiagramType, theme: "light" | "dark"): string {
  const key = `${theme}|${type}|${code}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const svg = renderDiagram(code, type, { theme }).svg;
  cache.set(key, svg);
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return svg;
}

export function fitView(els: CanvasElement[], w: number, h: number): { x: number; y: number; z: number } {
  if (!els.length) return { x: w / 2, y: h / 2, z: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of els) {
    const b = bounds(e);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const pad = 80;
  const z = Math.max(0.1, Math.min(1.5, Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1))));
  return { z, x: (w - (maxX - minX) * z) / 2 - minX * z, y: (h - (maxY - minY) * z) / 2 - minY * z };
}
