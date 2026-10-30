import type { Context, MiddlewareHandler } from "hono";
import type { Role } from "../client/src/lib/types";
import { all, db, get, getFile, newId, now, randomHex, run, sha256, teamRole, type FileRow, type UserRow } from "./db";
import { HttpError } from "./util";

export type AppEnv = { Variables: { user: UserRow | null } };

export const SESSION_MS = 30 * 24 * 3600 * 1000;

export function createSession(userId: string): string {
  const token = randomHex(32);
  run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)", sha256(token), userId, now(), now() + SESSION_MS);
  return token;
}

export const bearerOf = (c: Context): string | null => {
  const h = c.req.header("authorization");
  const m = h && /^Bearer\s+(\S+)$/i.exec(h);
  return m ? m[1]! : null;
};

export function userForToken(token: string | null | undefined): UserRow | null {
  if (!token) return null;
  const h = sha256(token);
  if (token.startsWith("ek_")) {
    const r = get<UserRow & { tid: string }>(
      "SELECT u.*, t.id AS tid FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?",
      h,
    );
    if (!r) return null;
    run("UPDATE api_tokens SET last_used_at = ? WHERE id = ?", now(), r.tid);
    return r;
  }
  return get<UserRow>(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
    h,
    now(),
  );
}

// ---------- no-login mode ----------
// easydraw runs without sign-in: every request that carries no (valid) token acts as one built-in
// local user that owns the "My workspace" team. API tokens (ek_...) still identify the same user.
export const LOCAL_USER_ID = "local";

export function defaultUser(): UserRow {
  const existing = get<UserRow>("SELECT * FROM users WHERE id = ?", LOCAL_USER_ID);
  if (existing) return existing;
  const t = now();
  const teamId = "local-team";
  db.transaction(() => {
    run("INSERT OR IGNORE INTO users (id, name, email, password_hash, avatar_color, active_team_id, created_at) VALUES (?,?,?,?,?,?,?)", LOCAL_USER_ID, "You", "local@easydraw.local", "!", "#5b5bd6", teamId, t);
    run("INSERT OR IGNORE INTO teams (id, name, plan, allowed_domain, created_at) VALUES (?,?,?,?,?)", teamId, "My workspace", "free", null, t);
    run("INSERT OR IGNORE INTO team_members (team_id, email, user_id, role, status, created_at) VALUES (?,?,?,?,?,?)", teamId, "local@easydraw.local", LOCAL_USER_ID, "owner", "active", t);
  })();
  return get<UserRow>("SELECT * FROM users WHERE id = ?", LOCAL_USER_ID)!;
}

/** Explicit API tokens must be valid; everything else falls back to the local user. */
export function resolveRequestUser(c: Context): UserRow {
  const token = bearerOf(c);
  const u = userForToken(token);
  if (u) return u;
  if (token?.startsWith("ek_")) throw new HttpError(401, "Invalid or revoked API token");
  return defaultUser();
}

export const optionalUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", resolveRequestUser(c));
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) c.set("user", resolveRequestUser(c));
  await next();
};

export function user(c: Context<AppEnv>): UserRow {
  const u = c.get("user");
  if (!u) throw new HttpError(401, "Sign in required");
  return u;
}

// ---------- teams ----------
export function requireTeamRole(teamId: string, userId: string, allowed: Role[]): Role {
  const r = teamRole(teamId, userId);
  if (!r || !allowed.includes(r)) throw new HttpError(403, "You don't have permission to do that");
  return r;
}

/** The user's active team and their role in it; repairs a stale active team. */
export function activeTeam(u: UserRow): { teamId: string; role: Role } {
  let role = u.active_team_id ? teamRole(u.active_team_id, u.id) : null;
  if (role) return { teamId: u.active_team_id, role };
  const first = get<{ team_id: string; role: Role }>("SELECT team_id, role FROM team_members WHERE user_id = ? AND status = 'active' ORDER BY created_at LIMIT 1", u.id);
  if (!first) throw new HttpError(403, "You are not a member of any team");
  run("UPDATE users SET active_team_id = ? WHERE id = ?", first.team_id, u.id);
  u.active_team_id = first.team_id;
  return { teamId: first.team_id, role: first.role };
}

// ---------- files ----------
export type Access = "owner" | "edit" | "view";

export function memberRole(fileId: string, userId: string): "viewer" | "editor" | null {
  return get<{ role: "viewer" | "editor" }>("SELECT role FROM file_members WHERE file_id = ? AND user_id = ?", fileId, userId)?.role ?? null;
}

/** Access of a signed-in user (or anonymous: null) to a file. Link access is handled by `linkAccessOf`. */
export function resolveFileAccess(file: FileRow, u: UserRow | null, opts: { role?: Role | null; fileRole?: "viewer" | "editor" | null } = {}): Access | null {
  if (!u) return null;
  if (file.owner_id === u.id) return "owner";
  const fr = opts.fileRole !== undefined ? opts.fileRole : memberRole(file.id, u.id);
  if (fr === "editor") return "edit";
  const role = opts.role !== undefined ? opts.role : teamRole(file.team_id, u.id);
  if (role && role !== "guest" && !file.private) return "edit";
  if (fr === "viewer") return "view";
  return null;
}

export const linkAccessOf = (file: FileRow): "view" | "edit" | null => (file.link_access === "none" ? null : file.link_access);

export function fileByShareToken(token: string): FileRow | null {
  const r = get<{ id: string }>("SELECT id FROM files WHERE share_token = ?", token);
  const f = r ? getFile(r.id) : null;
  return f && f.link_access !== "none" ? f : null;
}

/** Loads a file and enforces access; 404 when the user cannot see it at all (no existence leak). */
export function loadFile(c: Context<AppEnv>, id: string, need: "view" | "edit" | "owner" = "view"): { file: FileRow; access: Access } {
  const u = user(c);
  const file = getFile(id);
  const access = file ? resolveFileAccess(file, u) : null;
  if (!file || !access) throw new HttpError(404, "File not found");
  const rank = { view: 1, edit: 2, owner: 3 } as const;
  if (rank[access] < rank[need]) throw new HttpError(403, need === "owner" ? "Only the owner can do that" : "You have view-only access");
  return { file, access };
}

// ---------- audit ----------
export function audit(teamId: string, actor: { id: string; name: string } | null, action: string, target = "") {
  run("INSERT INTO audit_log (id, team_id, actor_id, actor_name, action, target, created_at) VALUES (?,?,?,?,?,?,?)", newId(), teamId, actor?.id ?? null, actor?.name ?? "System", action, target.slice(0, 300), now());
}

// ---------- rate limit ----------
const buckets = new Map<string, number[]>();
/** Returns true when allowed. Sliding window. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const t = Date.now();
  const arr = (buckets.get(key) ?? []).filter((x) => t - x < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(t);
  buckets.set(key, arr);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.length || t - v[v.length - 1]! > windowMs) buckets.delete(k);
  return true;
}

export function limitOrThrow(key: string, max: number, windowMs: number, msg = "Too many requests, slow down") {
  if (!rateLimit(key, max, windowMs)) throw new HttpError(429, msg);
}
