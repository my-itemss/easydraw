import { Hono } from "hono";
import { activeTeam, audit, requireUser, user, type AppEnv } from "../auth";
import { all, get, newId, now, randomHex, run, sha256, toTokenInfo } from "../db";
import { HttpError, readJson, strField } from "../util";

export const tokenRoutes = new Hono<AppEnv>();
type TRow = Parameters<typeof toTokenInfo>[0];

tokenRoutes.get("/tokens", requireUser, (c) =>
  c.json(all<TRow>("SELECT id,name,prefix,created_at,last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC", user(c).id).map(toTokenInfo)),
);

tokenRoutes.post("/tokens", requireUser, async (c) => {
  const u = user(c);
  const b = await readJson(c);
  const name = strField(b.name, "name", 100, { required: true })!;
  if (get<{ n: number }>("SELECT COUNT(*) AS n FROM api_tokens WHERE user_id = ?", u.id)!.n >= 50) throw new HttpError(400, "Too many tokens (max 50)");
  const token = "ek_" + randomHex(16);
  const id = newId();
  const t = now();
  run("INSERT INTO api_tokens (id,user_id,name,token_hash,prefix,created_at,last_used_at) VALUES (?,?,?,?,?,?,NULL)", id, u.id, name, sha256(token), token.slice(0, 11), t);
  audit(activeTeam(u).teamId, u, "token.create", name);
  return c.json({ token, info: toTokenInfo({ id, name, prefix: token.slice(0, 11), created_at: t, last_used_at: null }) }, 201);
});

tokenRoutes.delete("/tokens/:id", requireUser, (c) => {
  const u = user(c);
  const row = get<{ name: string }>("SELECT name FROM api_tokens WHERE id = ? AND user_id = ?", c.req.param("id"), u.id);
  if (!row) throw new HttpError(404, "Token not found");
  run("DELETE FROM api_tokens WHERE id = ?", c.req.param("id"));
  audit(activeTeam(u).teamId, u, "token.delete", row.name);
  return c.json({ ok: true });
});
