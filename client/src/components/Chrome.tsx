import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faCircleQuestion, faFloppyDisk, faFolderOpen, faImage, faMagnifyingGlass, faMoon, faSun, faTableCells, faTrashCan, faUserGroup, faCheck } from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { LuRedo2, LuUndo2, LuZoomIn, LuZoomOut } from "react-icons/lu";
import { useApp } from "../store";
import { CANVAS_COLORS } from "../lib/colors";
import { openFile, saveFile } from "../lib/actions";

export const REPO = "https://github.com/my-itemss/easydraw";

export function MainMenu() {
  const open = useApp((s) => s.menuOpen);
  const theme = useApp((s) => s.theme);
  const grid = useApp((s) => s.grid);
  const bg = useApp((s) => s.canvasBg);
  const s = useApp.getState;
  const ref = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => file.current?.click();
    const onSave = () => saveFile();
    window.addEventListener("easydraw:open", onOpen);
    window.addEventListener("easydraw:save", onSave);
    return () => { window.removeEventListener("easydraw:open", onOpen); window.removeEventListener("easydraw:save", onSave); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) useApp.setState({ menuOpen: false }); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && useApp.setState({ menuOpen: false });
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [open]);

  const item = (icon: Parameters<typeof FontAwesomeIcon>[0]["icon"], label: string, kbd: string | undefined, run: () => void) => (
    <button className="menu-item" onClick={() => { useApp.setState({ menuOpen: false }); run(); }}>
      <FontAwesomeIcon icon={icon} fixedWidth /> <span>{label}</span>{kbd && <kbd>{kbd}</kbd>}
    </button>
  );

  return (
    <div className="menu-wrap" ref={ref}>
      <button className={`island menu-btn ${open ? "open" : ""}`} aria-label="Main menu" aria-expanded={open} onClick={() => useApp.setState({ menuOpen: !open })}>
        <FontAwesomeIcon icon={faBars} />
      </button>
      {open && (
        <div className="island menu">
          {item(faFolderOpen, "Open…", "Ctrl+O", () => file.current?.click())}
          {item(faFloppyDisk, "Save to file", "Ctrl+S", saveFile)}
          {item(faImage, "Export image…", "Ctrl+Shift+E", () => s().setDialog("export"))}
          {item(faUserGroup, "Live collaboration…", undefined, () => s().setDialog("collab"))}
          {item(faMagnifyingGlass, "Command palette", "Ctrl+K", () => s().setDialog("command"))}
          {item(faTrashCan, "Reset the canvas", undefined, () => s().setDialog("clear"))}
          <div className="menu-sep" />
          {item(faCircleQuestion, "Help & shortcuts", "?", () => s().setDialog("help"))}
          <a className="menu-item" href={REPO} target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faGithub} fixedWidth /> <span>GitHub</span></a>
          <div className="menu-sep" />
          <button className="menu-item" onClick={() => s().toggleGrid()}>
            <FontAwesomeIcon icon={faTableCells} fixedWidth /> <span>Show grid</span>
            <span className={`switch ${grid ? "on" : ""}`}><i /></span>
          </button>
          <div className="menu-row">
            <span>Theme</span>
            <div className="seg">
              <button className={`seg-btn ${theme === "light" ? "on" : ""}`} onClick={() => s().setTheme("light")} aria-label="Light theme"><FontAwesomeIcon icon={faSun} /></button>
              <button className={`seg-btn ${theme === "dark" ? "on" : ""}`} onClick={() => s().setTheme("dark")} aria-label="Dark theme"><FontAwesomeIcon icon={faMoon} /></button>
            </div>
          </div>
          <div className="menu-row col">
            <span>Canvas background</span>
            <div className="swatch-row">
              {CANVAS_COLORS.map((c) => (
                <button key={c} className={`swatch ${bg === c ? "on" : ""}`} style={{ background: c }} onClick={() => s().setCanvasBg(c)} aria-label={c} />
              ))}
            </div>
          </div>
        </div>
      )}
      <input ref={file} type="file" accept=".easydraw,.json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) openFile(f); }} />
    </div>
  );
}

