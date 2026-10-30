import { Hono } from "hono";
import type { AuditEvent, Member, Role, Team, Usage } from "../../client/src/lib/types";
import { activeTeam, audit, requireUser, user, type AppEnv } from "../auth";
import { all, db, get, now, run, toTeam, type TeamRow, type UserRow } from "../db";
import { HttpError, normEmail, readJson, strField } from "../util";

export const teamRoutes = new Hono<AppEnv>();
const R = requireUser;
const ROLES: Role[] = ["owner", "admin", "member", "guest"];
const FREE_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "msn.com", "me.com"]);

type MRow = { team_id: string; email: string; user_id: string | null; role: Role; status: "active" | "pending"; name: string | null; avatar_color: string | null };

function listMembers(teamId: string): Member[] {
  return all<MRow>(
    `SELECT m.*, u.name AS name, u.avatar_color AS avatar_color FROM team_members m LEFT JOIN users u ON u.id = m.user_id
     WHERE m.team_id = ? ORDER BY m.status ASC, m.created_at ASC`,
    teamId,
  ).map((r) => ({
    userId: r.user_id,
    name: r.name ?? r.email.split("@")[0]!,
    email: r.email,
    avatarColor: r.avatar_color ?? "#9ca3af",
    role: r.role,
    status: r.status,
  }));
}

function admin(u: UserRow) {
  const a = activeTeam(u);
  if (a.role !== "owner" && a.role !== "admin") throw new HttpError(403, "Only team owners and admins can do that");
  return a;
}

const ownerCount = (teamId: string) => get<{ n: number }>("SELECT COUNT(*) AS n FROM team_members WHERE team_id = ? AND role = 'owner' AND status = 'active'", teamId)!.n;

teamRoutes.get("/team", R, (c) => {
  const { teamId, role } = activeTeam(user(c));
  const t = get<TeamRow>("SELECT * FROM teams WHERE id = ?", teamId)!;
  return c.json({ team: toTeam(t, role), members: listMembers(teamId) });
});

teamRoutes.patch("/team", R, async (c) => {
  const u = user(c);
  const { teamId, role } = admin(u);
  const b = await readJson(c);
  const name = strField(b.name, "name", 100, { min: 1 });
  if (name !== undefined) run("UPDATE teams SET name = ? WHERE id = ?", name, teamId);
  if (b.allowedDomain !== undefined) {
    let d: string | null = null;
    if (b.allowedDomain !== null && b.allowedDomain !== "") {
      if (typeof b.allowedDomain !== "string") throw new HttpError(400, "allowedDomain must be a string or null");
      d = String(b.allowedDomain).trim().replace(/^@/, "").toLowerCase() as string;
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) || d.length > 253) throw new HttpError(400, "Enter a valid domain, e.g. acme.com");
      if (FREE_DOMAINS.has(d)) throw new HttpError(400, "Public email domains cannot be used for auto-join");
      if (get("SELECT 1 FROM teams WHERE allowed_domain = ? AND id != ?", d, teamId)) throw new HttpError(409, "That domain is already claimed by another team");
    }
    run("UPDATE teams SET allowed_domain = ? WHERE id = ?", d, teamId);
  }
  audit(teamId, u, "team.update", name ?? "settings");
  return c.json(toTeam(get<TeamRow>("SELECT * FROM teams WHERE id = ?", teamId)!, role));
});

teamRoutes.post("/team/invite", R, async (c) => {
  const u = user(c);
  const { teamId } = admin(u);
  const b = await readJson(c);
  const email = normEmail(b.email);
  if (b.role !== "admin" && b.role !== "member" && b.role !== "guest") throw new HttpError(400, "role must be admin, member or guest");
  const existing = get<{ status: string }>("SELECT status FROM team_members WHERE team_id = ? AND email = ?", teamId, email);
  if (existing?.status === "active") throw new HttpError(409, "That person is already on the team");
  const target = get<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
  run(
    "INSERT OR REPLACE INTO team_members (team_id, email, user_id, role, status, created_at) VALUES (?,?,?,?,?,?)",
    teamId, email, target?.id ?? null, b.role, target ? "active" : "pending", now(),
  );
  audit(teamId, u, "member.invite", `${email} as ${b.role}`);
  return c.json({ members: listMembers(teamId) });
});

