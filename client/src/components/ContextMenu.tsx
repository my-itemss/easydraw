import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LuArrowDownToLine, LuArrowUpToLine, LuClipboardPaste, LuCopy, LuGrid3X3, LuGroup, LuImage, LuLock, LuLockOpen, LuMaximize, LuMousePointerClick, LuScissors, LuTrash2, LuUngroup, LuCopyPlus } from "react-icons/lu";
import { getSelected, useApp } from "../store";
import { copyPng } from "../lib/actions";

interface Item { label: string; icon: ReactNode; kbd?: string; run: () => void; danger?: boolean }

export default function ContextMenu({ x, y, onClose, onPasteText }: { x: number; y: number; onClose: () => void; onPasteText: (t: string) => void }) {
  const s = useApp();
  const sel = getSelected(s);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
  }, [x, y]);

  useEffect(() => {
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", onClose);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("blur", onClose); };
  }, [onClose]);

  const copyJson = async (cut: boolean) => {
    const text = JSON.stringify({ type: "easydraw/clip", elements: sel });
    try { await navigator.clipboard.writeText(text); } catch { /* */ }
    if (cut) s.removeSelected();
  };
  const paste = async () => {
    try { onPasteText(await navigator.clipboard.readText()); } catch { s.showToast("Use Ctrl+V to paste here"); }
  };
  const grouped = sel.some((e) => e.groupIds.length);
  const allLocked = sel.length > 0 && sel.every((e) => e.locked);

  const groups: Item[][] = sel.length
    ? [
        [
          { label: "Cut", icon: <LuScissors />, kbd: "Ctrl+X", run: () => copyJson(true) },
          { label: "Copy", icon: <LuCopy />, kbd: "Ctrl+C", run: () => copyJson(false) },
          { label: "Paste", icon: <LuClipboardPaste />, kbd: "Ctrl+V", run: paste },
          { label: "Copy as PNG", icon: <LuImage />, kbd: "", run: copyPng },
        ],
        [
          { label: "Duplicate", icon: <LuCopyPlus />, kbd: "Ctrl+D", run: s.duplicate },
          ...(sel.length > 1 ? [{ label: "Group", icon: <LuGroup />, kbd: "Ctrl+G", run: s.group }] : []),
          ...(grouped ? [{ label: "Ungroup", icon: <LuUngroup />, kbd: "Ctrl+Shift+G", run: s.ungroup }] : []),
          { label: allLocked ? "Unlock" : "Lock", icon: allLocked ? <LuLockOpen /> : <LuLock />, kbd: "Ctrl+Shift+L", run: s.toggleLock },
        ],
        [
          { label: "Bring to front", icon: <LuArrowUpToLine />, kbd: "Ctrl+Shift+]", run: () => s.order("front") },
          { label: "Send to back", icon: <LuArrowDownToLine />, kbd: "Ctrl+Shift+[", run: () => s.order("back") },
        ],
        [{ label: "Delete", icon: <LuTrash2 />, kbd: "Del", run: s.removeSelected, danger: true }],
      ]
    : [
        [{ label: "Paste", icon: <LuClipboardPaste />, kbd: "Ctrl+V", run: paste }],
        [
          { label: "Select all", icon: <LuMousePointerClick />, kbd: "Ctrl+A", run: s.selectAll },
          { label: s.grid ? "Hide grid" : "Show grid", icon: <LuGrid3X3 />, kbd: "Ctrl+'", run: s.toggleGrid },
          { label: "Zoom to fit", icon: <LuMaximize />, kbd: "Shift+1", run: () => s.fit() },
        ],
      ];

  return (
    <div ref={ref} className="island ctx" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {groups.map((g, gi) => (
        <div key={gi} className="ctx-group">
          {g.map((it) => (
            <button key={it.label} className={`ctx-item ${it.danger ? "danger" : ""}`} onClick={() => { onClose(); it.run(); }}>
              <span className="ico">{it.icon}</span>
              <span className="lbl">{it.label}</span>
              {it.kbd && <kbd>{it.kbd}</kbd>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
