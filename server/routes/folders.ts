import { Hono } from "hono";
import { activeTeam, audit, requireUser, user, type AppEnv } from "../auth";
import { all, db, get, newId, now, run, teamRole, toFolder } from "../db";
import { HttpError, readJson, strField } from "../util";

export const folderRoutes = new Hono<AppEnv>();
type FRow = { id: string; name: string; parent_id: string | null; team_id: string; created_at: number };

function writableFolder(id: string, userId: string): FRow {
  const f = get<FRow>("SELECT * FROM folders WHERE id = ?", id);
  const role = f ? teamRole(f.team_id, userId) : null;
  if (!f || !role || role === "guest") throw new HttpError(404, "Folder not found");
  return f;
}

function checkParent(parentId: unknown, teamId: string, selfId?: string): string | null {
  if (parentId === null || parentId === undefined) return null;
  if (typeof parentId !== "string") throw new HttpError(400, "parentId must be a string");
  let cur = get<FRow>("SELECT * FROM folders WHERE id = ? AND team_id = ?", parentId, teamId);
  if (!cur) throw new HttpError(400, "Parent folder not found");
  for (let i = 0; cur && i < 100; i++) {
    if (cur.id === selfId) throw new HttpError(400, "A folder cannot be moved into itself");
    cur = cur.parent_id ? get<FRow>("SELECT * FROM folders WHERE id = ?", cur.parent_id) : null;
  }
  return parentId;
}

folderRoutes.get("/folders", requireUser, (c) => {
  const { teamId, role } = activeTeam(user(c));
  if (role === "guest") return c.json([]);
  return c.json(all<FRow>("SELECT * FROM folders WHERE team_id = ? ORDER BY name COLLATE NOCASE", teamId).map(toFolder));
});

folderRoutes.post("/folders", requireUser, async (c) => {
  const u = user(c);
  const { teamId, role } = activeTeam(u);
  if (role === "guest") throw new HttpError(403, "Guests cannot create folders");
  const b = await readJson(c);
  const name = strField(b.name, "name", 100, { required: true })!;
  const parentId = checkParent(b.parentId, teamId);
  const id = newId();
  const t = now();
  run("INSERT INTO folders (id,name,parent_id,team_id,created_at) VALUES (?,?,?,?,?)", id, name, parentId, teamId, t);
  audit(teamId, u, "folder.create", name);
  return c.json(toFolder({ id, name, parent_id: parentId, team_id: teamId, created_at: t }), 201);
});

folderRoutes.patch("/folders/:id", requireUser, async (c) => {
  const f = writableFolder(c.req.param("id"), user(c).id);
  const b = await readJson(c);
  const name = strField(b.name, "name", 100, { min: 1 });
  if (name !== undefined) run("UPDATE folders SET name = ? WHERE id = ?", name, f.id);
  if (b.parentId !== undefined) run("UPDATE folders SET parent_id = ? WHERE id = ?", checkParent(b.parentId, f.team_id, f.id), f.id);
  return c.json(toFolder(get<FRow>("SELECT * FROM folders WHERE id = ?", f.id)!));
});

folderRoutes.delete("/folders/:id", requireUser, (c) => {
  const u = user(c);
  const f = writableFolder(c.req.param("id"), u.id);
  db.transaction(() => {
    run("UPDATE files SET folder_id = NULL WHERE folder_id = ?", f.id);
    run("UPDATE folders SET parent_id = ? WHERE parent_id = ?", f.parent_id, f.id);
    run("DELETE FROM folders WHERE id = ?", f.id);
  })();
  audit(f.team_id, u, "folder.delete", f.name);
  return c.json({ ok: true });
});
