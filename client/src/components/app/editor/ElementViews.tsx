import { memo } from "react";
import type { CanvasElement } from "../../../lib/types";
import { DIAGRAM_TYPES } from "../../../lib/engine";
import { renderCached } from "./geometry";

type El<K extends CanvasElement["kind"]> = Extract<CanvasElement, { kind: K }>;

export const BoxElement = memo(function BoxElement({ el, theme, editing, onText, onEditEnd }: { el: CanvasElement; theme: "light" | "dark"; editing: boolean; onText: (id: string, text: string) => void; onEditEnd: () => void }) {
  const base = { position: "absolute" as const, left: el.x, top: el.y, width: el.w, height: el.h };
  const editor = (cls: string, value: string, style?: React.CSSProperties) => (
    <textarea
      autoFocus
      value={value}
      onChange={(e) => onText(el.id, e.target.value)}
      onBlur={onEditEnd}
      onKeyDown={(e) => {
        if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cls}
      style={style}
    />
  );

  switch (el.kind) {
    case "diagram": {
      const d = el as El<"diagram">;
      const svg = renderCached(d.code, d.diagramType, theme);
      return (
        <div data-el={el.id} style={base} className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-sm">
          <div className="flex h-7 shrink-0 select-none items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-soft)] px-3 text-[11px] text-[var(--fg-muted)]">
            <span className="truncate font-medium text-[var(--fg)]">{d.title || "Diagram"}</span>
            <span className="ml-auto shrink-0">{DIAGRAM_TYPES.find((t) => t.id === d.diagramType)?.label}</span>
          </div>
          <div className="pointer-events-none min-h-0 flex-1 p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      );
    }
    case "note": {
      const n = el as El<"note">;
      return (
        <div data-el={el.id} style={{ ...base, background: n.color, color: "#27272a" }} className="overflow-hidden rounded-md p-3 text-[15px] leading-snug shadow-md">
          {editing ? editor("h-full w-full resize-none bg-transparent outline-none", n.text) : <div className="whitespace-pre-wrap break-words">{n.text || <span className="opacity-40">Double-click to write</span>}</div>}
        </div>
      );
    }
    case "text": {
      const t = el as El<"text">;
      return (
        <div data-el={el.id} style={{ ...base, color: t.color, fontSize: t.fontSize, height: "auto", minHeight: el.h }} className="whitespace-pre-wrap break-words leading-tight">
          {editing ? editor("w-full resize-none bg-transparent outline-none", t.text, { fontSize: t.fontSize, color: t.color, minHeight: el.h }) : t.text || <span className="opacity-40">Text</span>}
        </div>
      );
    }
    case "shape": {
      const s = el as El<"shape">;
      const inset = 1.5;
      const w = el.w;
      const h = el.h;
      return (
        <div data-el={el.id} style={base}>
          <svg width={w} height={h} className="absolute inset-0 overflow-visible" style={{ pointerEvents: "none" }}>
            {s.shape === "rect" && <rect x={inset} y={inset} width={w - 3} height={h - 3} rx={8} fill={s.fill} stroke={s.stroke} strokeWidth={2} />}
            {s.shape === "ellipse" && <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - inset} ry={h / 2 - inset} fill={s.fill} stroke={s.stroke} strokeWidth={2} />}
            {s.shape === "diamond" && <polygon points={`${w / 2},${inset} ${w - inset},${h / 2} ${w / 2},${h - inset} ${inset},${h / 2}`} fill={s.fill} stroke={s.stroke} strokeWidth={2} strokeLinejoin="round" />}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[15px]" style={{ color: theme === "dark" ? "#f4f4f5" : "#18181b" }}>
            {editing ? editor("h-full w-full resize-none bg-transparent text-center outline-none", s.text, { paddingTop: Math.max(0, h / 2 - 28) }) : <span className="whitespace-pre-wrap break-words">{s.text}</span>}
          </div>
        </div>
      );
    }
    case "image":
      return <img data-el={el.id} src={(el as El<"image">).src} alt="" draggable={false} style={{ ...base, objectFit: "fill" }} className="select-none rounded-md" />;
    default:
      return null;
  }
});

/** Strokes and arrows live in their own overflow-visible svg so z-order follows the element array. */
export const LineElement = memo(function LineElement({ el, theme }: { el: CanvasElement; theme: "light" | "dark" }) {
  if (el.kind === "stroke") {
    const p = el.points;
    let d = `M${p[0]} ${p[1]}`;
    if (p.length <= 4) d += `L${p[2] ?? p[0]} ${p[3] ?? p[1]}`;
    else for (let i = 2; i + 3 < p.length; i += 2) d += `Q${p[i]} ${p[i + 1]} ${(p[i]! + p[i + 2]!) / 2} ${(p[i + 1]! + p[i + 3]!) / 2}`;
    const color = theme === "dark" && el.color === "#18181b" ? "#f4f4f5" : el.color;
    return (
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width={1} height={1}>
        <path d={d} fill="none" stroke={color} strokeWidth={el.size} strokeLinecap="round" strokeLinejoin="round" />
        <path data-el={el.id} d={d} fill="none" stroke="transparent" strokeWidth={Math.max(14, el.size + 10)} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "stroke" }} />
      </svg>
    );
  }
  if (el.kind === "arrow") {
    const color = theme === "dark" && el.color === "#18181b" ? "#f4f4f5" : el.color;
    const ang = Math.atan2(el.y2 - el.y, el.x2 - el.x);
    const hx = (a: number) => el.x2 - 14 * Math.cos(ang + a);
    const hy = (a: number) => el.y2 - 14 * Math.sin(ang + a);
    return (
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width={1} height={1}>
        <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeDasharray={el.dashed ? "7 6" : undefined} />
        <path d={`M${hx(0.45)} ${hy(0.45)}L${el.x2} ${el.y2}L${hx(-0.45)} ${hy(-0.45)}`} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <line data-el={el.id} x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} stroke="transparent" strokeWidth={16} style={{ pointerEvents: "stroke" }} />
      </svg>
    );
  }
  return null;
});
