import { Hono } from "hono";
import { loadFile, requireUser, resolveFileAccess, user, type AppEnv } from "../auth";
import { all, db, get, getFile, newId, now, run, toComment } from "../db";
import { HttpError, readJson, strField } from "../util";

export const commentRoutes = new Hono<AppEnv>();
const R = requireUser;

const SELECT = `SELECT c.*, u.name AS author_name, u.avatar_color AS avatar_color FROM comments c JOIN users u ON u.id = c.author_id`;
type CRow = Parameters<typeof toComment>[0];

commentRoutes.get("/files/:id/comments", R, (c) => {
  const { file } = loadFile(c, c.req.param("id"));
  return c.json(all<CRow>(`${SELECT} WHERE c.file_id = ? ORDER BY c.created_at ASC, c.rowid ASC`, file.id).map(toComment));
});

function validAnchor(a: unknown): string | null {
  if (a === undefined || a === null) return null;
  if (typeof a !== "object" || Array.isArray(a)) throw new HttpError(400, "anchor must be an object");
  const o = a as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (o.elementId !== undefined) {
    if (typeof o.elementId !== "string" || o.elementId.length > 100) throw new HttpError(400, "Invalid anchor");
    out.elementId = o.elementId;
  }
  for (const k of ["x", "y"]) {
    if (o[k] !== undefined) {
      if (typeof o[k] !== "number" || !Number.isFinite(o[k] as number)) throw new HttpError(400, "Invalid anchor");
      out[k] = o[k];
    }
  }
  return JSON.stringify(out);
}

commentRoutes.post("/files/:id/comments", R, async (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"));
  const b = await readJson(c);
  const body = strField(b.body, "body", 4000, { required: true })!;
  let parentId: string | null = null;
  if (b.parentId !== undefined && b.parentId !== null) {
    const p = typeof b.parentId === "string" ? get<{ id: string; parent_id: string | null }>("SELECT id, parent_id FROM comments WHERE id = ? AND file_id = ?", b.parentId, file.id) : null;
    if (!p) throw new HttpError(400, "Parent comment not found");
    parentId = p.parent_id ?? p.id; // single-level threads
  }
  const id = newId();
  run("INSERT INTO comments (id,file_id,parent_id,author_id,body,anchor,resolved,created_at) VALUES (?,?,?,?,?,?,0,?)", id, file.id, parentId, u.id, body, validAnchor(b.anchor), now());
  return c.json(toComment(get<CRow>(`${SELECT} WHERE c.id = ?`, id)!), 201);
});

commentRoutes.patch("/comments/:cid", R, async (c) => {
  const u = user(c);
  const row = get<CRow>(`${SELECT} WHERE c.id = ?`, c.req.param("cid"));
  const file = row ? getFile(row.file_id) : null;
  const access = file ? resolveFileAccess(file, u) : null;
  if (!row || !access) throw new HttpError(404, "Comment not found");
  const b = await readJson(c);
  if (b.resolved !== undefined) {
    if (typeof b.resolved !== "boolean") throw new HttpError(400, "resolved must be a boolean");
    if (access === "view") throw new HttpError(403, "You have view-only access");
    run("UPDATE comments SET resolved = ? WHERE id = ?", b.resolved ? 1 : 0, row.id);
  }
  if (b.body !== undefined) {
    if (row.author_id !== u.id) throw new HttpError(403, "Only the author can edit a comment");
    run("UPDATE comments SET body = ? WHERE id = ?", strField(b.body, "body", 4000, { required: true })!, row.id);
  }
  return c.json(toComment(get<CRow>(`${SELECT} WHERE c.id = ?`, row.id)!));
});

commentRoutes.delete("/comments/:cid", R, (c) => {
  const u = user(c);
  const row = get<CRow>(`${SELECT} WHERE c.id = ?`, c.req.param("cid"));
  const file = row ? getFile(row.file_id) : null;
  const access = file ? resolveFileAccess(file, u) : null;
  if (!row || !access) throw new HttpError(404, "Comment not found");
  if (row.author_id !== u.id && access !== "owner") throw new HttpError(403, "Only the author or file owner can delete a comment");
  db.transaction(() => {
    run("DELETE FROM comments WHERE parent_id = ?", row.id);
    run("DELETE FROM comments WHERE id = ?", row.id);
  })();
  return c.json({ ok: true });
});
