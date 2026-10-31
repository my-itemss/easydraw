import { create } from "zustand";
import type { El, Peer, Style, ToolType } from "./types";
import { clamp, rand } from "./lib/math";
import { commonBounds, expandGroups, isLinear, isShape, mutate, newId, refreshBindings, refreshText } from "./lib/elements";
import { loadName, loadSaved, saveSoon } from "./lib/storage";

export const DEFAULT_STYLE: Style = {
  strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "hachure", strokeWidth: 2, strokeStyle: "solid",
  roughness: 1, opacity: 100, rounded: true, fontSize: 24, fontFamily: "hand", textAlign: "left",
  startArrowhead: "none", endArrowhead: "arrow",
};

interface Snap { elements: El[]; selected: Set<string> }
export type Dialog = null | "help" | "export" | "collab" | "clear" | "command";
export type AlignKind = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

export interface AppStore {
  elements: El[];
  selected: Set<string>;
  tool: ToolType;
  toolLocked: boolean;
  zoom: number;
  scrollX: number;
  scrollY: number;
  viewport: { w: number; h: number };
  theme: "light" | "dark";
  canvasBg: string;
  grid: boolean;
  style: Style;
  editing: { id: string; isNew: boolean } | null;
  dialog: Dialog;
  menuOpen: boolean;
  toast: string | null;
  collab: { room: string | null; connected: boolean; name: string; peers: Peer[] };
  past: Snap[];
  future: Snap[];

  setTool: (t: ToolType, keepSelection?: boolean) => void;
  toggleToolLock: () => void;
  setElements: (els: El[]) => void;
  add: (els: El[], select?: boolean) => void;
  update: (ids: Iterable<string>, patch: Partial<El> | ((e: El) => Partial<El>)) => void;
  select: (ids: Iterable<string>) => void;
  selectAll: () => void;
  snapshot: () => Snap;
  commit: (before: Snap) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  applyStyle: (patch: Partial<Style>, silent?: boolean) => void;
  removeSelected: () => void;
  duplicate: () => void;
  group: () => void;
  ungroup: () => void;
  order: (kind: "front" | "back" | "forward" | "backward") => void;
  align: (kind: AlignKind) => void;
  distribute: (axis: "h" | "v") => void;
  toggleLock: () => void;
  translate: (ids: Set<string>, dx: number, dy: number) => void;
  setView: (zoom: number, scrollX: number, scrollY: number) => void;
  zoomBy: (factor: number, cx?: number, cy?: number) => void;
  zoomTo: (z: number) => void;
  fit: (selectionOnly?: boolean) => void;
  clearAll: () => void;
  setTheme: (t: "light" | "dark") => void;
  setCanvasBg: (c: string) => void;
  toggleGrid: () => void;
  setDialog: (d: Dialog) => void;
  showToast: (m: string) => void;
  setEditing: (e: { id: string; isNew: boolean } | null) => void;
  setCollab: (c: Partial<AppStore["collab"]>) => void;
  loadScene: (els: El[], canvasBg?: string, grid?: boolean) => void;
}

const saved = typeof window !== "undefined" ? loadSaved() : null;
const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
let toastTimer: number | undefined;

const live = (els: El[]) => els.filter((e) => !e.isDeleted);
const bump = (e: El, patch: Partial<El>) => mutate(e, patch);

