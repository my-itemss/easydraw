import { useCallback, useEffect, useRef, useState } from "react";
import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";
import { CLIP_TYPE, cloneElements, getSelected, useApp } from "../store";
import type { El, Pt, ToolType } from "../types";
import {
  absPoints, bindableAt, center, commonBounds, containerAt, createElement, hitElement, hitTest, isLinear, mutate,
  recomputeArrow, refreshText, setPointsAbs,
} from "../lib/elements";
import { clamp, dist, rotatePoint, snap } from "../lib/math";
import { HANDLE_PX, handleDir, renderScene, selectionGeometry, setImageLoadHandler, type HandleId } from "../lib/render";
import { sendPointer } from "../lib/collab";
import { parseScene, readImage } from "../lib/export";
import { beginEdit, beginText } from "./TextEditor";
import ContextMenu from "./ContextMenu";

type Snap = ReturnType<ReturnType<typeof useApp.getState>["snapshot"]>;
type G =
  | { k: "pan"; sx: number; sy: number; scrollX: number; scrollY: number }
  | { k: "move"; start: Pt; orig: Map<string, El>; before: Snap; moved: boolean }
  | { k: "marquee"; start: Pt; base: Set<string> }
  | { k: "create"; id: string; start: Pt; before: Snap; tool: ToolType; downAt: Pt }
  | { k: "multi"; id: string; before: Snap }
  | { k: "resize"; handle: HandleId; start: Pt; orig: El[]; cx: number; cy: number; w: number; h: number; angle: number; before: Snap }
  | { k: "rotate"; start: Pt; orig: El[]; c: Pt; a0: number; before: Snap }
  | { k: "point"; id: string; index: number; before: Snap }
  | { k: "erase"; ids: Set<string>; last: Pt; before: Snap };

const GRID = 20;
const ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='9' fill='rgba(105,101,219,0.12)' stroke='%236965db' stroke-width='1.6'/></svg>") 12 12, crosshair`;

const TOOL_CURSOR: Partial<Record<ToolType, string>> = {
  rectangle: "crosshair", diamond: "crosshair", ellipse: "crosshair", arrow: "crosshair", line: "crosshair", freedraw: "crosshair",
  text: "text", eraser: ERASER_CURSOR, hand: "grab",
};

const S = () => useApp.getState();

