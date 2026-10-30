import type { CanvasElement, FileContent, FileSummary } from "../client/src/lib/types";
import { renderDiagram } from "../client/src/lib/engine";
import { db, getFile, maybeAutoVersion, newId, now, parseContent, run, toSummary, writeContent, type FileRow } from "./db";
import { HttpError, MAX_BODY, strField, validateElement } from "./util";
import type { Access } from "./auth";

export const fullOf = (row: FileRow, access: Access): FileSummary & { content: FileContent } => ({
  ...toSummary(row, access),
  content: parseContent(row),
});

export interface OpsBody {
  upsert?: unknown;
  remove?: unknown;
  doc?: unknown;
  title?: unknown;
}

/** Merges ops into a file's stored content atomically. Returns new updatedAt. */
export function applyOps(fileId: string, body: OpsBody, actor: { id: string | null; name: string }): number {
  if (body.upsert !== undefined && !Array.isArray(body.upsert)) throw new HttpError(400, "upsert must be an array");
  if (body.remove !== undefined && (!Array.isArray(body.remove) || body.remove.some((x) => typeof x !== "string"))) throw new HttpError(400, "remove must be an array of ids");
  if (body.doc !== undefined && typeof body.doc !== "string") throw new HttpError(400, "doc must be a string");
  const title = strField(body.title, "title", 200, { min: 1 });
  const upsert = ((body.upsert as unknown[]) ?? []).map(validateElement);
  const remove = new Set((body.remove as string[]) ?? []);

  return db.transaction(() => {
    const file = getFile(fileId);
    if (!file) throw new HttpError(404, "File not found");
    const content = parseContent(file);
    maybeAutoVersion(file, actor.id, actor.name);
    let els = content.canvas.elements.filter((e) => !remove.has(e.id));
    for (const u of upsert) {
      const i = els.findIndex((e) => e.id === u.id);
      if (i >= 0) els[i] = u;
      else els.push(u);
    }
    content.canvas.elements = els;
    if (typeof body.doc === "string") content.doc = body.doc;
    if (JSON.stringify(content).length > MAX_BODY) throw new HttpError(413, "Content too large (max 8MB)");
    return writeContent(fileId, content, title ? { title } : {});
  })();
}

export function insertFile(o: { title: string; teamId: string; ownerId: string; folderId: string | null; content: FileContent }): FileRow {
  const id = newId();
  const t = now();
  const content = JSON.stringify(o.content);
  run(
    "INSERT INTO files (id,title,folder_id,team_id,owner_id,private,trashed,link_access,share_token,content,preview,last_auto_version_at,created_at,updated_at) VALUES (?,?,?,?,?,0,0,'none',?,?,?,0,?,?)",
    id, o.title, o.folderId, o.teamId, o.ownerId, crypto.randomUUID().replace(/-/g, "").slice(0, 16), content, null, t, t,
  );
  writeContent(id, o.content);
  run("UPDATE files SET created_at = ?, updated_at = ? WHERE id = ?", t, t, id);
  return getFile(id)!;
}

// ---------- rendering / export ----------
type DiagramEl = Extract<CanvasElement, { kind: "diagram" }>;

export function findDiagram(content: FileContent, id?: string): DiagramEl {
  const els = content.canvas.elements.filter((e): e is DiagramEl => e.kind === "diagram");
  const el = id ? els.find((e) => e.id === id) : els[0];
  if (!el) throw new HttpError(404, "Diagram not found");
  return el;
}

export function renderSvg(el: { code: string; diagramType: DiagramEl["diagramType"] }, theme: unknown, background = false): string {
  try {
    return renderDiagram(el.code, el.diagramType, { theme: theme === "dark" ? "dark" : "light", background }).svg;
  } catch {
    throw new HttpError(422, "Could not render diagram");
  }
}

export function exportMarkdown(content: FileContent): string {
  const byId = new Map(content.canvas.elements.filter((e): e is DiagramEl => e.kind === "diagram").map((e) => [e.id, e]));
  return content.doc.replace(/```diagram:([A-Za-z0-9_-]+)[^\n]*\n(?:[\s\S]*?\n)?```/g, (m, id: string) => {
    const el = byId.get(id);
    return el ? "```eraser\n" + el.code.replace(/\n+$/, "") + "\n```" : m;
  });
}

export const safeName = (t: string) => t.replace(/[^\w.-]+/g, "_").slice(0, 80) || "file";
