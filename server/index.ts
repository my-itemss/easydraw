/**
 * Easydraw live-collaboration relay.
 *  - one in-memory room per id, holds the latest version of every element
 *  - relays element updates + cursors between peers
 * Run: bun index.ts   (PORT env, default 3001)
 */
import type { ServerWebSocket } from "bun";

interface User { id: string; name: string; color: string }
interface El { id: string; version: number; versionNonce: number; isDeleted?: boolean; [k: string]: unknown }
interface Data { room?: string; user?: User }
interface Room { els: Map<string, El>; sockets: Set<ServerWebSocket<Data>>; cursors: Map<string, { x: number; y: number }>; timer?: ReturnType<typeof setTimeout> }

const rooms = new Map<string, Room>();
const MAX_ELEMENTS = 5000;
const MAX_MESSAGE = 16 * 1024 * 1024;

const peersOf = (r: Room) =>
  [...r.sockets].filter((s) => s.data.user).map((s) => ({ ...s.data.user!, ...(r.cursors.get(s.data.user!.id) ?? {}) }));

function broadcast(r: Room, msg: unknown, except?: ServerWebSocket<Data>) {
  const s = JSON.stringify(msg);
  for (const c of r.sockets) if (c !== except) c.send(s);
}

function merge(r: Room, incoming: El[]) {
  for (const e of incoming) {
    if (!e || typeof e.id !== "string") continue;
    const cur = r.els.get(e.id);
    if (!cur || cur.version < e.version || (cur.version === e.version && e.versionNonce < cur.versionNonce)) {
      if (!cur && r.els.size >= MAX_ELEMENTS) continue;
      r.els.set(e.id, e);
    }
  }
}

const port = Number(process.env.PORT ?? 3001);

Bun.serve<Data>({
  port,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (server.upgrade(req, { data: {} })) return;
      return new Response("Upgrade failed", { status: 400 });
    }
    return Response.json({ status: "ok", name: "easydraw", rooms: rooms.size });
  },
  websocket: {
    maxPayloadLength: MAX_MESSAGE,
    message(ws, raw) {
      let m: any;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.t === "join" && typeof m.room === "string" && m.user?.id) {
        let r = rooms.get(m.room);
        if (!r) { r = { els: new Map(), sockets: new Set(), cursors: new Map() }; rooms.set(m.room, r); }
        if (r.timer) { clearTimeout(r.timer); r.timer = undefined; }
        ws.data.room = m.room;
        ws.data.user = { id: String(m.user.id), name: String(m.user.name ?? "Guest").slice(0, 32), color: String(m.user.color ?? "#6965db") };
        r.sockets.add(ws);
        ws.send(JSON.stringify({ t: "init", els: [...r.els.values()], peers: peersOf(r) }));
        broadcast(r, { t: "peers", peers: peersOf(r) }, ws);
        return;
      }
      const r = ws.data.room ? rooms.get(ws.data.room) : undefined;
      if (!r || !ws.data.user) return;
      if (m.t === "scene" && Array.isArray(m.els)) {
        merge(r, m.els);
        broadcast(r, { t: "scene", els: m.els }, ws);
      } else if (m.t === "ptr") {
        r.cursors.set(ws.data.user.id, { x: m.x, y: m.y });
        broadcast(r, { t: "ptr", id: ws.data.user.id, x: m.x, y: m.y }, ws);
      } else if (m.t === "name") {
        ws.data.user.name = String(m.name ?? "Guest").slice(0, 32);
        broadcast(r, { t: "peers", peers: peersOf(r) });
      }
    },
    close(ws) {
      const r = ws.data.room ? rooms.get(ws.data.room) : undefined;
      if (!r) return;
      r.sockets.delete(ws);
      if (ws.data.user) r.cursors.delete(ws.data.user.id);
      broadcast(r, { t: "peers", peers: peersOf(r) });
      if (!r.sockets.size) {
        // keep an empty room around for an hour so a refresh doesn't lose the board
        const id = ws.data.room!;
        r.timer = setTimeout(() => rooms.delete(id), 60 * 60 * 1000);
      }
    },
  },
});

console.log(`easydraw relay listening on :${port}  (ws://localhost:${port}/ws)`);