export default function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const rc = useRef<RoughCanvas | null>(null);
  const g = useRef<G | null>(null);
  const ui = useRef({
    marquee: null as { x: number; y: number; w: number; h: number } | null,
    bind: null as string | null, erasing: new Set<string>(), hover: null as number | null,
    last: [0, 0] as Pt, space: false, raf: 0,
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  /* ---------- coordinate helpers ---------- */
  const toScene = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const r = ref.current!.getBoundingClientRect();
    const s = S();
    return [(e.clientX - r.left) / s.zoom - s.scrollX, (e.clientY - r.top) / s.zoom - s.scrollY];
  }, []);
  const snapPt = (p: Pt): Pt => (S().grid ? [snap(p[0], GRID), snap(p[1], GRID)] : p);

  /* ---------- drawing ---------- */
  const draw = useCallback(() => {
    ui.current.raf = 0;
    const canvas = ref.current;
    if (!canvas || !rc.current) return;
    const s = S();
    renderScene(canvas, rc.current, {
      elements: s.elements, selected: s.selected, zoom: s.zoom, scrollX: s.scrollX, scrollY: s.scrollY,
      dark: s.theme === "dark", canvasBg: s.canvasBg, grid: s.grid, width: s.viewport.w, height: s.viewport.h,
      dpr: window.devicePixelRatio || 1, editingId: s.editing?.id ?? null, marquee: ui.current.marquee,
      bindHighlight: ui.current.bind, erasing: ui.current.erasing, peers: s.collab.peers, linearHover: ui.current.hover,
    });
  }, []);
  const schedule = useCallback(() => { if (!ui.current.raf) ui.current.raf = requestAnimationFrame(draw); }, [draw]);

  useEffect(() => {
    const canvas = ref.current!;
    rc.current = rough.canvas(canvas);
    setImageLoadHandler(schedule);
    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
      rc.current = rough.canvas(canvas);
      useApp.setState({ viewport: { w: r.width, h: r.height } });
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize();
    const unsub = useApp.subscribe(schedule);
    return () => { ro.disconnect(); unsub(); };
  }, [draw, schedule]);

  /* ---------- cursor ---------- */
  const setCursor = (c: string) => { if (ref.current) ref.current.style.cursor = c; };
  useEffect(() => {
    return useApp.subscribe((s, p) => {
      if (s.tool !== p.tool && !g.current) setCursor(TOOL_CURSOR[s.tool] ?? "default");
    });
  }, []);
  useEffect(() => setCursor(TOOL_CURSOR[S().tool] ?? "default"), []);

  /* ---------- helpers: finish / delete ---------- */
  const deleteIds = (ids: Set<string>) => {
    useApp.setState((s) => ({
      elements: s.elements.map((e) => {
        if (ids.has(e.id) && !e.isDeleted) return mutate(e, { isDeleted: true });
        if (e.type === "arrow" && ((e.startBinding && ids.has(e.startBinding)) || (e.endBinding && ids.has(e.endBinding))))
          return mutate(e, { startBinding: e.startBinding && ids.has(e.startBinding) ? null : e.startBinding, endBinding: e.endBinding && ids.has(e.endBinding) ? null : e.endBinding });
        return e;
      }),
    }));
  };

  const finishMulti = () => {
    const cur = g.current;
    if (!cur || cur.k !== "multi") return;
    const s = S();
    const el = s.elements.find((e) => e.id === cur.id);
    if (el) {
      const abs = absPoints(el);
      abs.pop(); // drop the preview point
      const clean = abs.filter((p, i) => i === 0 || dist(p, abs[i - 1]) > 2 / s.zoom);
      if (clean.length < 2) deleteIds(new Set([el.id]));
      else {
        let n = setPointsAbs(el, clean);
        const last = clean[clean.length - 1];
        const target = n.type === "arrow" ? bindableAt(S().elements, last, s.zoom, n.id) : null;
        if (target) n = recomputeArrow({ ...n, endBinding: target.id }, new Map(S().elements.map((e) => [e.id, e])));
        s.setElements(S().elements.map((e) => (e.id === el.id ? n : e)));
        s.commit(cur.before);
        s.select([el.id]);
      }
    }
    g.current = null; ui.current.bind = null;
    if (!S().toolLocked) s.setTool("selection", true);
    schedule();
  };

  /* ---------- pointer down ---------- */
  const onDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    setMenu(null);
    ref.current!.setPointerCapture(e.pointerId);
    const s = S();
    let p = toScene(e);
    ui.current.last = p;

    // multi-point line in progress: add a vertex
    const mg = g.current;
    if (mg?.k === "multi") {
      const el = s.elements.find((x) => x.id === mg.id);
      if (el) {
        const abs = absPoints(el);
        abs[abs.length - 1] = snapPt(p);
        abs.push(snapPt(p));
        s.setElements(s.elements.map((x) => (x.id === el.id ? setPointsAbs(el, abs) : x)));
      }
      return;
    }

    if (e.button === 1 || s.tool === "hand" || ui.current.space) {
      g.current = { k: "pan", sx: e.clientX, sy: e.clientY, scrollX: s.scrollX, scrollY: s.scrollY };
      setCursor("grabbing");
      return;
    }

    const before = s.snapshot();

    if (s.tool === "selection") {
      const sel = getSelected(s);
      const geo = sel.length && !sel.every((x) => x.locked) ? selectionGeometry(sel, s.zoom) : null;
      if (geo?.linear) {
        const { pts, mids, el } = geo.linear;
        const pi = pts.findIndex((q) => dist(q, p) < 10 / s.zoom);
        if (pi >= 0) { g.current = { k: "point", id: el.id, index: pi, before }; return; }
        const mi = mids.findIndex((q) => dist(q, p) < 8 / s.zoom);
        if (mi >= 0) {
          const abs = absPoints(el);
          abs.splice(mi + 1, 0, mids[mi]);
          s.setElements(s.elements.map((x) => (x.id === el.id ? setPointsAbs(el, abs) : x)));
          g.current = { k: "point", id: el.id, index: mi + 1, before };
          return;
        }
      } else if (geo) {
        for (const [k, q] of Object.entries(geo.handles) as [HandleId, Pt][]) {
          if (dist(q, p) > (k === "rotate" ? HANDLE_PX * 0.9 : HANDLE_PX) / s.zoom + 2 / s.zoom) continue;
          if (k === "rotate") {
            const c: Pt = [geo.cx, geo.cy];
            g.current = { k: "rotate", start: p, orig: sel, c, a0: Math.atan2(p[1] - c[1], p[0] - c[0]), before };
          } else {
            g.current = { k: "resize", handle: k, start: p, orig: sel, cx: geo.cx, cy: geo.cy, w: geo.w, h: geo.h, angle: geo.angle, before };
          }
          return;
        }
      }

      const hit = hitTest(s.elements, p, s.zoom);
      if (hit) {
        if (e.shiftKey) {
          const ids = new Set(s.selected);
          if (ids.has(hit.id)) { for (const id of s.selected) if (s.elements.find((x) => x.id === id)?.groupIds.some((gid) => hit.groupIds.includes(gid)) || id === hit.id) ids.delete(id); }
          else ids.add(hit.id);
          s.select(ids);
          return;
        }
        if (!s.selected.has(hit.id)) s.select([hit.id]);
        let ids = S().selected;
        let orig = new Map(getSelected(S()).filter((x) => !x.locked).map((x) => [x.id, x]));
        if (e.altKey && orig.size) {
          const copies = cloneElements([...orig.values()], 0, 0);
          s.add(copies, true);
          ids = S().selected;
          orig = new Map(copies.map((c) => [c.id, c]));
        }
        if (!orig.size && ids.size) return;
        g.current = { k: "move", start: p, orig, before, moved: false };
        setCursor("move");
        return;
      }
      if (!e.shiftKey) s.select([]);
      g.current = { k: "marquee", start: p, base: e.shiftKey ? new Set(s.selected) : new Set() };
      return;
    }

    if (s.tool === "eraser") {
      g.current = { k: "erase", ids: new Set(), last: p, before };
      eraseAt(p, g.current);
      return;
    }

    if (s.tool === "text") {
      g.current = { k: "create", id: "", start: p, before, tool: "text", downAt: p };
      return;
    }

    if (s.tool === "image") return;

    // shapes / linear / freedraw
    p = snapPt(p);
    const style = s.style;
    const type = s.tool as El["type"];
    let el = createElement(type, p[0], p[1], style);
    if (type === "freedraw") el = setPointsAbs(el, [p]);
    if (type === "arrow") {
      const t = bindableAt(s.elements, p, s.zoom);
      if (t) el = { ...el, startBinding: t.id };
    }
    if (isLinear(el)) el = setPointsAbs(el, [p, p]);
    s.add([el], false);
    s.select([]);
    g.current = { k: "create", id: el.id, start: p, before, tool: s.tool, downAt: p };
  };

  const eraseAt = (p: Pt, cur: Extract<G, { k: "erase" }>) => {
    const s = S();
    const a = cur.last;
    const n = Math.max(1, Math.ceil(dist(a, p) / (4 / s.zoom)));
    for (let i = 1; i <= n; i++) {
      const q: Pt = [a[0] + ((p[0] - a[0]) * i) / n, a[1] + ((p[1] - a[1]) * i) / n];
      const hit = hitTest(s.elements, q, s.zoom, (x) => !x.locked && !cur.ids.has(x.id));
      if (hit) { cur.ids.add(hit.id); }
    }
    cur.last = p;
    ui.current.erasing = cur.ids;
  };

  /* ---------- pointer move ---------- */
  const onMove = (e: React.PointerEvent) => {
    const s = S();
    const p = toScene(e);
    ui.current.last = p;
    sendPointer(p[0], p[1]);
    const cur = g.current;

    if (!cur) { hover(p, e); return; }

    switch (cur.k) {
      case "pan": {
        useApp.setState({ scrollX: cur.scrollX + (e.clientX - cur.sx) / s.zoom, scrollY: cur.scrollY + (e.clientY - cur.sy) / s.zoom });
        break;
      }
      case "move": {
        let dx = p[0] - cur.start[0], dy = p[1] - cur.start[1];
        if (!cur.moved && Math.hypot(dx, dy) * s.zoom < 3) return;
        cur.moved = true;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        if (s.grid) {
          const first = cur.orig.values().next().value as El;
          const b = commonBounds([first])!;
          dx = snap(b[0] + dx, GRID) - b[0]; dy = snap(b[1] + dy, GRID) - b[1];
        }
        const ids = new Set(cur.orig.keys());
        s.update(ids, (el) => {
          const o = cur.orig.get(el.id)!;
          const patch: Partial<El> = { x: o.x + dx, y: o.y + dy };
          if (el.type === "arrow") {
            if (el.startBinding && !ids.has(el.startBinding)) patch.startBinding = null;
            if (el.endBinding && !ids.has(el.endBinding)) patch.endBinding = null;
          }
          return patch;
        });
        break;
      }
      case "marquee": {
        const x = Math.min(cur.start[0], p[0]), y = Math.min(cur.start[1], p[1]);
        const w = Math.abs(p[0] - cur.start[0]), h = Math.abs(p[1] - cur.start[1]);
        ui.current.marquee = { x, y, w, h };
        const ids = new Set(cur.base);
        for (const el of s.elements) {
          if (el.isDeleted) continue;
          const b = commonBounds([el])!;
          if (b[0] >= x && b[1] >= y && b[2] <= x + w && b[3] <= y + h) ids.add(el.id);
        }
        s.select(ids);
        schedule();
        break;
      }
      case "create": moveCreate(cur, p, e); break;
      case "multi": {
        const el = s.elements.find((x) => x.id === cur.id);
        if (!el) break;
        const abs = absPoints(el);
        let q = snapPt(p);
        if (e.shiftKey && abs.length > 1) q = angleSnap(abs[abs.length - 2], q);
        abs[abs.length - 1] = q;
        s.setElements(s.elements.map((x) => (x.id === el.id ? setPointsAbs(el, abs) : x)));
        break;
      }
      case "resize": doResize(cur, p, e); break;
      case "rotate": {
        let d = Math.atan2(p[1] - cur.c[1], p[0] - cur.c[0]) - cur.a0;
        if (e.shiftKey) {
          if (cur.orig.length === 1) d = Math.round((cur.orig[0].angle + d) / (Math.PI / 12)) * (Math.PI / 12) - cur.orig[0].angle;
          else d = Math.round(d / (Math.PI / 12)) * (Math.PI / 12);
        }
        const map = new Map(cur.orig.map((o) => [o.id, o]));
        s.update(map.keys(), (el) => {
          const o = map.get(el.id)!;
          const c = rotatePoint(center(o), cur.c, d);
          return { angle: o.angle + d, x: c[0] - o.width / 2, y: c[1] - o.height / 2 };
        });
        break;
      }
      case "point": {
        const el = s.elements.find((x) => x.id === cur.id);
        if (!el) break;
        const abs = absPoints(el);
        let q = e.altKey ? p : snapPt(p);
        if (e.shiftKey && abs.length > 1) q = angleSnap(abs[cur.index === 0 ? 1 : cur.index - 1], q);
        abs[cur.index] = q;
        let n = setPointsAbs(el, abs);
        const isEnd = cur.index === 0 || cur.index === abs.length - 1;
        ui.current.bind = null;
        if (el.type === "arrow" && isEnd) {
          const t = bindableAt(s.elements, q, s.zoom, el.id);
          const key = cur.index === 0 ? "startBinding" : "endBinding";
          n = { ...n, [key]: t ? t.id : null };
          ui.current.bind = t ? t.id : null;
        }
        const byId = new Map(s.elements.map((x) => [x.id, x]));
        n = recomputeArrow(n, byId);
        s.setElements(s.elements.map((x) => (x.id === el.id ? n : x)));
        break;
      }
      case "erase": eraseAt(p, cur); schedule(); break;
    }
  };

  const angleSnap = (from: Pt, to: Pt): Pt => {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const r = Math.hypot(dx, dy);
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
    return [from[0] + Math.cos(a) * r, from[1] + Math.sin(a) * r];
  };

  const moveCreate = (cur: Extract<G, { k: "create" }>, pRaw: Pt, e: React.PointerEvent) => {
    const s = S();
    if (cur.tool === "text") return;
    const el = s.elements.find((x) => x.id === cur.id);
    if (!el) return;
    const p = snapPt(pRaw);
    if (cur.tool === "freedraw") {
      const abs = absPoints(el);
      abs.push(p);
      s.setElements(s.elements.map((x) => (x.id === el.id ? setPointsAbs(el, abs) : x)));
      return;
    }
    if (isLinear(el)) {
      const q = e.shiftKey ? angleSnap(cur.start, p) : p;
      let n = setPointsAbs(el, [cur.start, q]);
      ui.current.bind = null;
      if (el.type === "arrow") {
        const t = bindableAt(s.elements, q, s.zoom, el.id);
        n = { ...n, endBinding: t ? t.id : null };
        ui.current.bind = t ? t.id : null;
        n = recomputeArrow(n, new Map(s.elements.map((x) => [x.id, x])));
      }
      s.setElements(s.elements.map((x) => (x.id === el.id ? n : x)));
      return;
    }
    let w = p[0] - cur.start[0], h = p[1] - cur.start[1];
    if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    if (e.altKey) {
      s.update([el.id], { x: cur.start[0] - Math.abs(w), y: cur.start[1] - Math.abs(h), width: Math.abs(w) * 2, height: Math.abs(h) * 2 });
    } else {
      s.update([el.id], { x: w < 0 ? cur.start[0] + w : cur.start[0], y: h < 0 ? cur.start[1] + h : cur.start[1], width: Math.abs(w), height: Math.abs(h) });
    }
  };

  const doResize = (cur: Extract<G, { k: "resize" }>, p: Pt, e: React.PointerEvent) => {
    const s = S();
    const [dirx, diry] = handleDir(cur.handle);
    const d = rotatePoint([p[0] - cur.start[0], p[1] - cur.start[1]], [0, 0], -cur.angle);
    let nw = cur.w + dirx * d[0], nh = cur.h + diry * d[1];
    const single = cur.orig.length === 1 ? cur.orig[0] : null;
    const keepRatio = e.shiftKey || (single?.type === "image" && dirx !== 0 && diry !== 0) || single?.type === "text";
    if (keepRatio && cur.w && cur.h) {
      const sc = dirx !== 0 && diry !== 0 ? Math.max(Math.abs(nw / cur.w), Math.abs(nh / cur.h)) : dirx !== 0 ? Math.abs(nw / cur.w) : Math.abs(nh / cur.h);
      nw = cur.w * sc; nh = cur.h * sc;
    }
    nw = Math.max(nw, 4); nh = Math.max(nh, 4);
    const sx = nw / (cur.w || 1), sy = nh / (cur.h || 1);
    const off = rotatePoint([(dirx * (nw - cur.w)) / 2, (diry * (nh - cur.h)) / 2], [0, 0], cur.angle);
    const ncx = cur.cx + off[0], ncy = cur.cy + off[1];

    if (single) {
      s.update([single.id], () => {
        const patch: Partial<El> = { x: ncx - nw / 2, y: ncy - nh / 2, width: nw, height: nh };
        if (single.points) patch.points = single.points.map((q) => [q[0] * sx, q[1] * sy] as Pt);
        if (single.type === "text") {
          const fs = Math.max(8, Math.round((single.fontSize ?? 20) * sy));
          const r = refreshText({ ...single, fontSize: fs });
          patch.fontSize = fs; patch.width = r.width; patch.height = r.height;
          patch.x = ncx - r.width / 2; patch.y = ncy - r.height / 2;
        }
        return patch;
      });
    } else {
      const ax = cur.cx - cur.w / 2, ay = cur.cy - cur.h / 2;
      const nx = ncx - nw / 2, ny = ncy - nh / 2;
      const map = new Map(cur.orig.map((o) => [o.id, o]));
      s.update(map.keys(), (el) => {
        const o = map.get(el.id)!;
        const patch: Partial<El> = { x: nx + (o.x - ax) * sx, y: ny + (o.y - ay) * sy, width: o.width * sx, height: o.height * sy };
        if (o.points) patch.points = o.points.map((q) => [q[0] * sx, q[1] * sy] as Pt);
        if (o.type === "text") {
          const fs = Math.max(8, Math.round((o.fontSize ?? 20) * Math.min(sx, sy)));
          const r = refreshText({ ...o, fontSize: fs });
          patch.fontSize = fs; patch.width = r.width; patch.height = r.height;
        }
        return patch;
      });
    }
  };

  const hover = (p: Pt, e: React.PointerEvent) => {
    const s = S();
    if (ui.current.space || s.tool === "hand") return;
    if (s.tool !== "selection") { setCursor(TOOL_CURSOR[s.tool] ?? "crosshair"); return; }
    const sel = getSelected(s);
    const geo = sel.length && !sel.every((x) => x.locked) ? selectionGeometry(sel, s.zoom) : null;
    let cursor = "default";
    ui.current.hover = null;
    if (geo?.linear) {
      const i = geo.linear.pts.findIndex((q) => dist(q, p) < 10 / s.zoom);
      if (i >= 0) { cursor = "pointer"; ui.current.hover = i; }
      else if (geo.linear.mids.some((q) => dist(q, p) < 8 / s.zoom)) cursor = "copy";
    } else if (geo) {
      for (const [k, q] of Object.entries(geo.handles) as [HandleId, Pt][]) {
        if (dist(q, p) > (HANDLE_PX + 2) / s.zoom) continue;
        if (k === "rotate") cursor = "grab";
        else {
          const [dx, dy] = handleDir(k);
          const a = Math.atan2(dy, dx) + geo.angle;
          const i = ((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4;
          cursor = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][i];
        }
        break;
      }
    }
    if (cursor === "default" && ui.current.hover === null && hitTest(s.elements, p, s.zoom)) cursor = "move";
    setCursor(cursor);
    void e;
    schedule();
  };

  /* ---------- pointer up ---------- */
  const onUp = (e: React.PointerEvent) => {
    const cur = g.current;
    if (!cur) return;
    const s = S();
    const p = toScene(e);
    try { ref.current!.releasePointerCapture(e.pointerId); } catch { /* */ }

    switch (cur.k) {
      case "pan": break;
      case "move": s.commit(cur.before); break;
      case "marquee": ui.current.marquee = null; break;
      case "resize": case "rotate": case "point": s.commit(cur.before); ui.current.bind = null; break;
      case "erase": {
        if (cur.ids.size) { deleteIds(cur.ids); s.commit(cur.before); }
        ui.current.erasing = new Set();
        break;
      }
      case "create": {
        if (cur.tool === "text") {
          if (dist(cur.downAt, p) * s.zoom < 6) {
            const hit = hitTest(s.elements, p, s.zoom, (x) => x.type === "text" || ["rectangle", "diamond", "ellipse"].includes(x.type)) ?? containerAt(s.elements, p);
            if (hit) beginEdit(hit.id); else beginText(p[0], p[1]);
          }
          break;
        }
        const el = s.elements.find((x) => x.id === cur.id);
        if (!el) break;
        const tiny = isLinear(el) ? dist(cur.start, p) * s.zoom < 4 : cur.tool === "freedraw" ? false : el.width * s.zoom < 3 && el.height * s.zoom < 3;
        if (isLinear(el) && tiny) {
          // click without drag → multi-point mode
          g.current = { k: "multi", id: el.id, before: cur.before };
          return;
        }
        if (tiny) { deleteIds(new Set([el.id])); break; }
        s.commit(cur.before);
        if (cur.tool === "freedraw") { /* stay on the pencil */ }
        else {
          s.select([el.id]);
          if (!s.toolLocked) s.setTool("selection", true);
        }
        ui.current.bind = null;
        break;
      }
      case "multi": return; // finalised by dblclick / Enter / Esc
    }
    g.current = null;
    setCursor(TOOL_CURSOR[S().tool] ?? "default");
    schedule();
  };

  const onDouble = (e: React.MouseEvent) => {
    if (g.current?.k === "multi") { finishMulti(); return; }
    const s = S();
    if (s.tool !== "selection") return;
    const p = toScene(e);
    const hit = hitTest(s.elements, p, s.zoom);
    if (hit && (hit.type === "text" || ["rectangle", "diamond", "ellipse"].includes(hit.type))) { beginEdit(hit.id); return; }
    if (hit) return;
    const box = containerAt(s.elements, p);
    if (box) { beginEdit(box.id); return; }
    beginText(p[0], p[1]);
  };

  /* ---------- wheel ---------- */
  useEffect(() => {
    const el = ref.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = S();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        s.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40 ? 0.012 : 0.0025)), e.clientX - r.left, e.clientY - r.top);
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        useApp.setState({ scrollX: s.scrollX - dx / s.zoom, scrollY: s.scrollY - dy / s.zoom });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---------- images ---------- */
  const addImageFile = useCallback(async (file: File, at?: Pt) => {
    try {
      const img = await readImage(file);
      const s = S();
      const max = 420;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const w = img.width * sc, h = img.height * sc;
      const c: Pt = at ?? [s.viewport.w / 2 / s.zoom - s.scrollX, s.viewport.h / 2 / s.zoom - s.scrollY];
      s.checkpoint();
      const el = createElement("image", c[0] - w / 2, c[1] - h / 2, s.style, { width: w, height: h, src: img.src, backgroundColor: "transparent" });
      s.add([el], true);
      s.setTool("selection", true);
    } catch { S().showToast("Couldn't load that image"); }
  }, []);

  useEffect(() => {
    const input = fileInput.current!;
    const cancel = () => S().setTool("selection");
    input.addEventListener("cancel", cancel);
    const unsub = useApp.subscribe((s, p) => {
      if (s.tool === "image" && p.tool !== "image") input.click();
    });
    return () => { input.removeEventListener("cancel", cancel); unsub(); };
  }, []);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    const tools: Record<string, ToolType> = { v: "selection", "1": "selection", r: "rectangle", "2": "rectangle", d: "diamond", "3": "diamond", o: "ellipse", "4": "ellipse", a: "arrow", "5": "arrow", l: "line", "6": "line", p: "freedraw", "7": "freedraw", t: "text", "8": "text", "9": "image", e: "eraser", "0": "eraser", h: "hand" };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = S();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === " " && !ui.current.space) { ui.current.space = true; setCursor("grab"); e.preventDefault(); return; }
      if (e.key === "Escape") {
        if (g.current?.k === "multi") { finishMulti(); return; }
        if (s.dialog) { s.setDialog(null); return; }
        setMenu(null); s.select([]); s.setTool("selection"); return;
      }
      if (e.key === "Enter") {
        if (g.current?.k === "multi") { finishMulti(); return; }
        const sel = getSelected(s);
        if (sel.length === 1 && (sel[0].type === "text" || ["rectangle", "diamond", "ellipse"].includes(sel[0].type))) { e.preventDefault(); beginEdit(sel[0].id); }
        return;
      }
      if (mod) {
        if (k === "z") { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
        else if (k === "y") { e.preventDefault(); s.redo(); }
        else if (k === "a") { e.preventDefault(); s.selectAll(); }
        else if (k === "d") { e.preventDefault(); s.duplicate(); }
        else if (k === "g") { e.preventDefault(); e.shiftKey ? s.ungroup() : s.group(); }
        else if (k === "]") { e.preventDefault(); s.order(e.shiftKey ? "front" : "forward"); }
        else if (k === "[") { e.preventDefault(); s.order(e.shiftKey ? "back" : "backward"); }
        else if (k === "=" || k === "+") { e.preventDefault(); s.zoomBy(1.2); }
        else if (k === "-") { e.preventDefault(); s.zoomBy(1 / 1.2); }
        else if (k === "0") { e.preventDefault(); s.zoomTo(1); }
        else if (k === "'") { e.preventDefault(); s.toggleGrid(); }
        else if (k === "l" && e.shiftKey) { e.preventDefault(); s.toggleLock(); }
        else if (k === "e" && e.shiftKey) { e.preventDefault(); s.setDialog("export"); }
        else if (k === "k" || k === "/") { e.preventDefault(); s.setDialog("command"); }
        else if (k === "s") { e.preventDefault(); window.dispatchEvent(new CustomEvent("easydraw:save")); }
        else if (k === "o") { e.preventDefault(); window.dispatchEvent(new CustomEvent("easydraw:open")); }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); s.removeSelected(); return; }
      if (e.key.startsWith("Arrow") && s.selected.size) {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * (s.grid ? GRID / (e.shiftKey ? 2 : 1) : 1);
        const [dx, dy] = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : [0, step];
        const ids = new Set([...s.selected].filter((id) => !s.elements.find((x) => x.id === id)?.locked));
        s.checkpoint(); s.translate(ids, dx, dy);
        return;
      }
      if (e.shiftKey && e.key === "!") { s.fit(); return; }
      if (e.shiftKey && e.key === "@") { s.fit(true); return; }
      if (e.key === "?") { s.setDialog("help"); return; }
      if (e.altKey && e.shiftKey && k === "d") { s.setTheme(s.theme === "dark" ? "light" : "dark"); return; }
      if (k === "q" && !e.altKey) { s.toggleToolLock(); s.showToast(S().toolLocked ? "Tool lock on" : "Tool lock off"); return; }
      if (!e.altKey && !e.shiftKey && tools[k]) { s.setTool(tools[k]); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") { ui.current.space = false; setCursor(TOOL_CURSOR[S().tool] ?? "default"); }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- clipboard ---------- */
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    const payload = () => JSON.stringify({ type: CLIP_TYPE, elements: getSelected(S()) });
    const copy = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !S().selected.size) return;
      e.clipboardData?.setData("text/plain", payload());
      e.preventDefault();
    };
    const cut = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !S().selected.size) return;
      e.clipboardData?.setData("text/plain", payload());
      e.preventDefault();
      S().removeSelected();
    };
    const paste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      e.preventDefault();
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { files.forEach((f) => addImageFile(f, ui.current.last)); return; }
      pasteText(e.clipboardData?.getData("text/plain") ?? "");
    };
    window.addEventListener("copy", copy); window.addEventListener("cut", cut); window.addEventListener("paste", paste);
    return () => { window.removeEventListener("copy", copy); window.removeEventListener("cut", cut); window.removeEventListener("paste", paste); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pasteText = (text: string) => {
    const s = S();
    if (!text.trim()) return;
    let data: { type?: string; elements?: El[] } | null = null;
    try { data = JSON.parse(text); } catch { /* plain text */ }
    if (data?.type === CLIP_TYPE && Array.isArray(data.elements) && data.elements.length) {
      const b = commonBounds(data.elements)!;
      const at = ui.current.last;
      const copies = cloneElements(data.elements, at[0] - (b[0] + b[2]) / 2, at[1] - (b[1] + b[3]) / 2);
      s.checkpoint(); s.add(copies, true); s.setTool("selection", true);
      return;
    }
    const sc = parseScene(text);
    if (sc) { s.loadScene(sc.elements, sc.appState.canvasBg, sc.appState.grid); return; }
    s.checkpoint();
    const at = ui.current.last;
    const el = refreshText(createElement("text", at[0], at[1], s.style, { text: text.slice(0, 2000) }));
    s.add([el], true);
  };

  /* ---------- drag & drop ---------- */
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const at = toScene(e);
    for (const f of [...e.dataTransfer.files]) {
      if (f.type.startsWith("image/")) await addImageFile(f, at);
      else {
        const sc = parseScene(await f.text());
        if (sc) S().loadScene(sc.elements, sc.appState.canvasBg, sc.appState.grid);
      }
    }
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = S();
    const p = toScene(e);
    const hit = hitTest(s.elements, p, s.zoom);
    if (hit && !s.selected.has(hit.id)) s.select([hit.id]);
    if (!hit && s.selected.size) s.select([]);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <canvas
        ref={ref}
        className="board"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={onDouble}
        onContextMenu={onContext}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      />
      <input
        ref={fileInput} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addImageFile(f); else S().setTool("selection"); }}
      />
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} onPasteText={pasteText} />}
    </>
  );
}

export { clamp, hitElement };
