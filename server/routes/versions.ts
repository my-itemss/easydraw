import { Hono } from "hono";
import { loadFile, requireUser, user, type AppEnv } from "../auth";
import { all, db, get, getFile, newId, parseContent, run, snapshot, toVersion, writeContent } from "../db";
import { fullOf } from "../filesvc";
import { HttpError, readJson, strField } from "../util";

export const versionRoutes = new Hono<AppEnv>();
const R = requireUser;
type VRow = { id: string; file_id: string; label: string; auto: number; author_name: string; content: string; created_at: number };

const loadVersion = (fileId: string, vid: string): VRow => {
  const v = get<VRow>("SELECT * FROM versions WHERE id = ? AND file_id = ?", vid, fileId);
  if (!v) throw new HttpError(404, "Version not found");
  return v;
};

versionRoutes.get("/files/:id/versions", R, (c) => {
  const { file } = loadFile(c, c.req.param("id"));
  return c.json(all<VRow>("SELECT id,file_id,label,auto,author_name,created_at FROM versions WHERE file_id = ? ORDER BY created_at DESC, rowid DESC", file.id).map(toVersion));
});

versionRoutes.post("/files/:id/versions", R, async (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"), "edit");
  const b = await readJson(c, true);
  const label = strField(b.label, "label", 200) ?? "";
  return c.json(snapshot(file, { auto: false, label, authorId: u.id, authorName: u.name }), 201);
});

versionRoutes.get("/files/:id/versions/:vid", R, (c) => {
  const { file } = loadFile(c, c.req.param("id"));
  const v = loadVersion(file.id, c.req.param("vid"));
  return c.json({ version: toVersion(v), content: parseContent(v) });
});

versionRoutes.post("/files/:id/versions/:vid/restore", R, (c) => {
  const u = user(c);
  const { file, access } = loadFile(c, c.req.param("id"), "edit");
  const v = loadVersion(file.id, c.req.param("vid"));
  db.transaction(() => {
    snapshot(getFile(file.id)!, { auto: false, label: "Before restore", authorId: u.id, authorName: u.name });
    writeContent(file.id, parseContent(v));
  })();
  return c.json(fullOf(getFile(file.id)!, access));
});
