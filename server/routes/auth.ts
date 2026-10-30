import { Hono } from "hono";
import { audit, bearerOf, createSession, limitOrThrow, requireUser, user, type AppEnv } from "../auth";
import { all, get, newId, now, randomColor, run, sha256, teamRole, teamsForUser, toUser, type TeamRow, type UserRow } from "../db";
import { clientIp, HttpError, normEmail, readJson, strField } from "../util";

export const authRoutes = new Hono<AppEnv>();

const reply = (u: UserRow, token?: string) => ({ ...(token ? { token } : {}), user: toUser(u), teams: teamsForUser(u.id) });

authRoutes.post("/auth/register", async (c) => {
  limitOrThrow("reg:" + clientIp(c), 30, 10 * 60_000);
  const b = await readJson(c);
  const name = strField(b.name, "name", 100, { required: true })!;
  const email = normEmail(b.email);
  const password = strField(b.password, "password", 200, { required: true, trim: false })!;
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (get("SELECT 1 FROM users WHERE email = ?", email)) throw new HttpError(409, "An account with that email already exists");

  const id = newId();
  const t = now();
  const hash = await Bun.password.hash(password);
  const domain = email.split("@")[1]!;
  let u!: UserRow;
  db_tx(() => {
    run("INSERT INTO users (id, name, email, password_hash, avatar_color, active_team_id, created_at) VALUES (?,?,?,?,?,?,?)", id, name, email, hash, randomColor(), "", t);
    const domTeam = get<TeamRow>("SELECT * FROM teams WHERE allowed_domain = ? ORDER BY created_at LIMIT 1", domain);
    let active: string;
    if (domTeam) {
      run("INSERT OR REPLACE INTO team_members (team_id, email, user_id, role, status, created_at) VALUES (?,?,?,?,?,?)", domTeam.id, email, id, "member", "active", t);
      active = domTeam.id;
    } else {
      active = newId();
      run("INSERT INTO teams (id, name, plan, allowed_domain, created_at) VALUES (?,?,?,?,?)", active, `${name}'s workspace`, "free", null, t);
      run("INSERT INTO team_members (team_id, email, user_id, role, status, created_at) VALUES (?,?,?,?,?,?)", active, email, id, "owner", "active", t);
    }
    run("UPDATE team_members SET user_id = ?, status = 'active' WHERE email = ? AND status = 'pending'", id, email);
    run("UPDATE users SET active_team_id = ? WHERE id = ?", active, id);
    u = get<UserRow>("SELECT * FROM users WHERE id = ?", id)!;
  });
  audit(u.active_team_id, u, "auth.register", u.email);
  return c.json(reply(u, createSession(u.id)), 201);
});

authRoutes.post("/auth/login", async (c) => {
  limitOrThrow("login:" + clientIp(c), 60, 10 * 60_000, "Too many attempts, try again later");
  const b = await readJson(c);
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const u = email ? get<UserRow>("SELECT * FROM users WHERE email = ?", email) : null;
  const ok = u && password.length > 0 && password.length <= 200 && (await Bun.password.verify(password, u.password_hash));
  if (!u || !ok) throw new HttpError(401, "Invalid email or password");
  audit(u.active_team_id, u, "auth.login", u.email);
  return c.json(reply(u, createSession(u.id)));
});

authRoutes.post("/auth/logout", async (c) => {
  const t = bearerOf(c);
  if (t && !t.startsWith("ek_")) {
    const u = c.get("user");
    run("DELETE FROM sessions WHERE token_hash = ?", sha256(t));
    if (u) audit(u.active_team_id, u, "auth.logout", u.email);
  }
  return c.json({ ok: true });
});

authRoutes.get("/auth/me", requireUser, (c) => c.json(reply(user(c))));

authRoutes.patch("/auth/me", requireUser, async (c) => {
  const u = user(c);
  const b = await readJson(c);
  const name = strField(b.name, "name", 100, { min: 1 });
  if (b.password !== undefined) {
    const pw = strField(b.password, "password", 200, { required: true, trim: false })!;
    if (pw.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
    const cur = typeof b.currentPassword === "string" ? b.currentPassword : "";
    if (!cur || !(await Bun.password.verify(cur, u.password_hash))) throw new HttpError(403, "Current password is incorrect");
    run("UPDATE users SET password_hash = ? WHERE id = ?", await Bun.password.hash(pw), u.id);
  }
  if (name) run("UPDATE users SET name = ? WHERE id = ?", name, u.id);
  return c.json({ user: toUser(get<UserRow>("SELECT * FROM users WHERE id = ?", u.id)!) });
});

authRoutes.put("/me/team", requireUser, async (c) => {
  const u = user(c);
  const b = await readJson(c);
  const teamId = strField(b.teamId, "teamId", 64, { required: true })!;
  if (!teamRole(teamId, u.id)) throw new HttpError(403, "You are not a member of that team");
  run("UPDATE users SET active_team_id = ? WHERE id = ?", teamId, u.id);
  return c.json({ user: toUser(get<UserRow>("SELECT * FROM users WHERE id = ?", u.id)!) });
});

import { db } from "../db";
function db_tx(fn: () => void) {
  db.transaction(fn)();
}
