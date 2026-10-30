import { ApiError } from "../../lib/api";
import { renderDiagram } from "../../lib/engine";
import type { DiagramType } from "../../lib/types";

export const DIAGRAM_LABELS: Record<DiagramType, string> = {
  flowchart: "Flowchart",
  architecture: "Architecture",
  sequence: "Sequence",
  erd: "ERD",
};

/** Turns any thrown value into a short, actionable sentence for the visitor. */
export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0)
      return "We could not reach the easydraw server. If you are running it locally, start it with `cd server && bun index.ts` (it listens on port 3001), then try again.";
    if (e.status === 429) return "You have hit the free usage limit for now (120 AI requests per hour). Wait a while and try again.";
    if (e.status === 502) return `The server could not complete that request: ${e.message}`;
    if (e.status === 413) return "That input is too large. Try something shorter.";
    return e.message || "Something went wrong. Please try again.";
  }
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}

export function readSession(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
export function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "diagram"
  );
}

/** A short human title from a free-form prompt. */
export function titleFromPrompt(p: string, fallback = "Untitled diagram"): string {
  const t = p.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  if (!t) return fallback;
  return t.length > 60 ? t.slice(0, 57).trimEnd() + "..." : t;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** SVG for export: always light theme on a white background so it looks right anywhere. */
export function exportSvg(code: string, type: DiagramType) {
  return renderDiagram(code, type, { theme: "light", background: true });
}

export function svgToPngBlob(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w * h * scale * scale > 64_000_000) {
      reject(new Error("This diagram is too large to export as PNG. Download the SVG instead."));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available in this browser.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed. Download the SVG instead."))), "image/png");
      } catch (err) {
        reject(err instanceof Error ? err : new Error("PNG export failed."));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterise this diagram. Download the SVG instead."));
    };
    img.src = url;
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