export const useApp = create<AppStore>((set, get) => ({
  elements: saved?.elements ?? [],
  selected: new Set(),
  tool: "selection",
  toolLocked: false,
  zoom: 1,
  scrollX: 0,
  scrollY: 0,
  viewport: { w: 1200, h: 800 },
  theme: saved?.theme ?? (prefersDark ? "dark" : "light"),
  canvasBg: saved?.canvasBg ?? "#ffffff",
  grid: saved?.grid ?? false,
  style: { ...DEFAULT_STYLE, ...(saved?.style ?? {}) },
  editing: null,
  dialog: null,
  menuOpen: false,
  toast: null,
  collab: { room: null, connected: false, name: loadName(), peers: [] },
  past: [],
  future: [],

  setTool: (t, keep) => set((s) => ({ tool: t, selected: keep || t === "selection" ? s.selected : new Set(), editing: null })),
  toggleToolLock: () => set((s) => ({ toolLocked: !s.toolLocked })),
  setElements: (els) => set({ elements: els }),
  add: (els, sel = true) => set((s) => ({ elements: [...s.elements, ...els], selected: sel ? new Set(els.map((e) => e.id)) : s.selected })),

  update: (ids, patch) => {
    const set_ = new Set(ids);
    if (!set_.size) return;
    let moved = false;
    let els = get().elements.map((e) => {
      if (!set_.has(e.id) || e.isDeleted) return e;
      const p = typeof patch === "function" ? patch(e) : patch;
      moved = true;
      let n = bump(e, p);
      if (e.type === "text" && ("fontSize" in p || "fontFamily" in p || "text" in p)) n = refreshText(n);
      return n;
    });
    if (!moved) return;
    els = refreshBindings(els, set_);
    set({ elements: els });
  },

  select: (ids) => set((s) => ({ selected: expandGroups(s.elements, ids) })),
  selectAll: () => set((s) => ({ selected: new Set(live(s.elements).filter((e) => !e.locked).map((e) => e.id)), tool: "selection" })),

  snapshot: () => ({ elements: get().elements, selected: get().selected }),
  commit: (before) => {
    if (get().elements === before.elements) return;
    set((s) => ({ past: [...s.past.slice(-99), before], future: [] }));
  },
  checkpoint: () => {
    const b = get().snapshot();
    set((s) => ({ past: [...s.past.slice(-99), b], future: [] }));
  },

  undo: () => {
    const { past, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    const cur = get().snapshot();
    set({ past: past.slice(0, -1), future: [...future, cur] });
    restore(prev);
  },
  redo: () => {
    const { past, future } = get();
    if (!future.length) return;
    const next = future[future.length - 1];
    const cur = get().snapshot();
    set({ future: future.slice(0, -1), past: [...past, cur] });
    restore(next);
  },

  applyStyle: (patch, silent) => {
    const before = get().snapshot();
    set((s) => ({ style: { ...s.style, ...patch } }));
    const ids = [...get().selected];
    if (!ids.length) return;
    get().update(ids, (e) => {
      const p: Partial<El> = {};
      const sh = isShape(e), ln = isLinear(e), tx = e.type === "text", fd = e.type === "freedraw", im = e.type === "image";
      for (const [k, v] of Object.entries(patch) as [keyof Style, never][]) {
        switch (k) {
          case "strokeColor": if (!im) p.strokeColor = v; break;
          case "backgroundColor": if (sh) p.backgroundColor = v; break;
          case "fillStyle": if (sh) p.fillStyle = v; break;
          case "strokeWidth": case "strokeStyle": if (sh || ln || fd) (p as Record<string, unknown>)[k] = v; break;
          case "roughness": if (sh || ln) p.roughness = v; break;
          case "opacity": p.opacity = v; break;
          case "rounded": if (sh || ln) p.rounded = v; break;
          case "fontSize": case "fontFamily": if (tx || sh) (p as Record<string, unknown>)[k] = v; break;
          case "textAlign": if (tx) p.textAlign = v; break;
          case "startArrowhead": if (e.type === "arrow") p.startArrowhead = v; break;
          case "endArrowhead": if (e.type === "arrow") p.endArrowhead = v; break;
        }
      }
      return p;
    });
    if (!silent) get().commit(before);
  },

  removeSelected: () => {
    const ids = get().selected;
    if (!ids.size) return;
    get().checkpoint();
    const dead = new Set(ids);
    set((s) => ({
      elements: s.elements.map((e) => {
        if (dead.has(e.id) && !e.isDeleted) return bump(e, { isDeleted: true });
        if (e.type === "arrow" && ((e.startBinding && dead.has(e.startBinding)) || (e.endBinding && dead.has(e.endBinding))))
          return bump(e, { startBinding: e.startBinding && dead.has(e.startBinding) ? null : e.startBinding, endBinding: e.endBinding && dead.has(e.endBinding) ? null : e.endBinding });
        return e;
      }),
      selected: new Set(),
    }));
  },

  duplicate: () => {
    const sel = live(get().elements).filter((e) => get().selected.has(e.id));
    if (!sel.length) return;
    get().checkpoint();
    const copies = cloneElements(sel, 16, 16);
    set((s) => ({ elements: [...s.elements, ...copies], selected: new Set(copies.map((c) => c.id)) }));
  },

  group: () => {
    const ids = get().selected;
    if (ids.size < 2) return;
    get().checkpoint();
    const gid = newId();
    get().update(ids, (e) => ({ groupIds: [...e.groupIds, gid] }));
  },
  ungroup: () => {
    const ids = get().selected;
    get().checkpoint();
    get().update(ids, (e) => ({ groupIds: e.groupIds.slice(0, -1) }));
  },

  order: (kind) => {
    const ids = get().selected;
    if (!ids.size) return;
    get().checkpoint();
    let els = get().elements.slice();
    const isSel = (e: El) => ids.has(e.id);
    if (kind === "front") els = [...els.filter((e) => !isSel(e)), ...els.filter(isSel)];
    else if (kind === "back") els = [...els.filter(isSel), ...els.filter((e) => !isSel(e))];
    else if (kind === "forward") {
      for (let i = els.length - 2; i >= 0; i--) if (isSel(els[i]) && !isSel(els[i + 1])) [els[i], els[i + 1]] = [els[i + 1], els[i]];
    } else {
      for (let i = 1; i < els.length; i++) if (isSel(els[i]) && !isSel(els[i - 1])) [els[i], els[i - 1]] = [els[i - 1], els[i]];
    }
    // bump versions so peers receive the new order
    els = els.map((e, i) => (e !== get().elements[i] ? bump(e, {}) : e));
    set({ elements: els });
  },

  align: (kind) => {
    const sel = live(get().elements).filter((e) => get().selected.has(e.id));
    if (sel.length < 2) return;
    const b = commonBounds(sel)!;
    get().checkpoint();
    const moves = new Map<string, [number, number]>();
    for (const e of sel) {
      const eb = commonBounds([e])!;
      let dx = 0, dy = 0;
      if (kind === "left") dx = b[0] - eb[0];
      if (kind === "right") dx = b[2] - eb[2];
      if (kind === "centerH") dx = (b[0] + b[2]) / 2 - (eb[0] + eb[2]) / 2;
      if (kind === "top") dy = b[1] - eb[1];
      if (kind === "bottom") dy = b[3] - eb[3];
      if (kind === "centerV") dy = (b[1] + b[3]) / 2 - (eb[1] + eb[3]) / 2;
      moves.set(e.id, [dx, dy]);
    }
    get().update(moves.keys(), (e) => ({ x: e.x + moves.get(e.id)![0], y: e.y + moves.get(e.id)![1] }));
  },

  distribute: (axis) => {
    const sel = live(get().elements).filter((e) => get().selected.has(e.id));
    if (sel.length < 3) return;
    get().checkpoint();
    const i0 = axis === "h" ? 0 : 1, i1 = axis === "h" ? 2 : 3;
    const items = sel.map((e) => ({ e, b: commonBounds([e])! })).sort((a, b) => a.b[i0] - b.b[i0]);
    const total = items[items.length - 1].b[i1] - items[0].b[i0];
    const sizes = items.reduce((s, it) => s + (it.b[i1] - it.b[i0]), 0);
    const gap = (total - sizes) / (items.length - 1);
    let cursor = items[0].b[i0];
    const moves = new Map<string, number>();
    for (const it of items) { moves.set(it.e.id, cursor - it.b[i0]); cursor += it.b[i1] - it.b[i0] + gap; }
    get().update(moves.keys(), (e) => (axis === "h" ? { x: e.x + moves.get(e.id)! } : { y: e.y + moves.get(e.id)! }));
  },

  toggleLock: () => {
    const ids = get().selected;
    if (!ids.size) return;
    get().checkpoint();
    const allLocked = live(get().elements).filter((e) => ids.has(e.id)).every((e) => e.locked);
    get().update(ids, { locked: !allLocked });
  },

  translate: (ids, dx, dy) => get().update(ids, (e) => ({ x: e.x + dx, y: e.y + dy })),

  setView: (zoom, scrollX, scrollY) => set({ zoom: clamp(zoom, 0.1, 30), scrollX, scrollY }),
  zoomBy: (factor, cx, cy) => {
    const { zoom, scrollX, scrollY, viewport } = get();
    const nz = clamp(zoom * factor, 0.1, 30);
    const px = cx ?? viewport.w / 2, py = cy ?? viewport.h / 2;
    const sx = px / zoom - scrollX, sy = py / zoom - scrollY;
    set({ zoom: nz, scrollX: px / nz - sx, scrollY: py / nz - sy });
  },
  zoomTo: (z) => get().zoomBy(z / get().zoom),
  fit: (selectionOnly) => {
    const { elements, selected, viewport } = get();
    const pool = live(elements).filter((e) => !selectionOnly || selected.has(e.id));
    const b = commonBounds(pool);
    if (!b) return set({ zoom: 1, scrollX: 0, scrollY: 0 });
    const pad = 80;
    const bw = Math.max(1, b[2] - b[0]), bh = Math.max(1, b[3] - b[1]);
    const z = clamp(Math.min((viewport.w - pad * 2) / bw, (viewport.h - pad * 2) / bh, 2), 0.1, 2);
    set({ zoom: z, scrollX: viewport.w / 2 / z - (b[0] + b[2]) / 2, scrollY: viewport.h / 2 / z - (b[1] + b[3]) / 2 });
  },

  clearAll: () => {
    get().checkpoint();
    set((s) => ({ elements: s.elements.map((e) => (e.isDeleted ? e : bump(e, { isDeleted: true }))), selected: new Set() }));
  },
  setTheme: (theme) => set({ theme }),
  setCanvasBg: (canvasBg) => set({ canvasBg }),
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  setDialog: (dialog) => set({ dialog, menuOpen: false }),
  showToast: (m) => {
    set({ toast: m });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set({ toast: null }), 2200);
  },
  setEditing: (editing) => set({ editing }),
  setCollab: (c) => set((s) => ({ collab: { ...s.collab, ...c } })),
  loadScene: (els, bg, grid) => {
    get().checkpoint();
    set((s) => ({
      elements: [...s.elements.map((e) => (e.isDeleted ? e : bump(e, { isDeleted: true }))), ...els],
      canvasBg: bg ?? s.canvasBg, grid: grid ?? s.grid, selected: new Set(),
    }));
    get().fit();
  },
}));

