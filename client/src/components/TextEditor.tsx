import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../store";
import { createElement, mutate } from "../lib/elements";
import { FONTS, LINE_HEIGHT, measureText } from "../lib/text";
import type { El } from "../types";

let before: ReturnType<ReturnType<typeof useApp.getState>["snapshot"]> | null = null;

export function beginText(x: number, y: number) {
  const s = useApp.getState();
  before = s.snapshot();
  const el = createElement("text", x, y, s.style, { width: 8, height: s.style.fontSize * LINE_HEIGHT });
  s.add([el], true);
  s.setEditing({ id: el.id, isNew: true });
}

export function beginEdit(id: string) {
  const s = useApp.getState();
  before = s.snapshot();
  s.select([id]);
  s.setEditing({ id, isNew: false });
}

export default function TextEditor() {
  const editing = useApp((s) => s.editing);
  const el = useApp((s) => (s.editing ? s.elements.find((e) => e.id === s.editing!.id) : undefined));
  if (!editing || !el) return null;
  return <Editor key={editing.id} el={el} isNew={editing.isNew} />;
}

function Editor({ el, isNew }: { el: El; isNew: boolean }) {
  const zoom = useApp((s) => s.zoom);
  const sx = useApp((s) => s.scrollX);
  const sy = useApp((s) => s.scrollY);
  const theme = useApp((s) => s.theme);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(el.text ?? "");
  const done = useRef(false);
  const isText = el.type === "text";
  const size = (el.fontSize ?? 20) * zoom;
  const family = FONTS[el.fontFamily ?? "hand"];
  const color = el.strokeColor === "#1e1e1e" && theme === "dark" ? "#e9e9ef" : el.strokeColor;

  useEffect(() => {
    const t = ref.current!;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  }, []);

  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "0px";
    t.style.height = `${t.scrollHeight}px`;
  }, [value, size]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    const s = useApp.getState();
    const text = value.replace(/\s+$/, "");
    if (!text) {
      if (isText) s.setElements(s.elements.map((e) => (e.id === el.id ? mutate(e, { isDeleted: true }) : e)));
      else s.update([el.id], { text: "" });
      s.select([]);
    } else {
      s.update([el.id], { text });
    }
    s.setEditing(null);
    if (before) s.commit(before);
    before = null;
    if (isNew && text && !s.toolLocked) s.setTool("selection", true);
  };

  const key = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); finish(); }
  };

  const common: React.CSSProperties = {
    font: `${size}px ${family}`, lineHeight: LINE_HEIGHT, color, caretColor: color,
    background: "transparent", border: "none", outline: "none", resize: "none", overflow: "hidden", padding: 0, margin: 0,
  };

  if (isText) {
    const m = measureText(value || " ", el.fontSize ?? 20, el.fontFamily ?? "hand");
    return (
      <div className="te-layer">
        <textarea
          ref={ref} value={value} spellCheck={false} rows={1} wrap="off"
          onChange={(e) => setValue(e.target.value)} onKeyDown={key} onBlur={finish}
          style={{
            ...common, position: "absolute", left: (el.x + sx) * zoom, top: (el.y + sy) * zoom,
            width: Math.max(m.width * zoom + size * 0.6, 12), textAlign: el.textAlign ?? "left", whiteSpace: "pre",
            transform: `rotate(${el.angle}rad)`, transformOrigin: `${(m.width * zoom) / 2}px ${(m.height * zoom) / 2}px`,
          }}
        />
      </div>
    );
  }

  const inset = el.type === "rectangle" ? 0.9 : 0.62;
  return (
    <div className="te-layer">
      <div
        style={{
          position: "absolute", left: (el.x + sx) * zoom, top: (el.y + sy) * zoom, width: el.width * zoom, height: el.height * zoom,
          display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${el.angle}rad)`,
        }}
      >
        <textarea
          ref={ref} value={value} spellCheck={false} rows={1}
          onChange={(e) => setValue(e.target.value)} onKeyDown={key} onBlur={finish}
          style={{ ...common, width: Math.max(30, el.width * inset * zoom - 16 * zoom), textAlign: "center" }}
        />
      </div>
    </div>
  );
}
