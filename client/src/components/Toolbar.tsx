import type { ReactNode } from "react";
import { LuCircle, LuDiamond, LuEraser, LuHand, LuImage, LuLock, LuLockOpen, LuMinus, LuMoveUpRight, LuMousePointer2, LuPencil, LuSquare, LuType } from "react-icons/lu";
import { useApp } from "../store";
import type { ToolType } from "../types";

const TOOLS: { id: ToolType; icon: ReactNode; label: string; key: string; num?: string }[] = [
  { id: "hand", icon: <LuHand />, label: "Hand (panning tool)", key: "H" },
  { id: "selection", icon: <LuMousePointer2 />, label: "Selection", key: "V", num: "1" },
  { id: "rectangle", icon: <LuSquare />, label: "Rectangle", key: "R", num: "2" },
  { id: "diamond", icon: <LuDiamond />, label: "Diamond", key: "D", num: "3" },
  { id: "ellipse", icon: <LuCircle />, label: "Ellipse", key: "O", num: "4" },
  { id: "arrow", icon: <LuMoveUpRight />, label: "Arrow", key: "A", num: "5" },
  { id: "line", icon: <LuMinus />, label: "Line", key: "L", num: "6" },
  { id: "freedraw", icon: <LuPencil />, label: "Draw", key: "P", num: "7" },
  { id: "text", icon: <LuType />, label: "Text", key: "T", num: "8" },
  { id: "image", icon: <LuImage />, label: "Insert image", key: "9", num: "9" },
  { id: "eraser", icon: <LuEraser />, label: "Eraser", key: "E", num: "0" },
];

export default function Toolbar() {
  const tool = useApp((s) => s.tool);
  const locked = useApp((s) => s.toolLocked);
  const setTool = useApp((s) => s.setTool);
  const toggle = useApp((s) => s.toggleToolLock);
  return (
    <div className="island toolbar" role="toolbar" aria-label="Drawing tools">
      <button className={`tool ${locked ? "active" : ""}`} data-tip="Keep selected tool active after drawing — Q" onClick={toggle} aria-pressed={locked}>
        {locked ? <LuLock /> : <LuLockOpen />}
      </button>
      <span className="sep" />
      {TOOLS.map((t, i) => (
        <span key={t.id} style={{ display: "contents" }}>
          {i === 2 && <span className="sep" />}
          <button className={`tool ${tool === t.id ? "active" : ""}`} data-tip={`${t.label} — ${t.key}${t.num ? ` or ${t.num}` : ""}`} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
            {t.icon}
            {t.num && <i className="num">{t.num}</i>}
          </button>
        </span>
      ))}
    </div>
  );
}