function restore(snap: Snap) {
  const cur = new Map(useApp.getState().elements.map((e) => [e.id, e]));
  const out: El[] = snap.elements.map((e) => {
    const c = cur.get(e.id);
    if (c === e) return e;
    return { ...e, version: Math.max(c?.version ?? 0, e.version) + 1, versionNonce: rand() };
  });
  const seen = new Set(out.map((e) => e.id));
  for (const c of cur.values()) if (!seen.has(c.id) && !c.isDeleted) out.push({ ...c, isDeleted: true, version: c.version + 1, versionNonce: rand() });
  useApp.setState({ elements: out, selected: new Set([...snap.selected].filter((id) => out.some((e) => e.id === id && !e.isDeleted))), editing: null });
}

export function cloneElements(els: El[], dx: number, dy: number): El[] {
  const idMap = new Map<string, string>();
  const gMap = new Map<string, string>();
  for (const e of els) idMap.set(e.id, newId());
  return els.map((e) => ({
    ...e,
    id: idMap.get(e.id)!, x: e.x + dx, y: e.y + dy, seed: rand(), version: 1, versionNonce: rand(),
    groupIds: e.groupIds.map((g) => { if (!gMap.has(g)) gMap.set(g, newId()); return gMap.get(g)!; }),
    startBinding: e.startBinding && idMap.has(e.startBinding) ? idMap.get(e.startBinding)! : null,
    endBinding: e.endBinding && idMap.has(e.endBinding) ? idMap.get(e.endBinding)! : null,
  }));
}

/* clipboard (in-memory fallback) */
export const CLIP_TYPE = "easydraw/clip";

/* autosave */
useApp.subscribe((s, p) => {
  if (s.elements !== p.elements || s.theme !== p.theme || s.canvasBg !== p.canvasBg || s.grid !== p.grid || s.style !== p.style)
    saveSoon(() => { const g = useApp.getState(); return { elements: g.elements, canvasBg: g.canvasBg, grid: g.grid, theme: g.theme, style: g.style }; });
});

export const getSelected = (s: Pick<AppStore, "elements" | "selected">) => s.elements.filter((e) => !e.isDeleted && s.selected.has(e.id));