export function TopRight() {
  const peers = useApp((s) => s.collab.peers);
  const room = useApp((s) => s.collab.room);
  const connected = useApp((s) => s.collab.connected);
  const name = useApp((s) => s.collab.name);
  return (
    <div className="top-right">
      {room && (
        <div className="avatars" aria-label="People in this session">
          <span className="avatar me" data-tip={`${name} (you)`} style={{ background: "var(--accent)" }}>{name.slice(0, 1).toUpperCase() || "Y"}</span>
          {peers.slice(0, 5).map((p) => <span key={p.id} className="avatar" data-tip={p.name} style={{ background: p.color }}>{p.name.slice(0, 1).toUpperCase()}</span>)}
          {peers.length > 5 && <span className="avatar more">+{peers.length - 5}</span>}
        </div>
      )}
      <button className="share" onClick={() => useApp.getState().setDialog("collab")}>
        <FontAwesomeIcon icon={faUserGroup} />
        <span>{room ? (connected ? "Live" : "Reconnecting…") : "Share"}</span>
        {room && <i className={`dot ${connected ? "ok" : ""}`} />}
      </button>
    </div>
  );
}

export function ZoomControls() {
  const zoom = useApp((s) => s.zoom);
  const canUndo = useApp((s) => s.past.length > 0);
  const canRedo = useApp((s) => s.future.length > 0);
  const s = useApp.getState;
  return (
    <div className="bottom-left">
      <div className="island zoom">
        <button className="icon-btn" onClick={() => s().zoomBy(1 / 1.2)} data-tip="Zoom out — Ctrl+−" aria-label="Zoom out"><LuZoomOut /></button>
        <button className="zoom-val" onClick={() => s().zoomTo(1)} data-tip="Reset zoom — Ctrl+0">{Math.round(zoom * 100)}%</button>
        <button className="icon-btn" onClick={() => s().zoomBy(1.2)} data-tip="Zoom in — Ctrl++" aria-label="Zoom in"><LuZoomIn /></button>
      </div>
      <div className="island zoom">
        <button className="icon-btn" disabled={!canUndo} onClick={() => s().undo()} data-tip="Undo — Ctrl+Z" aria-label="Undo"><LuUndo2 /></button>
        <button className="icon-btn" disabled={!canRedo} onClick={() => s().redo()} data-tip="Redo — Ctrl+Shift+Z" aria-label="Redo"><LuRedo2 /></button>
      </div>
    </div>
  );
}

export function Toast() {
  const t = useApp((s) => s.toast);
  if (!t) return null;
  return <div className="toast" role="status"><FontAwesomeIcon icon={faCheck} /> {t}</div>;
}

export function Welcome() {
  const empty = useApp((s) => !s.elements.some((e) => !e.isDeleted));
  const editing = useApp((s) => s.editing);
  const tool = useApp((s) => s.tool);
  if (!empty || editing || tool === "freedraw") return null;
  return (
    <div className="welcome" aria-hidden>
      <div className="hint hint-menu">
        <svg width="62" height="56" viewBox="0 0 62 56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M44 52C20 50 6 36 8 8" /><path d="M2 18l6-10 8 8" /></svg>
        <span>Open, save, export, theme &amp; more</span>
      </div>
      <div className="hero">
        <div className="logo">Easydraw</div>
        <p>All your drawings are saved in this browser — nothing leaves your device until you share a live session.</p>
      </div>
      <div className="hint hint-tools">
        <svg width="62" height="52" viewBox="0 0 62 52" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 48C4 26 26 10 52 6" /><path d="M42 2l10 4-6 10" /></svg>
        <span>Pick a tool &amp; start drawing!</span>
      </div>
    </div>
  );
}

/** One global tooltip driven by `data-tip` attributes (never clipped by scroll containers). */
export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const over = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-tip]") as HTMLElement | null;
      window.clearTimeout(timer);
      if (!el || e.pointerType === "touch") return setTip(null);
      timer = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        const below = r.bottom + 40 < window.innerHeight;
        setTip({ text: el.dataset.tip!, x: Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90), y: below ? r.bottom + 8 : r.top - 34 });
      }, 350);
    };
    const hide = () => { window.clearTimeout(timer); setTip(null); };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerdown", hide);
    return () => { document.removeEventListener("pointerover", over); document.removeEventListener("pointerdown", hide); };
  }, []);
  return tip ? <div className="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div> : null;
}
