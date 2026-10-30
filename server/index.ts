import { Hono } from "hono";
import { cors } from "hono/cors";
import crypto from "crypto";
import { db } from "./db";
import { wsDataFor, wsHandlers, type WsData } from "./ws";
import { HttpError, MAX_BODY } from "./util";
import type { AppEnv } from "./auth";
import { authRoutes } from "./routes/auth";
import { filesRoutes } from "./routes/files";
import { folderRoutes } from "./routes/folders";
import { versionRoutes } from "./routes/versions";
import { commentRoutes } from "./routes/comments";
import { shareRoutes, publicShareRoutes } from "./routes/share";
import { teamRoutes } from "./routes/team";
import { tokenRoutes } from "./routes/tokens";
import { diagramRoutes } from "./routes/diagrams";
import { aiRoutes } from "./routes/ai";

export const app = new Hono<AppEnv>();

const origins = ["http://localhost:5173", "http://localhost:4173", "https://easydraw-v1.vercel.app", ...(process.env.CLIENT_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])];

// public svg routes are embeddable from anywhere
app.use("/api/shared/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] }));
app.use("/api/v1/diagrams/*", async (c, next) => {
  if (c.req.method === "GET" && c.req.path.endsWith(".svg")) return cors({ origin: "*" })(c, next);
  return cors({ origin: origins, allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"], credentials: true })(c, next);
});
app.use("*", cors({ origin: origins, allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"], credentials: true }));

app.use("*", async (c, next) => {
  const len = Number(c.req.header("content-length") ?? 0);
  if (len > MAX_BODY + 1024) return c.json({ error: "Request body too large (max 8MB)" }, 413);
  await next();
});

app.get("/", (c) => c.json({ status: "ok", name: "easydraw" }));

// ---- legacy freehand board (original app) ----
app.post("/create-session", (c) => {
  const id = crypto.randomBytes(4).toString("hex");
  db.run("INSERT INTO canvas (id, data) VALUES (?, ?)", [id, JSON.stringify([])]);
  return c.json({ id });
});
app.get("/canvas/:id", (c) => {
  const row = db.query("SELECT data FROM canvas WHERE id = ?").get(c.req.param("id")) as any;
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(JSON.parse(row.data));
});
app.post("/canvas/:id", async (c) => {
  const body = await c.req.json();
  db.run("UPDATE canvas SET data = ? WHERE id = ?", [JSON.stringify(body), c.req.param("id")]);
  return c.json({ success: true });
});

// ---- API ----
const api = new Hono<AppEnv>();
for (const r of [authRoutes, folderRoutes, versionRoutes, commentRoutes, shareRoutes, publicShareRoutes, teamRoutes, tokenRoutes, aiRoutes, diagramRoutes]) api.route("/", r);
api.route("/files", filesRoutes);
api.route("/v1/files", filesRoutes);
app.route("/api", api);

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as any);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});
app.notFound((c) => c.json({ error: "Not found" }, 404));

const port = Number(process.env.PORT ?? 3001);

export const server = Bun.serve<WsData>({
  port,
  fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/ws/")) {
      const data = wsDataFor(url.pathname, url.searchParams);
      if (!data) return new Response("Forbidden", { status: 403 });
      if (srv.upgrade(req, { data })) return;
      return new Response("Upgrade failed", { status: 400 });
    }
    return app.fetch(req);
  },
  websocket: wsHandlers,
});

console.log(` easydraw backend running at http://localhost:${server.port}`);
