import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, tokenStore, WS_URL } from "../../../lib/api";
import type { CanvasElement, FileContent, FileFull, RtMessage, RtUser } from "../../../lib/types";

export type SaveStatus = "saved" | "saving" | "error";

export interface Cursor {
  x: number;
  y: number;
  t: number;
}

interface Pending {
  upsert: Map<string, CanvasElement>;
  remove: Set<string>;
  doc?: string;
  title?: string;
}

const HISTORY_MAX = 100;

type Out = { type: "cursor"; x: number; y: number } | { type: "ops"; upsert?: CanvasElement[]; remove?: string[] } | { type: "doc"; doc: string };

/**
 * All editor state: canvas elements, markdown doc, title; undo/redo; debounced persistence;
 * realtime relay (cursors, element ops, doc) over the file's websocket room.
 */
export function useFileState(file: FileFull, opts: { shareToken?: string; canEdit: boolean }) {
  const { shareToken, canEdit } = opts;
  const fileId = file.id;

  const [elements, setElements] = useState<CanvasElement[]>(file.content.canvas.elements);
  const els = useRef(elements);
  const [doc, setDocState] = useState(file.content.doc);
  const docRef = useRef(doc);
  const [title, setTitleState] = useState(file.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const synced = useRef(new Map(file.content.canvas.elements.map((e) => [e.id, e])));
  const pending = useRef<Pending>({ upsert: new Map(), remove: new Set() });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  const undoStack = useRef<CanvasElement[][]>([]);
  const redoStack = useRef<CanvasElement[][]>([]);
  const [, bump] = useState(0);
  const lastCheckpoint = useRef<{ key: string; t: number } | null>(null);

  // ---- realtime
  const ws = useRef<WebSocket | null>(null);
  const clientId = useRef("");
  const [others, setOthers] = useState<RtUser[]>([]);
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [connected, setConnected] = useState(false);
  const lastTransient = useRef(0);

  const rtSend = useCallback((m: Out) => {
    const s = ws.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(m));
  }, []);

  // ---- persistence
  const flush = useCallback(async () => {
    if (!canEdit) return;
    if (inflight.current) {
      timer.current = setTimeout(() => void flush(), 400);
      return;
    }
    const p = pending.current;
    if (!p.upsert.size && !p.remove.size && p.doc === undefined && p.title === undefined) return;
    pending.current = { upsert: new Map(), remove: new Set() };
    const body = { upsert: [...p.upsert.values()], remove: [...p.remove], doc: p.doc, title: p.title };
    inflight.current = true;
    setStatus("saving");
    try {
      if (shareToken) await api.share.ops(shareToken, body);
      else await api.files.ops(fileId, body);
      setStatus(pending.current.upsert.size || pending.current.remove.size || pending.current.doc !== undefined ? "saving" : "saved");
      setErrorMsg(null);
    } catch (e) {
      // put it back so the next change retries
      for (const [k, v] of p.upsert) if (!pending.current.upsert.has(k)) pending.current.upsert.set(k, v);
      for (const r of p.remove) pending.current.remove.add(r);
      if (p.doc !== undefined && pending.current.doc === undefined) pending.current.doc = p.doc;
      if (p.title !== undefined && pending.current.title === undefined) pending.current.title = p.title;
      setStatus("error");
      setErrorMsg((e as Error).message);
      timer.current = setTimeout(() => void flush(), 5000);
    } finally {
      inflight.current = false;
    }
  }, [canEdit, shareToken, fileId]);

  const schedule = useCallback(() => {
    if (!canEdit) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }, [canEdit, flush]);

  const flushNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return flush();
  }, [flush]);

  useEffect(() => {
    const vis = () => document.visibilityState === "hidden" && void flushNow();
    const unload = () => void flushNow();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("beforeunload", unload);
      void flushNow();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flushNow]);

  /** Compares the current elements with what the server has (or has queued) and queues the difference. */
  const queueDiff = useCallback(() => {
    const cur = els.current;
    const seen = new Set<string>();
    const up: CanvasElement[] = [];
    const rm: string[] = [];
    for (const e of cur) {
      seen.add(e.id);
      if (synced.current.get(e.id) !== e) {
        up.push(e);
        synced.current.set(e.id, e);
        pending.current.upsert.set(e.id, e);
        pending.current.remove.delete(e.id);
      }
    }
    for (const id of [...synced.current.keys()]) {
      if (!seen.has(id)) {
        rm.push(id);
        synced.current.delete(id);
        pending.current.upsert.delete(id);
        pending.current.remove.add(id);
      }
    }
    if (up.length || rm.length) {
      rtSend({ type: "ops", upsert: up, remove: rm });
      schedule();
    }
  }, [rtSend, schedule]);

  // ---- element mutations
  const setAll = useCallback((next: CanvasElement[]) => {
    els.current = next;
    setElements(next);
  }, []);

  /** Pushes the current state on the undo stack. Pass a key to merge rapid edits of the same kind. */
  const checkpoint = useCallback((key?: string) => {
    const now = Date.now();
    const last = lastCheckpoint.current;
    if (key && last && last.key === key && now - last.t < 1200) {
      lastCheckpoint.current = { key, t: now };
      return;
    }
    lastCheckpoint.current = key ? { key, t: now } : null;
    undoStack.current.push(els.current);
    if (undoStack.current.length > HISTORY_MAX) undoStack.current.shift();
    redoStack.current = [];
    bump((n) => n + 1);
  }, []);

  /** Updates elements. `transient` updates (during a drag) are shown locally/relayed but not persisted until `commit`. */
  const update = useCallback(
    (fn: (cur: CanvasElement[]) => CanvasElement[], o: { transient?: boolean } = {}) => {
      if (!canEdit) return;
      setAll(fn(els.current));
      if (o.transient) {
        const t = Date.now();
        if (t - lastTransient.current > 70) {
          lastTransient.current = t;
          const up: CanvasElement[] = [];
          for (const e of els.current) if (synced.current.get(e.id) !== e) up.push(e);
          if (up.length) rtSend({ type: "ops", upsert: up });
        }
      } else queueDiff();
    },
    [canEdit, queueDiff, rtSend, setAll],
  );

  const commit = useCallback(() => queueDiff(), [queueDiff]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev || !canEdit) return;
    redoStack.current.push(els.current);
    setAll(prev);
    queueDiff();
    bump((n) => n + 1);
  }, [canEdit, queueDiff, setAll]);
  const redo = useCallback(() => {
    const nxt = redoStack.current.pop();
    if (!nxt || !canEdit) return;
    undoStack.current.push(els.current);
    setAll(nxt);
    queueDiff();
    bump((n) => n + 1);
  }, [canEdit, queueDiff, setAll]);

  const setDoc = useCallback(
    (d: string) => {
      if (!canEdit) return;
      docRef.current = d;
      setDocState(d);
      pending.current.doc = d;
      rtSend({ type: "doc", doc: d });
      schedule();
    },
    [canEdit, rtSend, schedule],
  );

  const setTitle = useCallback(
    (t: string) => {
      if (!canEdit || !t.trim()) return;
      setTitleState(t);
      pending.current.title = t.trim();
      schedule();
    },
    [canEdit, schedule],
  );

  /** Replaces everything (version restore, import). */
  const replaceAll = useCallback(
    (c: FileContent, newTitle?: string) => {
      setAll(c.canvas.elements);
      synced.current = new Map(c.canvas.elements.map((e) => [e.id, e]));
      docRef.current = c.doc;
      setDocState(c.doc);
      if (newTitle) setTitleState(newTitle);
      undoStack.current = [];
      redoStack.current = [];
      pending.current = { upsert: new Map(), remove: new Set() };
      bump((n) => n + 1);
    },
    [setAll],
  );

  // ---- websocket
  useEffect(() => {
    let closed = false;
    let retry = 0;
    let reopen: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const q = shareToken ? `share=${encodeURIComponent(shareToken)}` : `token=${encodeURIComponent(tokenStore.get() ?? "")}`;
      let sock: WebSocket;
      try {
        sock = new WebSocket(`${WS_URL}/ws/file:${fileId}?${q}`);
      } catch {
        return;
      }
      ws.current = sock;
      sock.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      sock.onmessage = (ev) => {
        let m: RtMessage;
        try {
          m = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (m.type === "hello") {
          clientId.current = m.clientId;
          setOthers(m.users.filter((u) => u.clientId !== m.clientId));
        } else if (m.type === "presence") {
          setOthers(m.users.filter((u) => u.clientId !== clientId.current));
          setCursors((c) => {
            const keep: Record<string, Cursor> = {};
            for (const u of m.users) if (c[u.clientId]) keep[u.clientId] = c[u.clientId]!;
            return keep;
          });
        } else if (m.type === "cursor") {
          setCursors((c) => ({ ...c, [m.clientId]: { x: m.x, y: m.y, t: Date.now() } }));
        } else if (m.type === "ops") {
          const rm = new Set(m.remove ?? []);
          let next = els.current.filter((e) => !rm.has(e.id));
          for (const u of m.upsert ?? []) {
            const i = next.findIndex((e) => e.id === u.id);
            if (i >= 0) next = next.map((e, j) => (j === i ? u : e));
            else next = [...next, u];
            synced.current.set(u.id, u);
          }
          for (const id of rm) synced.current.delete(id);
          setAll(next);
        } else if (m.type === "doc") {
          docRef.current = m.doc;
          setDocState(m.doc);
        }
      };
      sock.onclose = () => {
        setConnected(false);
        setOthers([]);
        setCursors({});
        if (closed) return;
        retry++;
        reopen = setTimeout(connect, Math.min(15000, 600 * 2 ** Math.min(retry, 5)));
      };
      sock.onerror = () => sock.close();
    };
    connect();
    return () => {
      closed = true;
      if (reopen) clearTimeout(reopen);
      ws.current?.close();
      ws.current = null;
    };
  }, [fileId, shareToken, setAll]);

  const sendCursor = useCallback(
    (x: number, y: number) => {
      rtSend({ type: "cursor", x, y });
    },
    [rtSend],
  );

  return useMemo(
    () => ({
      elements,
      elementsRef: els,
      doc,
      title,
      status,
      errorMsg,
      update,
      commit,
      checkpoint,
      undo,
      redo,
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
      setDoc,
      setTitle,
      replaceAll,
      flushNow,
      others,
      cursors,
      connected,
      sendCursor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elements, doc, title, status, errorMsg, update, commit, checkpoint, undo, redo, setDoc, setTitle, replaceAll, flushNow, others, cursors, connected, sendCursor],
  );
}

export type FileState = ReturnType<typeof useFileState>;
