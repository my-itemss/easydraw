import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CanvasElement } from "../../../lib/types";
import type { FileState } from "./store";
import { BoxElement, LineElement } from "./ElementViews";
import { bounds, fitView, hitStroke, intersects, makeElement, minSize, moveBy, resizeTo, strokeFrom, type Box, type Pt, type Tool } from "./geometry";

export interface Viewport {
  x: number;
  y: number;
  z: number;
}
export interface CanvasHandle {
  center(): Pt;
  fit(ids?: string[]): void;
  zoomBy(f: number): void;
  reset(): void;
}
export interface Pin {
  id: string;
  n: number;
  x: number;
  y: number;
  resolved: boolean;
}

type G =
  | { k: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { k: "move"; start: Pt; orig: Map<string, CanvasElement>; moved: boolean }
  | { k: "resize"; handle: string; orig: CanvasElement; moved: boolean }
  | { k: "arrowEnd"; id: string; end: "a" | "b"; moved: boolean }
  | { k: "marquee"; start: Pt; base: string[] }
  | { k: "draw"; pts: number[] }
  | { k: "create"; tool: Tool; start: Pt }
  | { k: "arrow"; start: Pt }
  | { k: "erase"; moved: boolean };

interface Props {
  state: FileState;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: string[];
  setSelection: (ids: string[]) => void;
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  canEdit: boolean;
  theme: "light" | "dark";
  penColor: string;
  penSize: number;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onOpenDiagram: (id: string) => void;
  onPin: (pt: Pt, elementId?: string) => void;
  pins: Pin[];
  onPinClick: (id: string) => void;
  onPickImage: () => void;
}

const CanvasView = forwardRef<CanvasHandle, Props>(function CanvasView(p, ref) {
  const { state, tool, setTool, selection, setSelection, viewport: vp, setViewport, canEdit, theme } = p;
  const wrap = useRef<HTMLDivElement>(null);
  const g = useRef<G | null>(null);
  const space = useRef(false);
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const [ghost, setGhost] = useState<{ pts?: number[]; rect?: Box; arrow?: [Pt, Pt]; marquee?: Box } | null>(null);
  const [grab, setGrab] = useState(false);
  const lastCursor = useRef(0);

  const toCanvas = useCallback((cx: number, cy: number): Pt => {
    const r = wrap.current!.getBoundingClientRect();
    const v = vpRef.current;
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
  }, []);

  useImperativeHandle(ref, () => ({
    center: () => {
      const r = wrap.current!.getBoundingClientRect();
      return toCanvas(r.left + r.width / 2, r.top + r.height / 2);
    },
    fit: (ids) => {
      const r = wrap.current!.getBoundingClientRect();
      const list = ids ? state.elementsRef.current.filter((e) => ids.includes(e.id)) : state.elementsRef.current;
      setViewport(fitView(list, r.width, r.height));
    },
    zoomBy: (f) => {
      const r = wrap.current!.getBoundingClientRect();
      const v = vpRef.current;
      const z = Math.min(4, Math.max(0.1, v.z * f));
      const cx = r.width / 2;
      const cy = r.height / 2;
      setViewport({ z, x: cx - ((cx - v.x) / v.z) * z, y: cy - ((cy - v.y) / v.z) * z });
    },
    reset: () => {
      const r = wrap.current!.getBoundingClientRect();
      const v = vpRef.current;
      setViewport({ z: 1, x: r.width / 2 - ((r.width / 2 - v.x) / v.z), y: r.height / 2 - ((r.height / 2 - v.y) / v.z) });
    },
  }));

  // wheel: zoom (ctrl/cmd, pinch) or pan
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = vpRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const z = Math.min(4, Math.max(0.1, v.z * Math.exp(-e.deltaY * 0.0018)));
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        setViewport({ z, x: cx - ((cx - v.x) / v.z) * z, y: cy - ((cy - v.y) / v.z) * z });
      } else setViewport({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setViewport]);

  // space = temporary pan
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e.target)) {
        e.preventDefault();
        space.current = true;
        setGrab(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        space.current = false;
        setGrab(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const els = state.elements;
  const byId = (id: string) => state.elementsRef.current.find((e) => e.id === id);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    const pt = toCanvas(e.clientX, e.clientY);
    const wrapEl = wrap.current!;
    wrapEl.setPointerCapture(e.pointerId);
    const hdl = (e.target as HTMLElement).closest("[data-handle]") as HTMLElement | null;
    const hit = (e.target as HTMLElement).closest("[data-el]") as HTMLElement | SVGElement | null;
    const hitId = hit?.getAttribute("data-el") ?? null;

    if (e.button === 1 || tool === "hand" || space.current) {
      g.current = { k: "pan", sx: e.clientX, sy: e.clientY, vx: vp.x, vy: vp.y };
      setGrab(true);
      return;
    }
    if (tool === "comment") {
      p.onPin(pt, hitId ?? undefined);
      return;
    }
    if (tool === "select") {
      if (hdl && canEdit) {
        const h = hdl.getAttribute("data-handle")!;
        const id = hdl.getAttribute("data-owner")!;
        const el = byId(id);
        if (!el) return;
        g.current = h === "a" || h === "b" ? { k: "arrowEnd", id, end: h, moved: false } : { k: "resize", handle: h, orig: el, moved: false };
        return;
      }
      if (hitId) {
        let sel = selection;
        if (e.shiftKey) {
          sel = selection.includes(hitId) ? selection.filter((i) => i !== hitId) : [...selection, hitId];
          setSelection(sel);
          if (!sel.includes(hitId)) return;
        } else if (!selection.includes(hitId)) {
          sel = [hitId];
          setSelection(sel);
        }
        if (canEdit) {
          const orig = new Map<string, CanvasElement>();
          for (const id of sel) {
            const el = byId(id);
            if (el) orig.set(id, el);
          }
          g.current = { k: "move", start: pt, orig, moved: false };
        }
        return;
      }
      if (!e.shiftKey) setSelection([]);
      p.setEditingId(null);
      g.current = { k: "marquee", start: pt, base: e.shiftKey ? selection : [] };
      return;
    }
    if (!canEdit) return;
    if (tool === "pen") {
      g.current = { k: "draw", pts: [pt.x, pt.y] };
      setGhost({ pts: [pt.x, pt.y] });
    } else if (tool === "eraser") {
      state.checkpoint();
      g.current = { k: "erase", moved: false };
      erase(pt);
    } else if (tool === "arrow") {
      g.current = { k: "arrow", start: pt };
      setGhost({ arrow: [pt, pt] });
    } else if (tool === "image") {
      p.onPickImage();
    } else {
      g.current = { k: "create", tool, start: pt };
      setGhost({ rect: { x: pt.x, y: pt.y, w: 0, h: 0 } });
    }
  };

  const erase = (pt: Pt) => {
    const r = 10 / vpRef.current.z;
    const hits = state.elementsRef.current.filter((el) => el.kind === "stroke" && hitStroke(el, pt, r)).map((el) => el.id);
    if (hits.length) state.update((cur) => cur.filter((el) => !hits.includes(el.id)), { transient: true });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = toCanvas(e.clientX, e.clientY);
    const now = Date.now();
    if (now - lastCursor.current > 50) {
      lastCursor.current = now;
      state.sendCursor(pt.x, pt.y);
    }
    const cur = g.current;
    if (!cur) return;
    switch (cur.k) {
      case "pan":
        setViewport({ ...vpRef.current, x: cur.vx + (e.clientX - cur.sx), y: cur.vy + (e.clientY - cur.sy) });
        break;
      case "move": {
        const dx = pt.x - cur.start.x;
        const dy = pt.y - cur.start.y;
        if (!cur.moved) {
          if (Math.hypot(dx, dy) * vpRef.current.z < 3) return;
          cur.moved = true;
          state.checkpoint();
        }
        state.update((all) => all.map((el) => (cur.orig.has(el.id) ? moveBy(cur.orig.get(el.id)!, dx, dy) : el)), { transient: true });
        break;
      }
      case "resize": {
        if (!cur.moved) {
          cur.moved = true;
          state.checkpoint();
        }
        const o = bounds(cur.orig);
        const ms = minSize(cur.orig);
        let { x, y, w, h } = o;
        if (cur.handle.includes("e")) w = Math.max(ms.w, pt.x - o.x);
        if (cur.handle.includes("s")) h = Math.max(ms.h, pt.y - o.y);
        if (cur.handle.includes("w")) {
          const nx = Math.min(pt.x, o.x + o.w - ms.w);
          w = o.x + o.w - nx;
          x = nx;
        }
        if (cur.handle.includes("n")) {
          const ny = Math.min(pt.y, o.y + o.h - ms.h);
          h = o.y + o.h - ny;
          y = ny;
        }
        const next = resizeTo(cur.orig, { x, y, w, h });
        state.update((all) => all.map((el) => (el.id === next.id ? next : el)), { transient: true });
        break;
      }
      case "arrowEnd": {
        if (!cur.moved) {
          cur.moved = true;
          state.checkpoint();
        }
        state.update(
          (all) => all.map((el) => (el.id === cur.id && el.kind === "arrow" ? (cur.end === "a" ? { ...el, x: pt.x, y: pt.y } : { ...el, x2: pt.x, y2: pt.y }) : el)),
          { transient: true },
        );
        break;
      }
      case "marquee": {
        const box = { x: Math.min(cur.start.x, pt.x), y: Math.min(cur.start.y, pt.y), w: Math.abs(pt.x - cur.start.x), h: Math.abs(pt.y - cur.start.y) };
        setGhost({ marquee: box });
        const ids = state.elementsRef.current.filter((el) => intersects(bounds(el), box)).map((el) => el.id);
        setSelection([...new Set([...cur.base, ...ids])]);
        break;
      }
      case "draw": {
        const n = cur.pts.length;
        const dx = pt.x - cur.pts[n - 2]!;
        const dy = pt.y - cur.pts[n - 1]!;
        if (dx * dx + dy * dy > 4 / vpRef.current.z) {
          cur.pts.push(pt.x, pt.y);
          setGhost({ pts: [...cur.pts] });
        }
        break;
      }
      case "create":
        setGhost({ rect: { x: Math.min(cur.start.x, pt.x), y: Math.min(cur.start.y, pt.y), w: Math.abs(pt.x - cur.start.x), h: Math.abs(pt.y - cur.start.y) } });
        break;
      case "arrow":
        setGhost({ arrow: [cur.start, pt] });
        break;
      case "erase":
        cur.moved = true;
        erase(pt);
        break;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const cur = g.current;
    g.current = null;
    setGhost(null);
    if (grab && !space.current) setGrab(false);
    if (!cur) return;
    const pt = toCanvas(e.clientX, e.clientY);
    switch (cur.k) {
      case "move":
      case "resize":
      case "arrowEnd":
      case "erase":
        if (cur.k === "erase" || cur.moved) state.commit();
        break;
      case "draw": {
        if (cur.pts.length === 2) cur.pts.push(cur.pts[0]! + 0.1, cur.pts[1]!);
        state.checkpoint();
        const s = strokeFrom(cur.pts, p.penColor, p.penSize);
        state.update((all) => [...all, s]);
        break;
      }
      case "arrow": {
        if (Math.hypot(pt.x - cur.start.x, pt.y - cur.start.y) < 12) break;
        state.checkpoint();
        const el: CanvasElement = { id: Math.random().toString(36).slice(2, 12), kind: "arrow", x: cur.start.x, y: cur.start.y, w: 0, h: 0, x2: pt.x, y2: pt.y, color: p.penColor };
        state.update((all) => [...all, el]);
        setSelection([el.id]);
        setTool("select");
        break;
      }
      case "create": {
        const el = makeElement(cur.tool, cur.start, pt);
        if (!el) break;
        state.checkpoint();
        state.update((all) => [...all, el]);
        setSelection([el.id]);
        setTool("select");
        if (el.kind !== "image") p.setEditingId(el.id);
        break;
      }
      default:
        break;
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const hit = (e.target as HTMLElement).closest("[data-el]");
    const id = hit?.getAttribute("data-el");
    if (!id || tool !== "select") return;
    const el = byId(id);
    if (!el) return;
    if (el.kind === "diagram") p.onOpenDiagram(id);
    else if (canEdit && (el.kind === "note" || el.kind === "text" || el.kind === "shape")) {
      state.checkpoint();
      p.setEditingId(id);
    }
  };

  const setText = (id: string, text: string) => {
    state.checkpoint("text:" + id);
    state.update((all) => all.map((el) => (el.id === id && (el.kind === "note" || el.kind === "text" || el.kind === "shape") ? { ...el, text } : el)));
  };

  const selEls = selection.map(byId).filter((x): x is CanvasElement => !!x);
  const single = selEls.length === 1 ? selEls[0]! : null;
  const handleSize = 10 / vp.z;
  const cursor = grab || tool === "hand" ? (g.current?.k === "pan" ? "grabbing" : "grab") : tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";
  const now = Date.now();

  return (
    <div
      ref={wrap}
      className="ed-grid absolute inset-0 touch-none overflow-hidden select-none"
      style={{ backgroundPosition: `${vp.x}px ${vp.y}px`, backgroundSize: `${22 * vp.z}px ${22 * vp.z}px`, cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => e.preventDefault()}
    >
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.z})`, transformOrigin: "0 0" }}>
        {els.map((el) =>
          el.kind === "stroke" || el.kind === "arrow" ? (
            <LineElement key={el.id} el={el} theme={theme} />
          ) : (
            <BoxElement key={el.id} el={el} theme={theme} editing={p.editingId === el.id} onText={setText} onEditEnd={() => p.setEditingId(null)} />
          ),
        )}

        {/* selection */}
        {selEls.map((el) => {
          const b = bounds(el);
          return <div key={el.id} style={{ position: "absolute", left: b.x - 3, top: b.y - 3, width: b.w + 6, height: b.h + 6, border: `${1.5 / vp.z}px solid var(--color-brand)`, borderRadius: 6, pointerEvents: "none" }} />;
        })}
        {canEdit && single && single.kind !== "arrow" && single.kind !== "stroke" && p.editingId !== single.id &&
          (["nw", "ne", "sw", "se"] as const).map((h) => {
            const b = bounds(single);
            return (
              <div
                key={h}
                data-handle={h}
                data-owner={single.id}
                style={{ position: "absolute", left: (h.includes("e") ? b.x + b.w : b.x) - handleSize / 2, top: (h.includes("s") ? b.y + b.h : b.y) - handleSize / 2, width: handleSize, height: handleSize, background: "#fff", border: `${1.5 / vp.z}px solid var(--color-brand)`, borderRadius: 3, cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize" }}
              />
            );
          })}
        {canEdit && single?.kind === "stroke" && (
          (["nw", "ne", "sw", "se"] as const).map((h) => (
            <div key={h} data-handle={h} data-owner={single.id} style={{ position: "absolute", left: (h.includes("e") ? single.x + single.w : single.x) - handleSize / 2, top: (h.includes("s") ? single.y + single.h : single.y) - handleSize / 2, width: handleSize, height: handleSize, background: "#fff", border: `${1.5 / vp.z}px solid var(--color-brand)`, borderRadius: 3 }} />
          ))
        )}
        {canEdit && single?.kind === "arrow" &&
          (["a", "b"] as const).map((h) => (
            <div key={h} data-handle={h} data-owner={single.id} style={{ position: "absolute", left: (h === "a" ? single.x : single.x2) - handleSize / 2, top: (h === "a" ? single.y : single.y2) - handleSize / 2, width: handleSize, height: handleSize, background: "#fff", border: `${1.5 / vp.z}px solid var(--color-brand)`, borderRadius: "50%", cursor: "move" }} />
          ))}

        {/* previews */}
        {ghost?.pts && (
          <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width={1} height={1}>
            <path d={`M${ghost.pts[0]} ${ghost.pts[1]}` + ghost.pts.slice(2).reduce((s, v, i) => s + (i % 2 === 0 ? `L${v} ` : `${v}`), "")} fill="none" stroke={p.penColor} strokeWidth={p.penSize} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {ghost?.arrow && (
          <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width={1} height={1}>
            <line x1={ghost.arrow[0].x} y1={ghost.arrow[0].y} x2={ghost.arrow[1].x} y2={ghost.arrow[1].y} stroke="var(--color-brand)" strokeWidth={2} strokeDasharray="6 5" />
          </svg>
        )}
        {ghost?.rect && <div style={{ position: "absolute", left: ghost.rect.x, top: ghost.rect.y, width: ghost.rect.w, height: ghost.rect.h, border: `${1.5 / vp.z}px dashed var(--color-brand)`, pointerEvents: "none" }} />}
        {ghost?.marquee && <div style={{ position: "absolute", left: ghost.marquee.x, top: ghost.marquee.y, width: ghost.marquee.w, height: ghost.marquee.h, border: `${1 / vp.z}px solid var(--color-brand)`, background: "color-mix(in srgb, var(--color-brand) 10%, transparent)", pointerEvents: "none" }} />}

        {/* comment pins */}
        {p.pins.map((pin) => (
          <button
            key={pin.id}
            data-ui
            onClick={() => p.onPinClick(pin.id)}
            aria-label={`Comment ${pin.n}`}
            style={{ position: "absolute", left: pin.x, top: pin.y, transform: `translate(-50%, -100%) scale(${1 / vp.z})`, transformOrigin: "50% 100%", opacity: pin.resolved ? 0.45 : 1 }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full rounded-bl-none bg-[var(--color-brand)] text-xs font-semibold text-white shadow-md"
          >
            {pin.n}
          </button>
        ))}

        {/* remote cursors */}
        {Object.entries(state.cursors).map(([id, c]) => {
          const u = state.others.find((o) => o.clientId === id);
          if (!u || now - c.t > 15000) return null;
          return (
            <div key={id} style={{ position: "absolute", left: c.x, top: c.y, pointerEvents: "none", transform: `scale(${1 / vp.z})`, transformOrigin: "0 0" }}>
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 1l5 13 2-5 5-2z" fill={u.color} stroke="#fff" strokeWidth="1" strokeLinejoin="round" /></svg>
              <span className="ml-3 -mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] text-white" style={{ background: u.color }}>{u.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default CanvasView;
