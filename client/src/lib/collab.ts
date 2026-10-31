import { nanoid } from "nanoid";
import type { El, Peer } from "../types";
import { useApp } from "../store";
import { PEER_COLORS } from "./colors";
import { saveName } from "./storage";

const ANIMALS = ["Fox", "Otter", "Heron", "Lynx", "Panda", "Falcon", "Koala", "Gecko", "Moth", "Wolf"];
const ADJ = ["Swift", "Calm", "Bright", "Quiet", "Bold", "Merry", "Clever", "Lucky"];

const WS_URL: string = (() => {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (api) return api.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:3001/ws`;
})();

let ws: WebSocket | null = null;
let room: string | null = null;
let me: Peer | null = null;
let sent = new Map<string, number>();
let unsub: (() => void) | null = null;
let sendTimer: number | undefined;
let retry = 0;
let retryTimer: number | undefined;
let lastPtr = 0;
let wantOpen = false;

const send = (m: unknown) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

export const newRoomId = () => nanoid(10);
export const roomFromHash = () => /[#&]room=([\w-]+)/.exec(location.hash)?.[1] ?? null;
export const roomLink = (id: string) => `${location.origin}${location.pathname}#room=${id}`;

function identity(): Peer {
  const st = useApp.getState();
  const id = nanoid(8);
  const name = st.collab.name || `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}`;
  const color = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
  return { id, name, color };
}

function reconcile(remote: El[]) {
  const st = useApp.getState();
  const local = new Map(st.elements.map((e) => [e.id, e]));
  let changed = false;
  const next = st.elements.slice();
  for (const r of remote) {
    const l = local.get(r.id);
    sent.set(r.id, Math.max(sent.get(r.id) ?? 0, r.version));
    if (!l) { next.push(r); changed = true; continue; }
    if (l.version < r.version || (l.version === r.version && r.versionNonce < l.versionNonce)) {
      next[next.indexOf(l)] = r; changed = true;
    }
  }
  if (changed) {
    const editing = st.editing?.id;
    useApp.setState({ elements: editing ? next.map((e) => (e.id === editing ? local.get(e.id)! : e)) : next });
  }
}

function flush() {
  sendTimer = undefined;
  const els = useApp.getState().elements.filter((e) => sent.get(e.id) !== e.version);
  if (!els.length) return;
  for (const e of els) sent.set(e.id, e.version);
  send({ t: "scene", els });
}

function connect() {
  if (!room) return;
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    retry = 0;
    useApp.getState().setCollab({ connected: true });
    send({ t: "join", room, user: me });
  };
  ws.onmessage = (ev) => {
    let m: { t: string; [k: string]: unknown };
    try { m = JSON.parse(ev.data as string); } catch { return; }
    const st = useApp.getState();
    if (m.t === "init") {
      const remote = m.els as El[];
      if (remote.length) {
        if (st.elements.some((e) => !e.isDeleted)) { try { localStorage.setItem("easydraw:backup", JSON.stringify(st.elements)); } catch { /* */ } }
        sent = new Map();
        useApp.setState({ elements: [], selected: new Set(), past: [], future: [] });
        reconcile(remote);
        useApp.getState().fit();
      } else {
        sent = new Map(); // creator: push everything we have
        flush();
      }
      st.setCollab({ peers: (m.peers as Peer[]).filter((p) => p.id !== me?.id) });
    } else if (m.t === "scene") reconcile(m.els as El[]);
    else if (m.t === "peers") st.setCollab({ peers: (m.peers as Peer[]).filter((p) => p.id !== me?.id) });
    else if (m.t === "ptr") {
      const peers = st.collab.peers.map((p) => (p.id === m.id ? { ...p, x: m.x as number, y: m.y as number } : p));
      st.setCollab({ peers });
    }
  };
  ws.onclose = () => {
    useApp.getState().setCollab({ connected: false });
    if (wantOpen) {
      retryTimer = window.setTimeout(connect, Math.min(8000, 600 * 2 ** retry++));
    }
  };
  ws.onerror = () => ws?.close();
}

export function startCollab(id: string = newRoomId()) {
  stopCollab(false);
  room = id;
  wantOpen = true;
  me = identity();
  useApp.getState().setCollab({ room: id, name: me.name, peers: [] });
  saveName(me.name);
  history.replaceState(null, "", `#room=${id}`);
  unsub = useApp.subscribe((s, p) => {
    if (s.elements !== p.elements && ws?.readyState === WebSocket.OPEN && sendTimer === undefined) sendTimer = window.setTimeout(flush, 50);
  });
  connect();
}

export function stopCollab(clearHash = true) {
  wantOpen = false;
  window.clearTimeout(retryTimer);
  window.clearTimeout(sendTimer);
  sendTimer = undefined;
  unsub?.(); unsub = null;
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  room = null; sent = new Map();
  useApp.getState().setCollab({ room: null, connected: false, peers: [] });
  if (clearHash && roomFromHash()) history.replaceState(null, "", location.pathname + location.search);
}

export function sendPointer(x: number, y: number) {
  const now = performance.now();
  if (!room || now - lastPtr < 40) return;
  lastPtr = now;
  send({ t: "ptr", x, y });
}

export function renameSelf(name: string) {
  if (me) { me = { ...me, name }; send({ t: "name", name }); }
  useApp.getState().setCollab({ name });
  saveName(name);
}
