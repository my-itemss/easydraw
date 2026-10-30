import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import type { DiagramType } from "../../lib/types";
import { Button, Spinner, cx } from "../ui";
import ResultPanel, { type ToolResult } from "./ResultPanel";
import { DIAGRAM_LABELS, friendlyError, readSession, titleFromPrompt, writeSession } from "./util";

export interface ToolExample {
  label: string;
  prompt: string;
  type?: DiagramType;
}

type Choice = "auto" | DiagramType;
const CHOICES: Choice[] = ["auto", "flowchart", "architecture", "sequence", "erd"];

/** Shared prompt-to-diagram tool used by /diagramgpt and the locked-type generators. */
export default function DiagramTool({
  lockedType,
  examples,
  storageKey,
  placeholder,
  label = "Describe your diagram",
}: {
  lockedType?: DiagramType;
  examples: ToolExample[];
  storageKey: string;
  placeholder?: string;
  label?: string;
}) {
  const uid = useId();
  const [prompt, setPrompt] = useState(() => readSession(storageKey));
  const [choice, setChoice] = useState<Choice>(lockedType ?? "auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ r: ToolResult; prompt: string; n: number } | null>(null);
  const counter = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeSession(storageKey, prompt);
  }, [prompt, storageKey]);

  const type: Choice = lockedType ?? choice;

  async function run(p: string, t: Choice) {
    const text = p.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.ai.diagram({ prompt: text, diagramType: t === "auto" ? undefined : t });
      counter.current += 1;
      setResult({ r: { code: r.code, diagramType: r.diagramType, explanation: r.explanation, mode: r.mode }, prompt: text, n: counter.current });
      window.setTimeout(() => resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }), 50);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(prompt, type);
  }

  function pickExample(ex: ToolExample) {
    setPrompt(ex.prompt);
    const t: Choice = lockedType ?? ex.type ?? "auto";
    if (!lockedType) setChoice(t);
    void run(ex.prompt, t);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 shadow-sm sm:p-4">
        <label htmlFor={`${uid}-prompt`} className="mb-2 block text-sm font-medium">
          {label}
        </label>
        <textarea
          id={`${uid}-prompt`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void run(prompt, type);
            }
          }}
          rows={4}
          maxLength={4000}
          placeholder={placeholder ?? "A user signs in, the API checks the password in Postgres and returns a session token..."}
          className="block w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-[15px] leading-relaxed outline-none placeholder:text-[var(--fg-muted)]/70 focus:border-[var(--color-brand)]"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {lockedType ? (
            <p className="text-sm text-[var(--fg-muted)]">
              Diagram type: <strong className="font-semibold text-[var(--fg)]">{DIAGRAM_LABELS[lockedType]}</strong>
            </p>
          ) : (
            <div role="radiogroup" aria-label="Diagram type" className="flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] p-0.5">
              {CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={choice === c}
                  onClick={() => setChoice(c)}
                  className={cx(
                    "h-8 cursor-pointer rounded-full px-3 text-[13px] font-medium transition",
                    choice === c ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
                  )}
                >
                  {c === "auto" ? "Auto" : DIAGRAM_LABELS[c]}
                </button>
              ))}
            </div>
          )}
          <Button type="submit" size="lg" disabled={loading || !prompt.trim()} className="w-full sm:w-auto">
            {loading && <Spinner size={16} />}
            {loading ? "Generating" : "Generate diagram"}
          </Button>
        </div>
      </form>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--fg-muted)]">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex.label}
              type="button"
              disabled={loading}
              onClick={() => pickExample(ex)}
              className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3.5 py-1.5 text-[13px] text-[var(--fg-muted)] transition hover:border-[var(--color-brand)] hover:text-[var(--fg)] disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={resultRef} className="mt-6" aria-live="polite" aria-busy={loading}>
        {loading && !result && (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] p-8 text-sm text-[var(--fg-muted)]">
            <Spinner /> Drawing your diagram...
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-relaxed text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
        {result && (
          <div className={cx(loading && "opacity-60 transition")}>
            <ResultPanel key={result.n} result={result.r} prompt={result.prompt} title={titleFromPrompt(result.prompt)} />
          </div>
        )}
      </div>
    </div>
  );
}
