import { Hono } from "hono";
import { serve } from "bun";
import { cors } from "hono/cors";
import crypto from "crypto";
import { db } from "./db";
import { joinRoom } from "./ws";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "https://easydraw-v1.vercel.app"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.get("/", c => c.json({ status: "ok" }));

app.post("/create-session", c => {
  const id = crypto.randomBytes(4).toString("hex");

  db.run(
    "INSERT INTO canvas (id, data) VALUES (?, ?)",
    [id, JSON.stringify([])]
  );

  return c.json({ id });
});

app.get("/canvas/:id", c => {
  const id = c.req.param("id");

  const row = db
    .query("SELECT data FROM canvas WHERE id = ?")
    .get(id) as any;

  if (!row) return c.json({ error: "Not found" }, 404);

  return c.json(JSON.parse(row.data));
});

app.post("/canvas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();

  db.run(
    "UPDATE canvas SET data = ? WHERE id = ?",
    [JSON.stringify(body), id]
  );

  return c.json({ success: true });
});

serve({
  port: 3001,

  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/ws/")) {
      const canvasId = url.pathname.split("/")[2];
      if (server.upgrade(req, { data: { canvasId } })) return;
    }

    return app.fetch(req);
  },

  websocket: {
    open(ws) {
      joinRoom(ws, ws.data.canvasId);
    },
  },
});

console.log(" Backend running at http://localhost:3001");
