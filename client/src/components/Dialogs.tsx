import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy, faDownload, faLink, faPlugCircleXmark, faXmark } from "@fortawesome/free-solid-svg-icons";
import { LuCircle, LuDiamond, LuEraser, LuHand, LuImage, LuMinus, LuMoveUpRight, LuMousePointer2, LuPencil, LuSquare, LuType } from "react-icons/lu";
import { getSelected, useApp } from "../store";
import { exportToCanvas } from "../lib/export";
import { copyPng, exportPng, exportSvg, hasContent, saveFile } from "../lib/actions";
import { renameSelf, roomLink, startCollab, stopCollab } from "../lib/collab";
import type { ToolType } from "../types";

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`island dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal aria-label={title}>
        <header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header>
        {children}
      </div>
    </div>
  );
}

export default function Dialogs() {
  const d = useApp((s) => s.dialog);
  const close = () => useApp.getState().setDialog(null);
  if (!d) return null;
  if (d === "export") return <ExportDialog onClose={close} />;
  if (d === "collab") return <CollabDialog onClose={close} />;
  if (d === "help") return <HelpDialog onClose={close} />;
  if (d === "clear") return <ClearDialog onClose={close} />;
  return <CommandPalette onClose={close} />;
}

/* ---------------- export ---------------- */
function ExportDialog({ onClose }: { onClose: () => void }) {
  const theme = useApp((s) => s.theme);
  const canvasBg = useApp((s) => s.canvasBg);
  const hasSel = useApp((s) => s.selected.size > 0);
  const [bg, setBg] = useState(true);
  const [dark, setDark] = useState(theme === "dark");
  const [scale, setScale] = useState(2);
  const [onlySel, setOnlySel] = useState(hasSel);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const s = useApp.getState();
    exportToCanvas(onlySel ? getSelected(s) : s.elements, { scale: 1, dark, background: bg, canvasBg }).then((c) => live && setUrl(c ? c.toDataURL() : null));
    return () => { live = false; };
  }, [bg, dark, onlySel, canvasBg]);

  return (
    <Modal title="Export image" onClose={onClose} wide>
      <div className="export">
        <div className={`preview ${bg ? "" : "checker"}`}>{url ? <img src={url} alt="Export preview" /> : <p className="muted">Nothing to export — draw something first.</p>}</div>
        <div className="export-opts">
          <Toggle label="Background" on={bg} set={setBg} />
          <Toggle label="Dark mode" on={dark} set={setDark} />
          {hasSel && <Toggle label="Only selected" on={onlySel} set={setOnlySel} />}
          <div className="opt-row"><span>Scale</span>
            <div className="seg">{[1, 2, 3].map((n) => <button key={n} className={`seg-btn txt ${scale === n ? "on" : ""}`} onClick={() => setScale(n)}>{n}×</button>)}</div>
          </div>
          <div className="btns">
            <button className="btn primary" disabled={!url} onClick={() => exportPng(scale, bg, dark, onlySel)}><FontAwesomeIcon icon={faDownload} /> PNG</button>
            <button className="btn" disabled={!url} onClick={() => exportSvg(scale, bg, dark, onlySel)}><FontAwesomeIcon icon={faDownload} /> SVG</button>
            <button className="btn" disabled={!url} onClick={() => copyPng()}><FontAwesomeIcon icon={faCopy} /> Copy</button>
            <button className="btn" disabled={!hasContent()} onClick={saveFile}><FontAwesomeIcon icon={faDownload} /> .easydraw</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
  <button className="opt-row toggle" onClick={() => set(!on)} role="switch" aria-checked={on}><span>{label}</span><span className={`switch ${on ? "on" : ""}`}><i /></span></button>
);

/* ---------------- collaboration ---------------- */
function CollabDialog({ onClose }: { onClose: () => void }) {
  const { room, connected, name, peers } = useApp((s) => s.collab);
  const [nm, setNm] = useState(name);
  const [copied, setCopied] = useState(false);
  const link = room ? roomLink(room) : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
  };
  return (
    <Modal title="Live collaboration" onClose={onClose}>
      {!room ? (
        <div className="collab">
          <p className="lead">Invite people to draw on this canvas together, in real time. Anyone with the link can join and edit.</p>
          <label className="lbl">Your name</label>
          <input className="input" value={nm} placeholder="e.g. Alex" maxLength={24} onChange={(e) => setNm(e.target.value)} />
          <p className="muted small">Needs the relay server running (<code>cd server &amp;&amp; bun index.ts</code>). Sessions live in server memory; your local drawing is the starting point.</p>
          <button className="btn primary big" onClick={() => { useApp.getState().setCollab({ name: nm.trim() }); startCollab(); }}>Start session</button>
        </div>
      ) : (
        <div className="collab">
          <p className="status"><i className={`dot ${connected ? "ok" : ""}`} /> {connected ? `Connected · ${peers.length + 1} ${peers.length ? "people" : "person"} here` : "Reconnecting to the server…"}</p>
          <label className="lbl">Your name</label>
          <input className="input" value={nm} maxLength={24} onChange={(e) => { setNm(e.target.value); renameSelf(e.target.value || "Guest"); }} />
          <label className="lbl">Shareable link</label>
          <div className="copy-row">
            <input className="input mono" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="btn primary" onClick={copy}><FontAwesomeIcon icon={copied ? faCheck : faLink} /> {copied ? "Copied" : "Copy link"}</button>
          </div>
          {peers.length > 0 && <ul className="peer-list">{peers.map((p) => <li key={p.id}><span className="avatar" style={{ background: p.color }}>{p.name[0]}</span>{p.name}</li>)}</ul>}
          <button className="btn danger" onClick={() => { stopCollab(); onClose(); }}><FontAwesomeIcon icon={faPlugCircleXmark} /> Stop session</button>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- help ---------------- */
const SHORTCUTS: [string, [string, string][]][] = [
  ["Tools", [["Selection", "V or 1"], ["Rectangle", "R or 2"], ["Diamond", "D or 3"], ["Ellipse", "O or 4"], ["Arrow", "A or 5"], ["Line", "L or 6"], ["Draw", "P or 7"], ["Text", "T or 8"], ["Image", "9"], ["Eraser", "E or 0"], ["Hand / pan", "H or hold Space"], ["Keep tool active", "Q"]]],
  ["Editing", [["Undo / redo", "Ctrl+Z / Ctrl+Shift+Z"], ["Duplicate", "Ctrl+D or Alt+drag"], ["Group / ungroup", "Ctrl+G / Ctrl+Shift+G"], ["Forward / backward", "Ctrl+] / Ctrl+["], ["Front / back", "Ctrl+Shift+] / ["], ["Lock / unlock", "Ctrl+Shift+L"], ["Edit text / label", "Enter or double-click"], ["Nudge", "Arrow keys (Shift ×10)"], ["Select all", "Ctrl+A"], ["Delete", "Del"]]],
  ["View", [["Zoom in / out", "Ctrl+ + / −"], ["Reset zoom", "Ctrl+0"], ["Zoom to fit all", "Shift+1"], ["Zoom to selection", "Shift+2"], ["Pan", "Scroll, middle-drag"], ["Zoom", "Ctrl+scroll / pinch"], ["Toggle grid", "Ctrl+'"], ["Toggle theme", "Alt+Shift+D"]]],
  ["Drawing", [["Constrain / square / 15° angle", "Hold Shift"], ["Draw from center", "Hold Alt"], ["Finish a multi-point line", "Double-click or Enter"], ["Move without snapping", "Hold Alt (point drag)"]]],
  ["App", [["Command palette", "Ctrl+K"], ["Export image", "Ctrl+Shift+E"], ["Save / open", "Ctrl+S / Ctrl+O"], ["Help", "?"]]],
];
function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} wide>
      <div className="shortcuts">
        {SHORTCUTS.map(([h, rows]) => (
          <section key={h}><h3>{h}</h3>{rows.map(([a, b]) => <div key={a} className="sc"><span>{a}</span><kbd>{b}</kbd></div>)}</section>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- reset ---------------- */
function ClearDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Clear canvas" onClose={onClose}>
      <div className="collab">
        <p className="lead">This removes everything on the canvas. You can still undo it with Ctrl+Z.</p>
        <div className="btns"><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" onClick={() => { useApp.getState().clearAll(); onClose(); }}>Clear canvas</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- command palette ---------------- */
interface Cmd { label: string; kbd?: string; icon?: ReactNode; run: () => void }
const TOOL_ICON: Partial<Record<ToolType, ReactNode>> = { selection: <LuMousePointer2 />, rectangle: <LuSquare />, diamond: <LuDiamond />, ellipse: <LuCircle />, arrow: <LuMoveUpRight />, line: <LuMinus />, freedraw: <LuPencil />, text: <LuType />, image: <LuImage />, eraser: <LuEraser />, hand: <LuHand /> };

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const s = useApp.getState;
  const cmds = useMemo<Cmd[]>(() => [
    ...(["selection", "rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "text", "image", "eraser", "hand"] as ToolType[]).map((t) => ({
      label: `Tool: ${t === "freedraw" ? "Draw" : t[0].toUpperCase() + t.slice(1)}`, icon: TOOL_ICON[t], run: () => s().setTool(t),
    })),
    { label: "Undo", kbd: "Ctrl+Z", run: () => s().undo() },
    { label: "Redo", kbd: "Ctrl+Shift+Z", run: () => s().redo() },
    { label: "Select all", kbd: "Ctrl+A", run: () => s().selectAll() },
    { label: "Zoom to fit", kbd: "Shift+1", run: () => s().fit() },
    { label: "Zoom to 100%", kbd: "Ctrl+0", run: () => s().zoomTo(1) },
    { label: "Toggle grid", kbd: "Ctrl+'", run: () => s().toggleGrid() },
    { label: "Toggle dark mode", kbd: "Alt+Shift+D", run: () => s().setTheme(s().theme === "dark" ? "light" : "dark") },
    { label: "Export image…", kbd: "Ctrl+Shift+E", run: () => s().setDialog("export") },
    { label: "Save to file", kbd: "Ctrl+S", run: saveFile },
    { label: "Open file…", kbd: "Ctrl+O", run: () => window.dispatchEvent(new CustomEvent("easydraw:open")) },
    { label: "Copy canvas as PNG", run: () => copyPng() },
    { label: "Start live collaboration…", run: () => s().setDialog("collab") },
    { label: "Keyboard shortcuts", kbd: "?", run: () => s().setDialog("help") },
    { label: "Clear canvas…", run: () => s().setDialog("clear") },
  ], [s]);
  const list = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => input.current?.focus(), []);
  const run = (c?: Cmd) => { if (!c) return; onClose(); setTimeout(c.run, 0); };

  return (
    <div className="backdrop top" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="island palette" role="dialog" aria-label="Command palette">
        <input
          ref={input} className="palette-input" placeholder="Search commands…" value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter") run(list[i]);
          }}
        />
        <div className="palette-list">
          {list.map((c, n) => (
            <button key={c.label} className={`ctx-item ${n === i ? "hot" : ""}`} onMouseEnter={() => setI(n)} onClick={() => run(c)}>
              <span className="ico">{c.icon}</span><span className="lbl">{c.label}</span>{c.kbd && <kbd>{c.kbd}</kbd>}
            </button>
          ))}
          {!list.length && <p className="muted pad">No matching commands</p>}
        </div>
      </div>
    </div>
  );
}
