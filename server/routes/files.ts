import { Hono } from "hono";
import type { FileSummary, LinkAccess } from "../../client/src/lib/types";
import { activeTeam, audit, loadFile, requireUser, resolveFileAccess, user, type AppEnv } from "../auth";
import { all, db, DEFAULT_CONTENT, get, getFile, maybeAutoVersion, parseContent, run, teamRole, toSummary, writeContent, type FileRow } from "../db";
import { applyOps, exportMarkdown, findDiagram, fullOf, insertFile, renderSvg, safeName } from "../filesvc";
import { HttpError, readJson, strField, svgResponse, validateContent } from "../util";

export const filesRoutes = new Hono<AppEnv>();
const R = requireUser;

const FILTERS = ["all", "mine", "shared", "recent", "trash"];

filesRoutes.get("/", R, (c) => {
  const u = user(c);
  const { teamId, role } = activeTeam(u);
  const filter = c.req.query("filter") ?? "all";
  if (!FILTERS.includes(filter)) throw new HttpError(400, "Invalid filter");
  const folderId = c.req.query("folderId");
  const q = (c.req.query("q") ?? "").trim().slice(0, 200);

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter === "shared") {
    where.push("f.owner_id != ?", "f.id IN (SELECT file_id FROM file_members WHERE user_id = ?)");
    params.push(u.id, u.id);
  } else {
    where.push("f.team_id = ?");
    params.push(teamId);
    if (filter === "mine") (where.push("f.owner_id = ?"), params.push(u.id));
  }
  where.push(filter === "trash" ? "f.trashed = 1" : "f.trashed = 0");
  if (folderId !== undefined && folderId !== "") {
    if (folderId === "root") where.push("f.folder_id IS NULL");
    else (where.push("f.folder_id = ?"), params.push(folderId));
  }
  if (q) (where.push("f.title LIKE ? ESCAPE '\\'"), params.push("%" + q.replace(/[\\%_]/g, "\\$&") + "%"));

  const rows = all<FileRow>(
    `SELECT f.*, o.name AS owner_name FROM files f JOIN users o ON o.id = f.owner_id WHERE ${where.join(" AND ")} ORDER BY f.updated_at DESC`,
    ...params,
  );
  const fileRoles = new Map(all<{ file_id: string; role: "viewer" | "editor" }>("SELECT file_id, role FROM file_members WHERE user_id = ?", u.id).map((r) => [r.file_id, r.role]));
  const roleCache = new Map<string, ReturnType<typeof teamRole>>([[teamId, role]]);
  const out: FileSummary[] = [];
  for (const r of rows) {
    if (!roleCache.has(r.team_id)) roleCache.set(r.team_id, teamRole(r.team_id, u.id));
    const access = resolveFileAccess(r, u, { role: roleCache.get(r.team_id) ?? null, fileRole: fileRoles.get(r.id) ?? null });
    if (access) out.push(toSummary(r, access));
    if (filter === "recent" && out.length >= 12) break;
  }
  return c.json(out);
});

filesRoutes.post("/", R, async (c) => {
  const u = user(c);
  const { teamId, role } = activeTeam(u);
  if (role === "guest") throw new HttpError(403, "Guests cannot create files");
  const b = await readJson(c);
  const title = strField(b.title, "title", 200) || "Untitled";
  let folderId: string | null = null;
  if (b.folderId !== undefined && b.folderId !== null) {
    if (typeof b.folderId !== "string" || !get("SELECT 1 FROM folders WHERE id = ? AND team_id = ?", b.folderId, teamId)) throw new HttpError(400, "Folder not found");
    folderId = b.folderId;
  }
  const content = b.content === undefined ? DEFAULT_CONTENT() : validateContent(b.content);
  const f = insertFile({ title, teamId, ownerId: u.id, folderId, content });
  audit(teamId, u, "file.create", f.title);
  return c.json(fullOf(f, "owner"), 201);
});

