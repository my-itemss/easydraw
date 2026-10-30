import type { RtMessage, RtUser } from "../client/src/lib/types";
import { defaultUser, fileByShareToken, linkAccessOf, resolveFileAccess, userForToken } from "./auth";
import { getFile, randomColor } from "./db";

export interface WsData {
  room: string;
  legacy: boolean;
  clientId: string;
  name: string;
  color: string;
  canEdit: boolean;
}

type Sock = import("bun").ServerWebSocket<WsData>;
const rooms = new Map<string, Set<Sock>>();

const usersOf = (room: string): RtUser[] => [...(rooms.get(room) ?? [])].map((s) => ({ clientId: s.data.clientId, name: s.data.name, color: s.data.color }));
const send = (s: Sock, m: RtMessage) => {
  try {
    s.send(JSON.stringify(m));
  } catch {
    /* socket closing */
  }
};

/** Resolves connection data for an upgrade request; returns null (-> 4403) when access is denied. */
export function wsDataFor(pathname: string, params: URLSearchParams): WsData | null {
  const room = decodeURIComponent(pathname.split("/")[2] ?? "");
  if (!room) return null;
  const clientId = crypto.randomUUID().slice(0, 8);
  if (!room.startsWith("file:")) return { room, legacy: true, clientId, name: "Guest", color: "#888", canEdit: true };
  const file = getFile(room.slice(5));
  if (!file) return null;
  const token = params.get("token");
  const share = params.get("share");
  const u = userForToken(token) ?? defaultUser();
  let access = file ? resolveFileAccess(file, u) : null;
  if (!access && share) {
    const f = fileByShareToken(share);
    if (f && f.id === file.id) access = linkAccessOf(f);
  }
  if (!access) return null;
  return {
    room,
    legacy: false,
    clientId,
    name: "Guest " + clientId.slice(0, 3),
    color: randomColor(),
    canEdit: access === "owner" || access === "edit",
  };
}

export const wsHandlers = {
  open(ws: Sock) {
    const { room, legacy } = ws.data;
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room)!.add(ws);
    if (legacy) return;
    send(ws, { type: "hello", clientId: ws.data.clientId, users: usersOf(room) });
    for (const s of rooms.get(room)!) if (s !== ws) send(s, { type: "presence", users: usersOf(room) });
  },
  message(ws: Sock, raw: string | Buffer) {
    const { room, legacy } = ws.data;
    const peers = rooms.get(room);
    if (!peers) return;
    if (legacy) {
      for (const p of peers) if (p !== ws) p.send(raw);
      return;
    }
    let m: RtMessage & { type: string };
    try {
      m = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    } catch {
      return;
    }
    if (!m || typeof m !== "object") return;
    if (m.type === "cursor") {
      /* allowed for everyone */
    } else if ((m.type === "ops" || m.type === "doc") && ws.data.canEdit) {
      /* relayed */
    } else return;
    const stamped = JSON.stringify({ ...m, clientId: ws.data.clientId });
    for (const p of peers) if (p !== ws) p.send(stamped);
  },
  close(ws: Sock) {
    const { room, legacy } = ws.data;
    const peers = rooms.get(room);
    if (!peers) return;
    peers.delete(ws);
    if (peers.size === 0) rooms.delete(room);
    else if (!legacy) for (const s of peers) send(s, { type: "presence", users: usersOf(room) });
  },
};
