import { useMemo, useRef } from "react";
import { renderMarkdown } from "../../../lib/markdown";
import type { CanvasElement } from "../../../lib/types";
import { renderCached } from "./geometry";
import { cx } from "../../ui";

export default function DocPane({
  doc,
  setDoc,
  elements,
  theme,
  canEdit,
  mode,
  onInsertDiagram,
}: {
  doc: string;
  setDoc: (s: string) => void;
  elements: CanvasElement[];
  theme: "light" | "dark";
  canEdit: boolean;
  mode: "split" | "preview" | "edit";
  onInsertDiagram: () => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(
    () =>
      renderMarkdown(doc, {
        theme,
        figure: (id) => {
          const el = elements.find((e) => e.id === id);
          return el && el.kind === "diagram" ? renderCached(el.code, el.diagramType, theme) : null;
        },
      }),
    [doc, elements, theme],
  );

  const wrapSel = (pre: string, post = pre) => {
    const t = ta.current;
    if (!t) return;
    const { selectionStart: s, selectionEnd: e } = t;
    setDoc(doc.slice(0, s) + pre + doc.slice(s, e) + post + doc.slice(e));
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(s + pre.length, e + pre.length);
    });
  };
  const linePrefix = (p: string) => {
    const t = ta.current;
    if (!t) return;
    const s = doc.lastIndexOf("\n", t.selectionStart - 1) + 1;
    setDoc(doc.slice(0, s) + p + doc.slice(s));
  };

  const tb = "cursor-pointer rounded-md px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]";
  return (
    <div className={cx("grid h-full min-h-0", mode === "split" ? "grid-rows-2 lg:grid-cols-2 lg:grid-rows-1" : "grid-cols-1")}>
      {mode !== "preview" && (
        <div className="flex min-h-0 flex-col border-[var(--border)] lg:border-r">
          {canEdit && (
            <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] px-2 py-1.5">
              <button className={tb} onClick={() => linePrefix("# ")}>H1</button>
              <button className={tb} onClick={() => linePrefix("## ")}>H2</button>
              <button className={tb} onClick={() => wrapSel("**")}><b>B</b></button>
              <button className={tb} onClick={() => wrapSel("*")}><i>I</i></button>
              <button className={tb} onClick={() => wrapSel("`")}>{"</>"}</button>
              <button className={tb} onClick={() => linePrefix("- ")}>List</button>
              <button className={tb} onClick={() => wrapSel("[", "](https://)")}>Link</button>
              <button className={cx(tb, "ml-auto !text-[var(--color-brand)]")} onClick={onInsertDiagram}>+ Insert diagram</button>
            </div>
          )}
          <textarea
            ref={ta}
            value={doc}
            readOnly={!canEdit}
            onChange={(e) => setDoc(e.target.value)}
            spellCheck={false}
            aria-label="Document markdown"
            className="min-h-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed text-[var(--fg)] outline-none"
          />
        </div>
      )}
      {mode !== "edit" && (
        <div className="min-h-0 overflow-auto p-6">
          <article className="md mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