filesRoutes.get("/:id", R, (c) => {
  const { file, access } = loadFile(c, c.req.param("id"));
  return c.json(fullOf(file, access));
});

filesRoutes.patch("/:id", R, async (c) => {
  const u = user(c);
  const { file, access } = loadFile(c, c.req.param("id"), "edit");
  const b = await readJson(c);
  const title = strField(b.title, "title", 200, { min: 1 });
  if ((b.folderId !== undefined || b.private !== undefined) && access !== "owner") throw new HttpError(403, "Only the owner can do that");
  if (b.private !== undefined && typeof b.private !== "boolean") throw new HttpError(400, "private must be a boolean");
  if (b.trashed !== undefined && typeof b.trashed !== "boolean") throw new HttpError(400, "trashed must be a boolean");
  let folderId: string | null | undefined;
  if (b.folderId !== undefined) {
    if (b.folderId !== null && (typeof b.folderId !== "string" || !get("SELECT 1 FROM folders WHERE id = ? AND team_id = ?", b.folderId, file.team_id))) throw new HttpError(400, "Folder not found");
    folderId = b.folderId as string | null;
  }
  const content = b.content === undefined ? undefined : validateContent(b.content);

  db.transaction(() => {
    if (content) {
      maybeAutoVersion(getFile(file.id)!, u.id, u.name);
      writeContent(file.id, content);
    }
    if (title !== undefined) run("UPDATE files SET title = ? WHERE id = ?", title, file.id);
    if (folderId !== undefined) run("UPDATE files SET folder_id = ? WHERE id = ?", folderId, file.id);
    if (b.private !== undefined) run("UPDATE files SET private = ? WHERE id = ?", b.private ? 1 : 0, file.id);
    if (b.trashed !== undefined) run("UPDATE files SET trashed = ? WHERE id = ?", b.trashed ? 1 : 0, file.id);
    run("UPDATE files SET updated_at = ? WHERE id = ?", Date.now(), file.id);
  })();
  if (b.trashed === true) audit(file.team_id, u, "file.trash", file.title);
  const fresh = getFile(file.id)!;
  return c.json(toSummary(fresh, access));
});

filesRoutes.post("/:id/ops", R, async (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"), "edit");
  const updatedAt = applyOps(file.id, await readJson(c), { id: u.id, name: u.name });
  return c.json({ updatedAt });
});

filesRoutes.post("/:id/duplicate", R, (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"));
  const { teamId, role } = activeTeam(u);
  if (role === "guest") throw new HttpError(403, "Guests cannot create files");
  const copy = insertFile({
    title: `${file.title} (copy)`.slice(0, 200),
    teamId,
    ownerId: u.id,
    folderId: teamId === file.team_id ? file.folder_id : null,
    content: parseContent(file),
  });
  audit(teamId, u, "file.duplicate", file.title);
  return c.json(fullOf(copy, "owner"), 201);
});

filesRoutes.delete("/:id", R, (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"), "owner");
  run("DELETE FROM files WHERE id = ?", file.id);
  audit(file.team_id, u, "file.delete", file.title);
  return c.json({ ok: true });
});

filesRoutes.get("/:id/export", R, (c) => {
  const { file } = loadFile(c, c.req.param("id"));
  const format = c.req.query("format") ?? "json";
  const content = parseContent(file);
  const base = safeName(file.title);
  const common = { "X-Content-Type-Options": "nosniff" };
  if (format === "json")
    return new Response(JSON.stringify(content), { headers: { ...common, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.json"` } });
  if (format === "md")
    return new Response(exportMarkdown(content), { headers: { ...common, "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.md"` } });
  if (format === "svg") {
    const el = findDiagram(content, c.req.query("figure") || undefined);
    return svgResponse(renderSvg(el, c.req.query("theme"), c.req.query("background") === "true"), { "Cache-Control": "private, no-cache" });
  }
  throw new HttpError(400, "format must be json, md or svg");
});
