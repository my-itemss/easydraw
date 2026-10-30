import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import { DIAGRAM_TYPES, samples } from "../../../lib/engine";
import { diagramElement, uid } from "../../../lib/files";
import { downloadBlob, importFile, safeFileName } from "../../../lib/importFile";
import { useTheme } from "../../../lib/theme";
import type { CanvasElement, Comment, DiagramType, FileFull } from "../../../lib/types";
import { Avatar, Button, Modal, Spinner, ThemeToggle, cx, inputClass } from "../../ui";
import { Menu, MenuItem, MenuSep } from "../Menu";
import CanvasView, { type CanvasHandle, type Pin, type Viewport } from "./CanvasView";
import DocPane from "./DocPane";
import { composeSvg, svgToPng } from "./exporters";
import { INK_COLORS, bounds, type Pt, type Tool } from "./geometry";
import { AiPanel, CommentsPanel, Inspector, ShareDialog, VersionsPanel } from "./Panels";
import { useFileState } from "./store";

type Panel = null | "inspector" | "ai" | "comments" | "versions";

const TOOLS: { id: Tool; key: string; label: string; icon: string }[] = [
  { id: "select", key: "V", label: "Select", icon: "M5 3l14 8-6 2-2 6z" },
  { id: "hand", key: "H", label: "Pan", icon: "M8 13V5a1.5 1.5 0 013 0v6m0-1V4a1.5 1.5 0 013 0v7m0-4a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2-4a1.5 1.5 0 012.5-1.5L8 15" },
  { id: "pen", key: "P", label: "Pen", icon: "M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3" },
  { id: "eraser", key: "E", label: "Eraser", icon: "M7 21h10M5 15l8-9 6 6-6 7H8z" },
  { id: "note", key: "N", label: "Sticky note", icon: "M5 4h14v11l-5 5H5zM14 20v-5h5" },
  { id: "text", key: "T", label: "Text", icon: "M5 6V4h14v2M12 4v16M9 20h6" },
  { id: "rect", key: "R", label: "Rectangle", icon: "M4 6h16v12H4z" },
  { id: "ellipse", key: "O", label: "Ellipse", icon: "M12 5a8 6 0 100 12 8 6 0 000-12z" },
  { id: "diamond", key: "D", label: "Diamond", icon: "M12 3l9 9-9 9-9-9z" },
  { id: "arrow", key: "A", label: "Arrow", icon: "M4 20L20 4M11 4h9v9" },
  { id: "image", key: "I", label: "Image", icon: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01" },
  { id: "comment", key: "C", label: "Comment", icon: "M4 5h16v11H9l-5 4z" },
];

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

async function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Could not read the image."));
    r.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("That is not a supported image."));
    img.src = url;
  });
  const max = 1400;
  const s = Math.min(1, max / Math.max(img.width, img.height));
  if (s === 1 && file.size < 600_000) return { src: url, w: img.width, h: img.height };
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * s);
  cv.height = Math.round(img.height * s);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  return { src: cv.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85), w: cv.width, h: cv.height };
}

