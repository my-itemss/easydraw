import type { Context } from "hono";
import type { CanvasElement, DiagramType, FileContent } from "../client/src/lib/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const MAX_BODY = 8 * 1024 * 1024;
export const MAX_CODE = 200 * 1024;
export const DIAGRAM_TYPES: DiagramType[] = ["flowchart", "architecture", "sequence", "erd"];
export const isDiagramType = (v: unknown): v is DiagramType => typeof v === "string" && (DIAGRAM_TYPES as string[]).includes(v);

export async function readJson<T = any>(c: Context, optional = false): Promise<T> {
  let v: unknown;
  try {
    const text = await c.req.text();
    if (optional && text.trim() === "") return {} as T;
    v = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new HttpError(400, "Body must be a JSON object");
  return v as T;
}

/** Validates an optional string field with length bounds; returns trimmed value or undefined. */
export function strField(v: unknown, name: string, max: number, opts: { required?: boolean; min?: number; trim?: boolean } = {}): string | undefined {
  if (v === undefined || v === null) {
    if (opts.required) throw new HttpError(400, `${name} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new HttpError(400, `${name} must be a string`);
  const s = opts.trim === false ? v : v.trim();
  if (opts.required && s.length === 0) throw new HttpError(400, `${name} is required`);
  if (s.length > max) throw new HttpError(400, `${name} is too long (max ${max})`);
  if (opts.min && s.length < opts.min) throw new HttpError(400, `${name} is too short (min ${opts.min})`);
  return s;
}

export const normEmail = (e: unknown): string => {
  const s = typeof e === "string" ? e.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 254) throw new HttpError(400, "Enter a valid email address");
  return s;
};

const KINDS = new Set(["diagram", "note", "text", "shape", "arrow", "stroke", "image"]);

export function validateElement(e: unknown): CanvasElement {
  if (!e || typeof e !== "object") throw new HttpError(400, "Invalid element");
  const el = e as any;
  if (typeof el.id !== "string" || !el.id || el.id.length > 100) throw new HttpError(400, "Element ids must be strings");
  if (typeof el.kind !== "string" || !KINDS.has(el.kind)) throw new HttpError(400, "Invalid element kind");
  if (el.kind === "diagram") {
    if (!isDiagramType(el.diagramType)) throw new HttpError(400, "Invalid diagramType");
    if (typeof el.code !== "string") throw new HttpError(400, "Diagram code must be a string");
    if (el.code.length > MAX_CODE) throw new HttpError(413, "Diagram code too large (max 200KB)");
  }
  return el as CanvasElement;
}

export function validateContent(c: unknown): FileContent {
  const v = c as any;
  if (!v || typeof v !== "object" || typeof v.doc !== "string" || !v.canvas || !Array.isArray(v.canvas.elements)) {
    throw new HttpError(400, "content must be {doc: string, canvas: {elements: []}}");
  }
  v.canvas.elements.forEach(validateElement);
  if (JSON.stringify(v).length > MAX_BODY) throw new HttpError(413, "Content too large (max 8MB)");
  return { doc: v.doc, canvas: { elements: v.canvas.elements } };
}

const SVG_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  "X-Content-Type-Options": "nosniff",
};

export function svgResponse(svg: string, extra: Record<string, string> = {}): Response {
  return new Response(svg, { headers: { ...SVG_HEADERS, ...extra } });
}

export const clientIp = (c: Context): string =>
  c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";

export const originOf = (c: Context): string => new URL(c.req.url).origin;
