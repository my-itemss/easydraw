import { useId, useRef, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { Button, Spinner, cx } from "../ui";
import ResultPanel, { type ToolResult } from "./ResultPanel";
import { friendlyError } from "./util";

const REPO_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;

/** Returns the normalised repo URL, or null if it is not a plain https://github.com/<owner>/<repo> URL. */
export function parseRepoUrl(input: string): { url: string; owner: string; repo: string } | null {
  let t = input.trim();
  if (/^(www\.)?github\.com\//i.test(t)) t = "https://" + t.replace(/^www\./i, "");
  t = t.replace(/^http:\/\//i, "https://").replace(/^https:\/\/www\./i, "https://");
  const m = REPO_RE.exec(t);
  if (!m || !m[1] || !m[2] || m[2] === "." || m[2] === "..") return null;
  return { url: `https://github.com/${m[1]}/${m[2]}`, owner: m[1], repo: m[2] };
}

const EXAMPLES = ["https://github.com/honojs/hono", "https://github.com/vitejs/vite", "https://github.com/expressjs/express"];

export default function RepoTool() {
  const uid = useId();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ r: ToolResult; name: string; n: number } | null>(null);
  const n = useRef(0);

  async function run(raw: string) {
    const p = parseRepoUrl(raw);
    if (!p) {
      setError("Enter a public GitHub repository URL like https://github.com/owner/repo");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.ai.repo(p.url);
      n.current += 1;
      setRes({ r: { code: r.code, diagramType: r.diagramType, explanation: r.explanation, mode: r.mode }, name: `${p.owner}/${p.repo}`, n: n.current });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(value);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 shadow-sm sm:p-4" noValidate>
        <label htmlFor={`${uid}-url`} className="mb-2 block text-sm font-medium">
          Public GitHub repository URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${uid}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://github.com/owner/repo"
            aria-invalid={!!error}
            aria-describedby={error ? `${uid}-err` : undefined}
            className={cx(
              "h-12 min-w-0 flex-1 rounded-full border bg-[var(--bg)] px-5 text-[15px] outline-none focus:border-[var(--color-brand)]",
              error ? "border-red-500/60" : "border-[var(--border)]",
            )}
          />
          <Button type="submit" size="lg" disabled={loading || !value.trim()}>
            {loading && <Spinner size={16} />}
            {loading ? "Reading repo" : "Diagram this repo"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--fg-muted)]">Only the public file tree is read through the GitHub API. No code is cloned and private repositories are not supported.</p>
      </form>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--fg-muted)]">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((u) => (
            <button
              key={u}
              type="button"
              disabled={loading}
              onClick={() => {
                setValue(u);
                void run(u);
              }}
              className="mono cursor-pointer rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3.5 py-1.5 text-[12.5px] text-[var(--fg-muted)] transition hover:border-[var(--color-brand)] hover:text-[var(--fg)] disabled:opacity-50"
            >
              {u.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {loading && !res && (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] p-8 text-sm text-[var(--fg-muted)]">
            <Spinner /> Reading the repository...
          </div>
        )}
        {error && (
          <p id={`${uid}-err`} role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-relaxed text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
        {res && (
          <div className={cx(loading && "opacity-60 transition")}>
            <ResultPanel key={res.n} result={res.r} prompt="" title={res.name} history={[]} allowRefine={false} />
          </div>
        )}
      </div>
    </div>
  );
}
