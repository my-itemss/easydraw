import type { CanvasElement } from "../../../lib/types";
import { bounds, renderCached } from "./geometry";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrapLines(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      if ((line + " " + word).trim().length > maxChars && line) {
        out.push(line);
        line = word;
      } else line = (line + " " + word).trim();
    }
    out.push(line);
  }
  return out;
}

function textBlock(text: string, x: number, y: number, w: number, size: number, fill: string, anchor: "start" | "middle" = "start", h?: number): string {
  const lines = wrapLines(text, Math.max(4, Math.floor(w / (size * 0.56))));
  const lh = size * 1.35;
  const top = h !== undefined ? y + (h - lines.length * lh) / 2 : y;
  const px = anchor === "middle" ? x + w / 2 : x;
  return lines
    .map((l, i) => `<text x="${px}" y="${top + lh * (i + 0.8)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-family="Inter,system-ui,sans-serif">${esc(l)}</text>`)
    .join("");
}

function fragment(el: CanvasElement, theme: "light" | "dark"): string {
  const fg = theme === "dark" ? "#f4f4f5" : "#18181b";
  switch (el.kind) {
    case "diagram": {
      const svg = renderCached(el.code, el.diagramType, theme);
      const open = svg.match(/<svg([^>]*)>/);
      const vb = open?.[1]?.match(/viewBox="([^"]+)"/)?.[1];
      if (!open || !vb) return "";
      const inner = svg.slice(open.index! + open[0].length).replace(/<\/svg>\s*$/, "");
      return `<svg x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${inner}</svg>`;
    }
    case "note":
      return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="6" fill="${el.color}"/>` + textBlock(el.text, el.x + 12, el.y + 10, el.w - 24, 15, "#27272a");
    case "text":
      return textBlock(el.text, el.x, el.y, el.w, el.fontSize, el.color === "#18181b" ? fg : el.color);
    case "shape": {
      const stroke = el.stroke === "#18181b" ? fg : el.stroke;
      const fill = el.fill || "none";
      let s: string;
      if (el.shape === "ellipse") s = `<ellipse cx="${el.x + el.w / 2}" cy="${el.y + el.h / 2}" rx="${el.w / 2}" ry="${el.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      else if (el.shape === "diamond") s = `<polygon points="${el.x + el.w / 2},${el.y} ${el.x + el.w},${el.y + el.h / 2} ${el.x + el.w / 2},${el.y + el.h} ${el.x},${el.y + el.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      else s = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      return s + (el.text ? textBlock(el.text, el.x + 8, el.y, el.w - 16, 14, fg, "middle", el.h) : "");
    }
    case "arrow": {
      const c = el.color === "#18181b" ? fg : el.color;
      const a = Math.atan2(el.y2 - el.y, el.x2 - el.x);
      const hx = (d: number) => el.x2 - 12 * Math.cos(a + d);
      const hy = (d: number) => el.y2 - 12 * Math.sin(a + d);
      return `<line x1="${el.x}" y1="${el.y}" x2="${el.x2}" y2="${el.y2}" stroke="${c}" stroke-width="2.2" stroke-linecap="round"${el.dashed ? ' stroke-dasharray="6 5"' : ""}/><polygon points="${el.x2},${el.y2} ${hx(0.45)},${hy(0.45)} ${hx(-0.45)},${hy(-0.45)}" fill="${c}"/>`;
    }
    case "stroke": {
      const c = el.color === "#18181b" ? fg : el.color;
      let d = `M${el.points[0]} ${el.points[1]}`;
      for (let i = 2; i < el.points.length; i += 2) d += `L${el.points[i]} ${el.points[i + 1]}`;
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${el.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case "image":
      return `<image x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" href="${esc(el.src)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
}

export interface Composed {
  svg: string;
  width: number;
  height: number;
}

/** Builds a single standalone SVG of the given canvas elements. */
export function composeSvg(elements: CanvasElement[], theme: "light" | "dark", background = true): Composed {
  const pad = 40;
  if (!elements.length) return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><text x="200" y="100" text-anchor="middle" fill="#888" font-family="sans-serif">Empty canvas</text></svg>`, width: 400, height: 200 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const e of elements) {
    const b = bounds(e);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const w = Math.ceil(maxX - minX + pad * 2);
  const h = Math.ceil(maxY - minY + pad * 2);
  const body = elements.map((e) => fragment(e, theme)).join("");
  const bg = background ? `<rect x="${minX - pad}" y="${minY - pad}" width="${w}" height="${h}" fill="${theme === "dark" ? "#0d0d11" : "#ffffff"}"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX - pad} ${minY - pad} ${w} ${h}">${bg}${body}</svg>`;
  return { svg, width: w, height: h };
}

export async function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Could not rasterize the SVG."));
      img.src = url;
    });
    const cv = document.createElement("canvas");
    const s = Math.min(scale, 8000 / Math.max(width, height));
    cv.width = Math.round(width * s);
    cv.height = Math.round(height * s);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("PNG export failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
