import { Hono } from "hono";
import type { LinkAccess, ShareInfo } from "../../client/src/lib/types";
import { audit, fileByShareToken, linkAccessOf, loadFile, requireUser, user, type AppEnv } from "../auth";
import { all, get, getFile, run, type FileRow } from "../db";
import { applyOps, findDiagram, fullOf, renderSvg } from "../filesvc";
import { HttpError, normEmail, readJson, svgResponse } from "../util";
import { parseContent } from "../db";

export const shareRoutes = new Hono<AppEnv>();
export const publicShareRoutes = new Hono<AppEnv>();
const R = requireUser;

function shareInfo(file: FileRow): ShareInfo {
  const members = all<{ user_id: string; name: string; email: string; avatar_color: string; role: "viewer" | "editor" }>(
    "SELECT m.user_id, u.name, u.email, u.avatar_color, m.role FROM file_members m JOIN users u ON u.id = m.user_id WHERE m.file_id = ? ORDER BY u.name",
    file.id,
  );
  const fresh = getFile(file.id)!;
  return {
    linkAccess: fresh.link_access,
    token: fresh.share_token,
    private: !!fresh.private,
    members: members.map((m) => ({ userId: m.user_id, name: m.name, email: m.email, avatarColor: m.avatar_color, role: m.role })),
  };
}

shareRoutes.get("/files/:id/share", R, (c) => {
  const { file } = loadFile(c, c.req.param("id"), "edit");
  return c.json(shareInfo(file));
});

shareRoutes.put("/files/:id/share", R, async (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"), "owner");
  const b = await readJson(c);
  if (!["none", "view", "edit"].includes(b.linkAccess)) throw new HttpError(400, "linkAccess must be none, view or edit");
  run("UPDATE files SET link_access = ? WHERE id = ?", b.linkAccess as LinkAccess, file.id);
  audit(file.team_id, u, "share.update", `${file.title}: link ${b.linkAccess}`);
  return c.json(shareInfo(file));
});

shareRoutes.post("/files/:id/members", R, async (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"), "owner");
  const b = await readJson(c);
  const email = normEmail(b.email);
  if (b.role !== "viewer" && b.role !== "editor") throw new HttpError(400, "role must be viewer or editor");
  const target = get<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
  if (!target) throw new HttpError(404, "No user with that email");
  if (target.id === file.owner_id) throw new HttpError(400, "That user already owns this file");
  run("INSERT OR REPLACE INTO file_members (file_id, user_id, role) VALUES (?,?,?)", file.id, target.id, b.role);
  audit(file.team_id, u, "share.update", `${file.title}: ${email} as ${b.role}`);
  return c.json(shareInfo(file));
});

shareRoutes.delete("/files/:id/members/:userId", R, (c) => {
  const u = user(c);
  const { file } = loadFile(c, c.req.param("id"), "owner");
  run("DELETE FROM file_members WHERE file_id = ? AND user_id = ?", file.id, c.req.param("userId"));
  audit(file.team_id, u, "share.update", `${file.title}: member removed`);
  return c.json(shareInfo(file));
});

// ---------- public (link) access ----------
function sharedFile(token: string) {
  const f = fileByShareToken(token);
  const access = f ? linkAccessOf(f) : null;
  if (!f || !access) throw new HttpError(404, "Link not found or sharing is turned off");
  return { file: f, access };
}

publicShareRoutes.get("/shared/:token", (c) => {
  const { file, access } = sharedFile(c.req.param("token"));
  return c.json(fullOf(file, access));
});

publicShareRoutes.post("/shared/:token/ops", async (c) => {
  const { file, access } = sharedFile(c.req.param("token"));
  if (access !== "edit") throw new HttpError(403, "This link is view-only");
  const u = c.get("user");
  const updatedAt = applyOps(file.id, await readJson(c), { id: u?.id ?? null, name: u?.name ?? "Guest" });
  return c.json({ updatedAt });
});

publicShareRoutes.get("/shared/:token/figure/:name{.+\\.svg}", (c) => {
  const { file } = sharedFile(c.req.param("token"));
  const elId = c.req.param("name").replace(/\.svg$/, "");
  const el = findDiagram(parseContent(file), elId);
  return svgResponse(renderSvg(el, c.req.query("theme"), c.req.query("background") === "true"), {
    "Cache-Control": "public, max-age=60",
    "Access-Control-Allow-Origin": "*",
  });
});
