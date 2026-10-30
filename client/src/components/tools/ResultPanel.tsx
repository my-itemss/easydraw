import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useOpenInEditor } from "../../lib/files";
import { renderDiagram } from "../../lib/engine";
import type { DiagramType } from "../../lib/types";
import { Button, Spinner, cx } from "../ui";
import DiagramView from "../DiagramView";
import { copyToClipboard, downloadBlob, exportSvg, friendlyError, slugify, svgToPngBlob } from "./util";

export type Mode = "claude" | "offline" | "local";

export interface ToolResult {
  code: string;
  diagramType: DiagramType;
  explanation?: string;
  mode: Mode;
}

export function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === "local")
    return <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-xs font-medium text-[var(--fg-muted)]">Converted in your browser</span>;
  if (mode === "claude")
    return <span className="rounded-full bg-[var(--color-brand)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--color-brand)]">Powered by Claude</span>;
  return (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
      Offline mode – set ANTHROPIC_API_KEY on the server for full AI
    </span>
  );
}

/**
 * Live preview + editable code + refine + export actions for one generated diagram.
 * Remount it (via `key`) to load a new result.
 */
export default function ResultPanel({
  result,
  prompt,
  title,
  history: initialHistory,
  allowRefine = true,
}: {
  result: ToolResult;
  prompt: string;
  title: string;
  history?: { role: "user" | "assistant"; content: string }[];
  allowRefine?: boolean;
}) {
  const uid = useId();
  const openInEditor = useOpenInEditor();
  const [code, setCode] = useState(result.code);
  const [debounced, setDebounced] = useState(result.code);
  const [tab, setTab] = useState<"diagram" | "code">("diagram");
  const [refine, setRefine] = useState("");
  const [refining, setRefining] = useState(false);
  const [mode, setMode] = useState<Mode>(result.mode);
  const [note, setNote] = useState(result.explanation ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"" | "png" | "svg" | "open">("");
  const history = useRef(initialHistory ?? (prompt ? [{ role: "user" as const, content: prompt }, { role: "assistant" as const, content: result.code }] : []));
  const type = result.diagramType;

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(code), 250);
    return () => window.clearTimeout(t);
  }, [code]);

  const errors = useMemo(() => renderDiagram(debounced, type).diagnostics.filter((d) => d.severity === "error"), [debounced, type]);

  const flash = (m: string) => {
    setStatus(m);
    window.setTimeout(() => setStatus(""), 2200);
  };

  async function onRefine(e: FormEvent) {
    e.preventDefault();
    const p = refine.trim();
    if (!p || refining) return;
    setRefining(true);
    setError(null);
    try {
      const r = await api.ai.diagram({ prompt: p, diagramType: type, currentCode: code, history: history.current.slice(-8) });
      history.current = [...history.current, { role: "user", content: p }, { role: "assistant", content: r.code }];
      setCode(r.code);
      setDebounced(r.code);
      setMode(r.mode);
      setNote(r.explanation ?? "");
      setRefine("");
      setTab("diagram");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefining(false);
    }
  }

  async function onCopy() {
    flash((await copyToClipboard(code)) ? "Code copied" : "Could not copy. Select the code and copy it manually.");
  }

  function onSvg() {
    try {
      const r = exportSvg(code, type);
      downloadBlob(new Blob([r.svg], { type: "image/svg+xml;charset=utf-8" }), `${slugify(title)}.svg`);
      flash("SVG downloaded");
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function onPng() {
    setBusy("png");
    setError(null);
    try {
      const r = exportSvg(code, type);
      const blob = await svgToPngBlob(r.svg, r.width, r.height, 2);
      downloadBlob(blob, `${slugify(title)}.png`);
      flash("PNG downloaded");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy("");
    }
  }

  async function onOpen() {
    setBusy("open");
    setError(null);
    try {
      await openInEditor({ title, diagramType: type, code });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy("");
    }
  }

  const tabBtn = (id: "diagram" | "code", label: string) => (
    <button
      type="button"
      role="tab"
      id={`${uid}-tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`${uid}-panel-${id}`}
      onClick={() => setTab(id)}
      className={cx(
        "h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-medium transition",
        tab === id ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
      )}
    >
      {label}
    </button>
  );

  return (
    <section aria-label="Result" className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div role="tablist" aria-label="Result view" className="flex gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] p-0.5">
          {tabBtn("diagram", "Diagram")}
          {tabBtn("code", "Code")}
        </div>
        <ModeBadge mode={mode} />
      </div>

      <div className="p-4 sm:p-5">
        {tab === "diagram" ? (
          <div id={`${uid}-panel-diagram`} role="tabpanel" aria-labelledby={`${uid}-tab-diagram`} className="ed-grid min-h-[200px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 sm:p-5">
            <DiagramView code={debounced} type={type} showErrors />
          </div>
        ) : (
          <div id={`${uid}-panel-code`} role="tabpanel" aria-labelledby={`${uid}-tab-code`}>
            <label htmlFor={`${uid}-code`} className="sr-only">
              Diagram code
            </label>
            <textarea
              id={`${uid}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="mono h-72 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3.5 text-[13px] leading-relaxed text-[var(--fg)] outline-none focus:border-[var(--color-brand)]"
            />
            {errors.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-red-500">
                {errors.slice(0, 4).map((d, i) => (
                  <li key={i}>
                    Line {d.line}: {d.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-[var(--fg-muted)]">The preview updates as you type. See the syntax docs for the full language.</p>
          </div>
        )}

        {note && <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">{note}</p>}

        {allowRefine && (
          <form onSubmit={onRefine} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`${uid}-refine`} className="sr-only">
              Refine this diagram
            </label>
            <input
              id={`${uid}-refine`}
              value={refine}
              onChange={(e) => setRefine(e.target.value)}
              placeholder='Refine it: "add a cache between the API and the database"'
              maxLength={2000}
              className="h-11 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm outline-none focus:border-[var(--color-brand)]"
            />
            <Button type="submit" variant="secondary" disabled={refining || !refine.trim()}>
              {refining ? <Spinner size={16} /> : null}
              Refine
            </Button>
          </form>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onCopy}>
            Copy code
          </Button>
          <Button size="sm" variant="secondary" onClick={onSvg}>
            Download SVG
          </Button>
          <Button size="sm" variant="secondary" onClick={onPng} disabled={busy === "png"}>
            {busy === "png" && <Spinner size={14} />}
            Download PNG
          </Button>
          <Button size="sm" onClick={onOpen} disabled={busy === "open"} className="sm:ml-auto">
            {busy === "open" && <Spinner size={14} />}
            Save and edit in easydraw
          </Button>
        </div>
        <p className="mt-2 min-h-5 text-xs text-[var(--fg-muted)]" aria-live="polite">
          {status}
        </p>
        {error && (
          <p role="alert" className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
