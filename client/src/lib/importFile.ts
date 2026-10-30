import { contentWithDiagram, uid } from "./files";
import { convertToDiagram, detectFileKind } from "./convert";
import type { CanvasElement, FileContent } from "./types";

export interface Imported {
  title: string;
  content: FileContent;
  warnings: string[];
}

const baseName = (n: string) => n.replace(/\.[^.]+$/, "") || "Imported";

/** Turns a user-chosen file (json, md, sql, tf, docker-compose) into easydraw file content. Throws a friendly Error. */
export async function importFile(file: File): Promise<Imported> {
  if (file.size > 6 * 1024 * 1024) throw new Error("That file is too large (max 6 MB).");
  const text = await file.text();
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) {
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error("That file is not valid JSON.");
    }
    const c = j?.content ?? j;
    if (!c || typeof c.doc !== "string" || !Array.isArray(c.canvas?.elements)) throw new Error("This JSON is not an easydraw export.");
    return { title: typeof j.title === "string" ? j.title : baseName(name), content: { doc: c.doc, canvas: { elements: c.canvas.elements as CanvasElement[] } }, warnings: [] };
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    // eraser-* fences stay in the document and render live; nothing to convert
    return { title: baseName(name), content: { doc: text, canvas: { elements: [] } }, warnings: [] };
  }
  const kind = detectFileKind(name, text);
  if (!kind) throw new Error("Unsupported file. Use .json, .md, .sql, .tf or docker-compose.yml.");
  const r = convertToDiagram(kind, text);
  const title = baseName(name);
  return { title, content: contentWithDiagram(r.diagramType, r.code, title), warnings: r.warnings };
}

export function downloadBlob(data: Blob | string, filename: string, type = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const safeFileName = (t: string) => t.replace(/[^\w.-]+/g, "_").slice(0, 60) || "easydraw";
export { uid };