teamRoutes.patch("/team/members/:userId", R, async (c) => {
  const u = user(c);
  const { teamId, role: mine } = admin(u);
  const b = await readJson(c);
  if (!ROLES.includes(b.role)) throw new HttpError(400, "Invalid role");
  const uid = c.req.param("userId");
  const m = get<{ role: Role; email: string }>("SELECT role, email FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'", teamId, uid);
  if (!m) throw new HttpError(404, "Member not found");
  if (mine !== "owner" && (m.role === "owner" || b.role === "owner")) throw new HttpError(403, "Only an owner can change owner roles");
  if (m.role === "owner" && b.role !== "owner" && ownerCount(teamId) <= 1) throw new HttpError(409, "A team needs at least one owner");
  run("UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?", b.role, teamId, uid);
  audit(teamId, u, "member.role", `${m.email} -> ${b.role}`);
  return c.json({ members: listMembers(teamId) });
});

teamRoutes.delete("/team/members/:userId", R, (c) => {
  const u = user(c);
  const { teamId, role: mine } = admin(u);
  const uid = c.req.param("userId");
  const m = get<{ role: Role; email: string }>("SELECT role, email FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'", teamId, uid);
  if (!m) throw new HttpError(404, "Member not found");
  if (m.role === "owner" && mine !== "owner") throw new HttpError(403, "Only an owner can remove an owner");
  if (m.role === "owner" && ownerCount(teamId) <= 1) throw new HttpError(409, "A team needs at least one owner");
  db.transaction(() => {
    run("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", teamId, uid);
    run("DELETE FROM file_members WHERE user_id = ? AND file_id IN (SELECT id FROM files WHERE team_id = ?)", uid, teamId);
  })();
  audit(teamId, u, "member.remove", m.email);
  return c.json({ members: listMembers(teamId) });
});

teamRoutes.delete("/team/invites/:email", R, (c) => {
  const u = user(c);
  const { teamId } = admin(u);
  const email = decodeURIComponent(c.req.param("email")).toLowerCase();
  run("DELETE FROM team_members WHERE team_id = ? AND email = ? AND status = 'pending'", teamId, email);
  audit(teamId, u, "member.remove", `${email} (invite)`);
  return c.json({ members: listMembers(teamId) });
});

teamRoutes.get("/team/audit", R, (c) => {
  const { teamId } = admin(user(c));
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query("limit") ?? "100", 10) || 100));
  const rows = all<{ id: string; actor_name: string; action: string; target: string; created_at: number }>(
    "SELECT * FROM audit_log WHERE team_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
    teamId, limit,
  );
  const out: AuditEvent[] = rows.map((r) => ({ id: r.id, actorName: r.actor_name, action: r.action, target: r.target, createdAt: r.created_at }));
  return c.json(out);
});

export function usageFor(u: UserRow): Usage {
  const { teamId } = activeTeam(u);
  const d = new Date();
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return {
    files: get<{ n: number }>("SELECT COUNT(*) AS n FROM files WHERE team_id = ? AND trashed = 0", teamId)!.n,
    members: get<{ n: number }>("SELECT COUNT(*) AS n FROM team_members WHERE team_id = ? AND status = 'active'", teamId)!.n,
    aiRequestsThisMonth: get<{ n: number }>("SELECT COUNT(*) AS n FROM ai_requests WHERE user_id = ? AND created_at >= ?", u.id, monthStart)!.n,
    plan: "free",
  };
}

teamRoutes.get("/usage", R, (c) => c.json(usageFor(user(c))));