export default function FileEditor({ file, shareToken, canEdit, embed = false }: { file: FileFull; shareToken?: string; canEdit: boolean; embed?: boolean }) {
  const state = useFileState(file, { shareToken, canEdit });
  const { theme } = useTheme();
  const navigate = useNavigate();
  const canvas = useRef<CanvasHandle>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const imgAt = useRef<Pt | null>(null);
  const clip = useRef<CanvasElement[]>([]);

  const [view, setView] = useState<"canvas" | "doc">("canvas");
  const [docMode, setDocMode] = useState<"split" | "preview" | "edit">("split");
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vp, setVp] = useState<Viewport>({ x: 60, y: 60, z: 1 });
  const [panel, setPanel] = useState<Panel>(null);
  const [penColor, setPenColor] = useState(INK_COLORS[0]!);
  const [penSize, setPenSize] = useState(3);
  const [share, setShare] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pending, setPending] = useState<Comment["anchor"]>(null);
  const [focusComment, setFocusComment] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState(state.title);
  const fitted = useRef(false);

  const say = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 2600);
  }, []);

  // fit once on load
  useEffect(() => {
    if (fitted.current || view !== "canvas") return;
    const id = requestAnimationFrame(() => {
      canvas.current?.fit();
      fitted.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [view]);

  useEffect(() => setTitleDraft(state.title), [state.title]);

  const loadComments = useCallback(() => {
    if (shareToken || embed) return;
    api.comments.list(file.id).then(setComments).catch(() => undefined);
  }, [file.id, shareToken, embed]);
  useEffect(loadComments, [loadComments]);

  const pins: Pin[] = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    const out: Pin[] = [];
    roots.forEach((c, i) => {
      if (!c.anchor) return;
      let x = c.anchor.x;
      let y = c.anchor.y;
      if (c.anchor.elementId) {
        const el = state.elements.find((e) => e.id === c.anchor!.elementId);
        if (el) {
          const b = bounds(el);
          x = b.x + (c.anchor.x ?? 0);
          y = b.y + (c.anchor.y ?? 0);
        }
      }
      if (x !== undefined && y !== undefined) out.push({ id: c.id, n: i + 1, x, y, resolved: c.resolved });
    });
    return out;
  }, [comments, state.elements]);

  const selected = selection.length === 1 ? state.elements.find((e) => e.id === selection[0]) : undefined;
  const openDiagram = (id: string) => {
    setSelection([id]);
    setPanel("inspector");
  };

  const addElements = (els: CanvasElement[]) => {
    state.checkpoint();
    state.update((all) => [...all, ...els]);
    setSelection(els.map((e) => e.id));
  };

  const addDiagram = (code: string, type: DiagramType, title: string, alsoDoc = true) => {
    const c = canvas.current?.center() ?? { x: 200, y: 200 };
    const el = diagramElement(type, code, title, { x: c.x - 320, y: c.y - 210 });
    addElements([el]);
    if (alsoDoc) state.setDoc(state.doc.replace(/\s*$/, "") + `\n\n\`\`\`diagram:${el.id}\n\`\`\`\n`);
    setView("canvas");
    return el;
  };

  const delSelection = () => {
    if (!selection.length || !canEdit) return;
    state.checkpoint();
    const ids = new Set(selection);
    state.update((all) => all.filter((e) => !ids.has(e.id)));
    setSelection([]);
  };

  const copy = () => {
    clip.current = state.elementsRef.current.filter((e) => selection.includes(e.id)).map((e) => structuredClone(e));
    if (clip.current.length) say("Copied");
  };
  const paste = () => {
    if (!clip.current.length || !canEdit) return;
    const copies = clip.current.map((e) => {
      const n = structuredClone(e);
      n.id = uid();
      n.x += 30;
      n.y += 30;
      if (n.kind === "arrow") {
        n.x2 += 30;
        n.y2 += 30;
      }
      if (n.kind === "stroke") n.points = n.points.map((v) => v + 30);
      return n;
    });
    clip.current = copies.map((e) => structuredClone(e));
    addElements(copies);
  };

  const placeImage = async (file: File, at?: Pt) => {
    try {
      const im = await readImage(file);
      const s = Math.min(1, 480 / Math.max(im.w, im.h));
      const c = at ?? canvas.current?.center() ?? { x: 100, y: 100 };
      addElements([{ id: uid(), kind: "image", src: im.src, x: c.x - (im.w * s) / 2, y: c.y - (im.h * s) / 2, w: im.w * s, h: im.h * s }]);
      setTool("select");
    } catch (e) {
      say((e as Error).message);
    }
  };

  // ---- exports
  const download = async (kind: "png" | "svg" | "json" | "md") => {
    const name = safeFileName(state.title);
    try {
      if (kind === "json") {
        downloadBlob(JSON.stringify({ title: state.title, content: { doc: state.doc, canvas: { elements: state.elementsRef.current } } }, null, 2), name + ".easydraw.json", "application/json");
      } else if (kind === "md") {
        const md = state.doc.replace(/```diagram:([\w-]+)\s*\n```/g, (m, id: string) => {
          const el = state.elementsRef.current.find((e) => e.id === id);
          return el && el.kind === "diagram" ? "```eraser-" + el.diagramType + "\n" + el.code.replace(/\s+$/, "") + "\n```" : m;
        });
        downloadBlob(md, name + ".md", "text/markdown");
      } else {
        const list = selection.length ? state.elementsRef.current.filter((e) => selection.includes(e.id)) : state.elementsRef.current;
        const c = composeSvg(list, theme, true);
        if (kind === "svg") downloadBlob(c.svg, name + ".svg", "image/svg+xml");
        else downloadBlob(await svgToPng(c.svg, c.width, c.height), name + ".png", "image/png");
      }
      say("Exported " + kind.toUpperCase());
    } catch (e) {
      say((e as Error).message);
    }
  };

  const doImport = async (f: File) => {
    try {
      const r = await importFile(f);
      const maxY = state.elementsRef.current.reduce((m, e) => Math.max(m, bounds(e).y + bounds(e).h), 0);
      const minY = r.content.canvas.elements.reduce((m, e) => Math.min(m, bounds(e).y), Infinity);
      const off = state.elementsRef.current.length ? maxY + 80 - (Number.isFinite(minY) ? minY : 0) : 0;
      let doc = r.content.doc;
      const els = r.content.canvas.elements.map((e) => {
        const n = structuredClone(e);
        const old = n.id;
        n.id = uid();
        doc = doc.split(old).join(n.id);
        n.y += off;
        if (n.kind === "arrow") n.y2 += off;
        if (n.kind === "stroke") n.points = n.points.map((v, i) => (i % 2 ? v + off : v));
        return n;
      });
      addElements(els);
      state.setDoc(state.doc.replace(/\s*$/, "") + "\n\n" + doc);
      requestAnimationFrame(() => canvas.current?.fit());
      say(r.warnings[0] ?? `Imported ${f.name}`);
    } catch (e) {
      say((e as Error).message);
    }
  };

  const saveVersion = async () => {
    try {
      await state.flushNow();
      await api.versions.create(file.id);
      say("Version saved");
    } catch (e) {
      say((e as Error).message);
    }
  };

  const duplicate = async () => {
    try {
      await state.flushNow();
      const f = await api.files.duplicate(file.id);
      navigate(`/app/f/${f.id}`);
    } catch (e) {
      say((e as Error).message);
    }
  };

  // ---- keyboard
  const kb = useRef<(e: KeyboardEvent) => void>(() => undefined);
  kb.current = (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPalette(true);
      return;
    }
    if (typing(e.target)) return;
    if (mod) {
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (canEdit) e.shiftKey ? state.redo() : state.undo();
      } else if (k === "y") {
        e.preventDefault();
        if (canEdit) state.redo();
      } else if (k === "d") {
        e.preventDefault();
        if (canEdit && selection.length) {
          copy();
          paste();
        }
      } else if (k === "s") {
        e.preventDefault();
        if (canEdit && !shareToken) void saveVersion();
      } else if (k === "c") copy();
      else if (k === "a" && view === "canvas") {
        e.preventDefault();
        setSelection(state.elementsRef.current.map((x) => x.id));
      } else if (e.key === "/") {
        e.preventDefault();
        setView((v) => (v === "canvas" ? "doc" : "canvas"));
      } else if (e.key === "0") {
        e.preventDefault();
        canvas.current?.fit();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        canvas.current?.zoomBy(1.2);
      } else if (e.key === "-") {
        e.preventDefault();
        canvas.current?.zoomBy(1 / 1.2);
      }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      delSelection();
    } else if (e.key === "Escape") {
      setSelection([]);
      setTool("select");
      setEditingId(null);
    } else if (e.key === "Enter" && selected && canEdit && selected.kind !== "diagram" && selected.kind !== "image" && selected.kind !== "stroke" && selected.kind !== "arrow") {
      e.preventDefault();
      setEditingId(selected.id);
    } else if (e.key.startsWith("Arrow") && selection.length && canEdit) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
      const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
      state.checkpoint("nudge");
      state.update((all) =>
        all.map((x) => {
          if (!selection.includes(x.id)) return x;
          const n = { ...x, x: x.x + dx, y: x.y + dy } as CanvasElement;
          if (n.kind === "arrow" && x.kind === "arrow") {
            n.x2 = x.x2 + dx;
            n.y2 = x.y2 + dy;
          }
          if (n.kind === "stroke" && x.kind === "stroke") n.points = x.points.map((v, i) => v + (i % 2 ? dy : dx));
          return n;
        }),
      );
    } else if (!e.altKey && e.key.length === 1) {
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t && (canEdit || t.id === "select" || t.id === "hand" || t.id === "comment")) setTool(t.id);
    }
  };
  useEffect(() => {
    if (embed) return;
    const h = (e: KeyboardEvent) => kb.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [embed]);

  useEffect(() => {
    if (embed) return;
    const onPaste = (e: ClipboardEvent) => {
      if (typing(e.target) || !canEdit) return;
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) {
        e.preventDefault();
        void placeImage(f);
      } else paste();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed, canEdit, selection]);

  const commands = [
    { name: "Toggle canvas / document", run: () => setView((v) => (v === "canvas" ? "doc" : "canvas")) },
    { name: "Fit canvas to screen", run: () => canvas.current?.fit() },
    { name: "Insert diagram…", run: () => setInsertOpen(true) },
    { name: "Generate diagram with AI", run: () => setPanel("ai") },
    { name: "Show comments", run: () => setPanel("comments") },
    { name: "Version history", run: () => setPanel("versions") },
    { name: "Save version", run: saveVersion },
    { name: "Share…", run: () => setShare(true) },
    { name: "Export PNG", run: () => download("png") },
    { name: "Export SVG", run: () => download("svg") },
    { name: "Export JSON", run: () => download("json") },
    { name: "Export Markdown", run: () => download("md") },
    { name: "Import file…", run: () => importInput.current?.click() },
    { name: "Duplicate file", run: duplicate },
    { name: "Undo", run: () => state.undo() },
    { name: "Redo", run: () => state.redo() },
    { name: "Select all", run: () => setSelection(state.elementsRef.current.map((x) => x.id)) },
    ...TOOLS.map((t) => ({ name: `Tool: ${t.label} (${t.key})`, run: () => setTool(t.id) })),
  ];

  const canvasEl = (
    <CanvasView
      ref={canvas}
      state={state}
      tool={tool}
      setTool={setTool}
      selection={selection}
      setSelection={setSelection}
      viewport={vp}
      setViewport={setVp}
      canEdit={canEdit && !embed}
      theme={theme}
      penColor={penColor}
      penSize={penSize}
      editingId={editingId}
      setEditingId={setEditingId}
      onOpenDiagram={openDiagram}
      onPin={(pt, elementId) => {
        let anchor: Comment["anchor"] = { x: pt.x, y: pt.y };
        if (elementId) {
          const el = state.elementsRef.current.find((e) => e.id === elementId);
          if (el) {
            const b = bounds(el);
            anchor = { elementId, x: pt.x - b.x, y: pt.y - b.y };
          }
        }
        setPending(anchor);
        setPanel("comments");
        setTool("select");
      }}
      pins={pins}
      onPinClick={(id) => {
        setFocusComment(id);
        setPanel("comments");
      }}
      onPickImage={() => {
        imgAt.current = null;
        imgInput.current?.click();
      }}
    />
  );

  if (embed) {
    return (
      <div className="ed relative h-screen w-screen bg-[var(--bg)]">
        {canvasEl}
        <div className="absolute bottom-3 right-3 z-10 flex gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-1 text-sm shadow">
          <button className="h-7 w-7 cursor-pointer rounded-full hover:bg-[var(--bg-soft)]" onClick={() => canvas.current?.zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
          <button className="h-7 cursor-pointer rounded-full px-2 text-xs hover:bg-[var(--bg-soft)]" onClick={() => canvas.current?.fit()}>Fit</button>
          <button className="h-7 w-7 cursor-pointer rounded-full hover:bg-[var(--bg-soft)]" onClick={() => canvas.current?.zoomBy(1.2)} aria-label="Zoom in">+</button>
        </div>
      </div>
    );
  }

  const iconBtn = "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-35";
  const statusText = state.status === "saving" ? "Saving…" : state.status === "error" ? "Not saved" : "Saved";

  return (
    <div className="ed fixed inset-0 z-0 flex flex-col bg-[var(--bg)] text-[var(--fg)]">
      {/* header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elev)] px-3">
        {!shareToken && (
          <Link to="/app" aria-label="Back to files" className={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
        )}
        <input
          value={titleDraft}
          readOnly={!canEdit}
          aria-label="File title"
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => titleDraft.trim() && titleDraft !== state.title && state.setTitle(titleDraft.trim())}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-8 w-40 min-w-0 rounded-md bg-transparent px-2 text-sm font-medium outline-none hover:bg-[var(--bg-soft)] focus:bg-[var(--bg-soft)] sm:w-64"
        />
        <span className={cx("hidden text-xs sm:inline", state.status === "error" ? "text-red-500" : "text-[var(--fg-muted)]")} title={state.errorMsg ?? undefined}>
          {canEdit ? statusText : "View only"}
        </span>
        <div className="mx-2 hidden rounded-full border border-[var(--border)] p-0.5 text-xs md:flex">
          {(["canvas", "doc"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cx("cursor-pointer rounded-full px-3 py-1 capitalize", view === v ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)]")}>{v === "doc" ? "Document" : "Canvas"}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="mr-1 hidden -space-x-2 sm:flex" title={state.connected ? "Live" : "Offline"}>
            {state.others.slice(0, 4).map((u) => (
              <Avatar key={u.clientId} name={u.name} color={u.color} size={26} />
            ))}
          </div>
          {canEdit && (
            <>
              <button className={iconBtn} onClick={state.undo} disabled={!state.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">↶</button>
              <button className={iconBtn} onClick={state.redo} disabled={!state.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↷</button>
            </>
          )}
          <button className={iconBtn} onClick={() => setPanel(panel === "ai" ? null : "ai")} aria-label="AI diagram" title="AI diagram">✨</button>
          {!shareToken && (
            <>
              <button className={cx(iconBtn, "relative")} onClick={() => setPanel(panel === "comments" ? null : "comments")} aria-label="Comments" title="Comments">
                💬
                {comments.some((c) => !c.parentId && !c.resolved) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-brand)]" />}
              </button>
              <button className={iconBtn} onClick={() => setPanel(panel === "versions" ? null : "versions")} aria-label="Version history" title="Version history">🕘</button>
            </>
          )}
          <Menu label="More" trigger={<span className={iconBtn}>⋯</span>}>
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); setInsertOpen(true); }}>Insert diagram…</MenuItem>
                {canEdit && <MenuItem onClick={() => { close(); importInput.current?.click(); }}>Import file…</MenuItem>}
                {canEdit && !shareToken && <MenuItem onClick={() => { close(); void saveVersion(); }}>Save version</MenuItem>}
                {!shareToken && <MenuItem onClick={() => { close(); void duplicate(); }}>Duplicate</MenuItem>}
                <MenuItem onClick={() => { close(); setPalette(true); }}>Command palette</MenuItem>
              </>
            )}
          </Menu>
          <Menu label="Export" trigger={<span className="inline-flex h-8 items-center rounded-full border border-[var(--border)] px-3 text-sm hover:bg-[var(--bg-soft)]">Export</span>}>
            {(close) => (
              <>
                {(["png", "svg", "json", "md"] as const).map((k) => (
                  <MenuItem key={k} onClick={() => { close(); void download(k); }}>
                    {{ png: "PNG image", svg: "SVG image", json: "easydraw JSON", md: "Markdown" }[k]}
                  </MenuItem>
                ))}
                <MenuSep />
                <div className="px-3 py-1 text-xs text-[var(--fg-muted)]">{selection.length ? "Images export the selection." : "Images export the whole canvas."}</div>
              </>
            )}
          </Menu>
          <ThemeToggle />
          {!shareToken && <Button size="sm" onClick={() => setShare(true)}>Share</Button>}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {view === "canvas" ? (
            <>
              {canvasEl}
              {/* tools */}
              <div data-ui className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-1 shadow-lg">
                {TOOLS.filter((t) => canEdit || ["select", "hand", "comment"].includes(t.id)).filter((t) => !(shareToken && t.id === "comment")).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    aria-label={t.label}
                    aria-pressed={tool === t.id}
                    title={`${t.label} (${t.key})`}
                    className={cx("flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl", tool === t.id ? "bg-[var(--color-brand)] text-white" : "text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
                  </button>
                ))}
                {canEdit && (
                  <button onClick={() => setInsertOpen(true)} aria-label="Insert diagram" title="Insert diagram" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[var(--color-brand)] hover:bg-[var(--bg-soft)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                )}
              </div>
              {/* pen options */}
              {(tool === "pen" || tool === "arrow") && (
                <div data-ui className="absolute left-16 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-2 shadow-lg">
                  <div className="grid grid-cols-4 gap-1">
                    {INK_COLORS.map((c) => (
                      <button key={c} aria-label={`Color ${c}`} onClick={() => setPenColor(c)} className="h-6 w-6 cursor-pointer rounded-full border border-[var(--border)]" style={{ background: c, outline: penColor === c ? "2px solid var(--color-brand)" : "none", outlineOffset: 1 }} />
                    ))}
                  </div>
                  {tool === "pen" && <input type="range" min={1} max={12} value={penSize} onChange={(e) => setPenSize(+e.target.value)} className="mt-2 w-full" aria-label="Stroke size" />}
                </div>
              )}
              {/* selection quick actions */}
              {canEdit && selected && (selected.kind === "note" || selected.kind === "shape") && (
                <div data-ui className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1.5 shadow-lg">
                  {(selected.kind === "note" ? ["#fde68a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#e9d5ff"] : ["transparent", ...["#fde68a", "#bfdbfe", "#bbf7d0", "#fbcfe8"]]).map((c) => (
                    <button key={c} aria-label={`Fill ${c}`} className="h-6 w-6 cursor-pointer rounded-full border border-[var(--border)]" style={{ background: c === "transparent" ? "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 50%/8px 8px" : c }}
                      onClick={() => { state.checkpoint(); state.update((all) => all.map((e) => (e.id === selected.id ? (e.kind === "note" ? { ...e, color: c } : e.kind === "shape" ? { ...e, fill: c } : e) : e))); }} />
                  ))}
                  <button className="ml-1 cursor-pointer rounded px-2 text-xs text-red-500" onClick={delSelection}>Delete</button>
                </div>
              )}
              {canEdit && selected && !["note", "shape"].includes(selected.kind) && selected.kind !== "diagram" && (
                <div data-ui className="absolute left-1/2 top-3 z-10 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1.5 shadow-lg">
                  <button className="cursor-pointer px-2 text-xs text-red-500" onClick={delSelection}>Delete</button>
                </div>
              )}
              {canEdit && selected?.kind === "diagram" && panel !== "inspector" && (
                <div data-ui className="absolute left-1/2 top-3 z-10 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1.5 text-xs shadow-lg">
                  <button className="cursor-pointer rounded px-2 py-1 hover:bg-[var(--bg-soft)]" onClick={() => setPanel("inspector")}>Edit code</button>
                  <button className="cursor-pointer rounded px-2 py-1 text-red-500 hover:bg-[var(--bg-soft)]" onClick={delSelection}>Delete</button>
                </div>
              )}
              {/* zoom */}
              <div data-ui className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-1 text-sm shadow-lg">
                <button className="h-7 w-7 cursor-pointer rounded-full hover:bg-[var(--bg-soft)]" onClick={() => canvas.current?.zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
                <button className="h-7 min-w-12 cursor-pointer rounded-full px-1 text-xs hover:bg-[var(--bg-soft)]" onClick={() => canvas.current?.reset()} title="Reset to 100%">{Math.round(vp.z * 100)}%</button>
                <button className="h-7 w-7 cursor-pointer rounded-full hover:bg-[var(--bg-soft)]" onClick={() => canvas.current?.zoomBy(1.2)} aria-label="Zoom in">+</button>
                <button className="h-7 cursor-pointer rounded-full px-2 text-xs hover:bg-[var(--bg-soft)]" onClick={() => canvas.current?.fit()}>Fit</button>
              </div>
              {state.elements.length === 0 && canEdit && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="pointer-events-auto max-w-sm rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elev)]/80 p-6 text-center">
                    <div className="font-medium">Empty canvas</div>
                    <p className="mt-1 text-sm text-[var(--fg-muted)]">Draw with the tools on the left, or add a diagram.</p>
                    <div className="mt-3 flex justify-center gap-2">
                      <Button size="sm" onClick={() => setInsertOpen(true)}>Insert diagram</Button>
                      <Button size="sm" variant="secondary" onClick={() => setPanel("ai")}>Generate with AI</Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col">
              <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-1.5 text-xs">
                {(["edit", "split", "preview"] as const).map((m) => (
                  <button key={m} onClick={() => setDocMode(m)} className={cx("cursor-pointer rounded-full px-3 py-1 capitalize", docMode === m ? "bg-[var(--bg-soft)] font-medium" : "text-[var(--fg-muted)]")}>{m}</button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                <DocPane doc={state.doc} setDoc={state.setDoc} elements={state.elements} theme={theme} canEdit={canEdit} mode={docMode} onInsertDiagram={() => setInsertOpen(true)} />
              </div>
            </div>
          )}
          {/* mobile view switch */}
          <div className="absolute bottom-3 left-3 z-10 flex rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-0.5 text-xs shadow md:hidden">
            {(["canvas", "doc"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cx("cursor-pointer rounded-full px-3 py-1.5", view === v ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)]")}>{v === "doc" ? "Doc" : "Canvas"}</button>
            ))}
          </div>
        </div>

        {panel && (
          <div className="absolute inset-y-12 right-0 z-20 w-full max-w-sm shadow-2xl md:static md:z-auto md:w-[360px] md:shrink-0 md:shadow-none">
            {panel === "inspector" && selected?.kind === "diagram" ? (
              <Inspector
                el={selected}
                canEdit={canEdit}
                onClose={() => setPanel(null)}
                onChange={(p) => { state.checkpoint("insp:" + selected.id); state.update((all) => all.map((e) => (e.id === selected.id && e.kind === "diagram" ? { ...e, ...p } : e))); }}
                onFocus={() => canvas.current?.fit([selected.id])}
              />
            ) : panel === "ai" ? (
              <AiPanel canEdit={canEdit} onClose={() => setPanel(null)} onInsert={(c, t, title) => { addDiagram(c, t, title); say("Added to canvas"); }} />
            ) : panel === "comments" ? (
              <CommentsPanel fileId={file.id} comments={comments} reload={loadComments} onClose={() => setPanel(null)} focusId={focusComment} pendingAnchor={pending} clearPending={() => setPending(null)} />
            ) : panel === "versions" ? (
              <VersionsPanel fileId={file.id} canEdit={canEdit} onClose={() => setPanel(null)} onRestored={() => location.reload()} />
            ) : null}
          </div>
        )}
      </div>

      <input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void placeImage(f, imgAt.current ?? undefined); }} />
      <input ref={importInput} type="file" accept=".json,.md,.markdown,.txt,.sql,.tf,.yml,.yaml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void doImport(f); }} />

      {!shareToken && <ShareDialog fileId={file.id} open={share} onClose={() => setShare(false)} />}
      <InsertDialog open={insertOpen} onClose={() => setInsertOpen(false)} onPick={(t) => { addDiagram(samples[t], t, DIAGRAM_TYPES.find((d) => d.id === t)!.label); setInsertOpen(false); }} />
      <Palette open={palette} onClose={() => setPalette(false)} commands={commands} />
      {toast && <div role="status" className="fixed bottom-16 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-[var(--fg)] px-4 py-2 text-sm text-[var(--bg)] shadow-lg">{toast}</div>}
    </div>
  );
}

function InsertDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: DiagramType) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Insert diagram" width={520}>
      <div className="grid gap-2 sm:grid-cols-2">
        {DIAGRAM_TYPES.map((t) => (
          <button key={t.id} onClick={() => onPick(t.id)} className="cursor-pointer rounded-xl border border-[var(--border)] p-4 text-left hover:border-[var(--color-brand)]">
            <div className="font-medium">{t.label}</div>
            <div className="mt-1 text-xs text-[var(--fg-muted)]">{t.blurb}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Palette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: { name: string; run: () => void }[] }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
    }
  }, [open]);
  const list = commands.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  if (!open) return null;
  const run = (c?: { run: () => void }) => {
    if (!c) return;
    onClose();
    setTimeout(c.run, 0);
  };
  return (
    <Modal open onClose={onClose} width={520}>
      <input
        autoFocus
        className={inputClass}
        placeholder="Type a command…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setI(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
          else if (e.key === "Enter") run(list[i]);
        }}
      />
      <ul className="mt-3 max-h-80 overflow-auto" role="listbox">
        {list.map((c, n) => (
          <li key={c.name}>
            <button role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => run(c)} className={cx("w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm", n === i && "bg-[var(--bg-soft)]")}>{c.name}</button>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-2 text-sm text-[var(--fg-muted)]">No matching command</li>}
      </ul>
    </Modal>
  );
}

export function EditorLoading() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center text-[var(--fg-muted)]">
      <Spinner size={24} />
    </div>
  );
}
