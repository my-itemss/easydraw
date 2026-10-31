import rough from "roughjs";
import type { El, SceneFile } from "../types";
import { darkColor } from "./colors";
import { center, commonBounds } from "./elements";
import { buildDrawables, drawElement, freedrawPath, labelLines } from "./render";
import { FONTS, LINE_HEIGHT } from "./text";
import { labelFont } from "./text";

export interface ExportOpts {
  scale: number;
  dark: boolean;
  background: boolean;
  canvasBg: string;
  padding?: number;
}

const visible = (els: El[]) => els.filter((e) => !e.isDeleted);

function preload(els: El[]) {
  return Promise.all(
    els.filter((e) => e.type === "image" && e.src).map(
      (e) => new Promise<void>((res) => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = e.src!; }),
    ),
  );
}

export async function exportToCanvas(elements: El[], o: ExportOpts): Promise<HTMLCanvasElement | null> {
  const els = visible(elements);
  const b = commonBounds(els);
  if (!b) return null;
  await preload(els);
  const pad = o.padding ?? 24;
  const w = Math.ceil(b[2] - b[0] + pad * 2), h = Math.ceil(b[3] - b[1] + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w * o.scale; canvas.height = h * o.scale;
  const ctx = canvas.getContext("2d")!;
  if (o.background) { ctx.fillStyle = o.dark ? darkColor(o.canvasBg) : o.canvasBg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.scale(o.scale, o.scale);
  ctx.translate(pad - b[0], pad - b[1]);
  const rc = rough.canvas(canvas);
  for (const el of els) drawElement(ctx, rc, el, o.dark);
  return canvas;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function exportToSvg(elements: El[], o: ExportOpts): string | null {
  const els = visible(elements);
  const b = commonBounds(els);
  if (!b) return null;
  const pad = o.padding ?? 24;
  const w = Math.ceil(b[2] - b[0] + pad * 2), h = Math.ceil(b[3] - b[1] + pad * 2);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", String(w * o.scale));
  svg.setAttribute("height", String(h * o.scale));
  const rs = rough.svg(svg);
  if (o.background) {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("width", "100%"); r.setAttribute("height", "100%");
    r.setAttribute("fill", o.dark ? darkColor(o.canvasBg) : o.canvasBg);
    svg.appendChild(r);
  }
  const fill = (c: string) => (o.dark ? darkColor(c) : c);
  for (const el of els) {
    const g = document.createElementNS(NS, "g");
    const c = center(el);
    g.setAttribute("transform", `translate(${c[0] - b[0] + pad} ${c[1] - b[1] + pad}) rotate(${(el.angle * 180) / Math.PI}) translate(${-el.width / 2} ${-el.height / 2})`);
    g.setAttribute("opacity", String(el.opacity / 100));
    g.setAttribute("stroke-linecap", "round");
    g.setAttribute("stroke-linejoin", "round");
    const text = (lines: string[], size: number, family: keyof typeof FONTS, anchor: string, x: number, top: number, color: string) => {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("font-family", FONTS[family]); t.setAttribute("font-size", String(size));
      t.setAttribute("text-anchor", anchor); t.setAttribute("fill", fill(color));
      t.setAttribute("dominant-baseline", "central");
      lines.forEach((l, i) => {
        const s = document.createElementNS(NS, "tspan");
        s.setAttribute("x", String(x)); s.setAttribute("y", String(top + (i + 0.5) * size * LINE_HEIGHT));
        s.setAttribute("xml:space", "preserve");
        s.innerHTML = esc(l) || " ";
        t.appendChild(s);
      });
      g.appendChild(t);
    };
    if (el.type === "freedraw") {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", freedrawPath(el)); p.setAttribute("fill", fill(el.strokeColor));
      g.appendChild(p);
    } else if (el.type === "text") {
      const size = el.fontSize ?? 20;
      const a = el.textAlign ?? "left";
      text((el.text ?? "").split("\n"), size, el.fontFamily ?? "hand", a === "left" ? "start" : a === "center" ? "middle" : "end", a === "left" ? 0 : a === "center" ? el.width / 2 : el.width, 0, el.strokeColor);
    } else if (el.type === "image" && el.src) {
      const im = document.createElementNS(NS, "image");
      im.setAttribute("href", el.src); im.setAttribute("width", String(el.width)); im.setAttribute("height", String(el.height));
      im.setAttribute("preserveAspectRatio", "none");
      g.appendChild(im);
    } else {
      for (const d of buildDrawables(el, o.dark)) g.appendChild(rs.draw(d));
      if (el.text && el.type !== "arrow" && el.type !== "line") {
        const { lines, size, lh } = labelLines(el);
        text(lines, size, labelFont(el).family, "middle", el.width / 2, el.height / 2 - (lines.length * lh) / 2, el.strokeColor);
      }
    }
    svg.appendChild(g);
  }
  return new XMLSerializer().serializeToString(svg);
}

/* ---------------- files ---------------- */

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const canvasToBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));

export function sceneToJson(elements: El[], canvasBg: string, grid: boolean): string {
  const file: SceneFile = { type: "easydraw", version: 1, elements: visible(elements), appState: { canvasBg, grid } };
  return JSON.stringify(file);
}

export function parseScene(text: string): SceneFile | null {
  try {
    const j = JSON.parse(text);
    if (j && Array.isArray(j.elements)) return { type: "easydraw", version: 1, elements: j.elements, appState: { canvasBg: j.appState?.canvasBg ?? "#ffffff", grid: !!j.appState?.grid } };
  } catch { /* ignore */ }
  return null;
}

/** Read an image file, downscale if huge, return a data URL + natural size. */
export function readImage(file: File, max = 1600): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        if (s === 1 && file.type === "image/svg+xml") return resolve({ src: fr.result as string, width: img.naturalWidth || 300, height: img.naturalHeight || 300 });
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const png = file.type === "image/png" || file.type === "image/gif" || file.type === "image/webp";
        resolve({ src: c.toDataURL(png ? "image/png" : "image/jpeg", 0.88), width: c.width, height: c.height });
      };
      img.src = fr.result as string;
    };
    fr.readAsDataURL(file);
  });
}
