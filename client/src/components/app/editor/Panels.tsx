import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { DIAGRAM_TYPES, renderDiagram } from "../../../lib/engine";
import type { CanvasElement, Comment, DiagramType, LinkAccess, ShareInfo, VersionSummary } from "../../../lib/types";
import { Avatar, Button, Modal, Spinner, cx, inputClass } from "../../ui";
import { PANEL_TITLE } from "./consts";

type Diagram = Extract<CanvasElement, { kind: "diagram" }>;
const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong");

export function PanelShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className="flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--bg-elev)]">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <h2 className={PANEL_TITLE}>{title}</h2>
        <button onClick={onClose} aria-label="Close panel" className="cursor-pointer rounded-md p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-soft)]">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  );
}

/* ---------------------------------------------------------- Inspector */
export function Inspector({ el, canEdit, onChange, onClose, onFocus }: { el: Diagram; canEdit: boolean; onChange: (p: Partial<Diagram>) => void; onClose: () => void; onFocus?: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const diags = useMemo(() => renderDiagram(el.code, el.diagramType, {}).diagnostics, [el.code, el.diagramType]);

  const ai = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const r = await api.ai.diagram({ prompt, diagramType: el.diagramType, currentCode: el.code });
      onChange({ code: r.code, diagramType: r.diagramType });
      setNote(`${r.explanation} (${r.mode === "claude" ? "Claude" : "offline generator"})`);
      setPrompt("");
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell title="Diagram" onClose={onClose}>
      <div className="space-y-4 p-4">
        <label className="block text-xs font-medium">
          Title
          <input className={cx(inputClass, "mt-1")} value={el.title ?? ""} disabled={!canEdit} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="block text-xs font-medium">
          Type
          <select className={cx(inputClass, "mt-1")} value={el.diagramType} disabled={!canEdit} onChange={(e) => onChange({ diagramType: e.target.value as DiagramType })}>
            {DIAGRAM_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium">
          Code
          <textarea
            value={el.code}
            readOnly={!canEdit}
            onChange={(e) => onChange({ code: e.target.value })}
            spellCheck={false}
            rows={16}
            className="mt-1 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[12.5px] leading-relaxed outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        {diags.length > 0 && (
          <ul className="space-y-1 text-xs">
            {diags.slice(0, 6).map((d, i) => (
              <li key={i} className={d.severity === "error" ? "text-red-500" : "text-amber-500"}>
                Line {d.line}: {d.message}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="mb-2 text-xs font-medium">Edit with AI</div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="e.g. add a cache between the API and the database" className={cx(inputClass, "h-auto py-2")} />
            <Button size="sm" className="mt-2" onClick={ai} disabled={busy || !prompt.trim()}>{busy ? <Spinner size={14} /> : "Apply"}</Button>
            {note && <p className="mt-2 text-xs text-[var(--fg-muted)]">{note}</p>}
            {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
          </div>
        )}
        {onFocus && <Button variant="secondary" size="sm" onClick={onFocus}>Zoom to diagram</Button>}
      </div>
    </PanelShell>
  );
}

/* ------------------------------------------------------------ AI panel */
export function AiPanel({ onInsert, onClose, canEdit }: { onInsert: (code: string, type: DiagramType, title: string) => void; onClose: () => void; canEdit: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<DiagramType | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ code: string; diagramType: DiagramType; explanation: string; mode: string } | null>(null);
  const [repo, setRepo] = useState("");

  const run = async (kind: "prompt" | "repo") => {
    setBusy(true);
    setErr(null);
    try {
      const r = kind === "repo" ? await api.ai.repo(repo.trim()) : await api.ai.diagram({ prompt, diagramType: type || undefined });
      setRes(r);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const preview = useMemo(() => (res ? renderDiagram(res.code, res.diagramType, {}).svg : ""), [res]);

  return (
    <PanelShell title="AI diagram" onClose={onClose}>
      <div className="space-y-3 p-4">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Describe a system, flow or schema…" className={cx(inputClass, "h-auto py-2")} />
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as DiagramType | "")}>
          <option value="">Pick the best type</option>
          {DIAGRAM_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <Button onClick={() => run("prompt")} disabled={busy || !prompt.trim()} className="w-full">{busy ? <Spinner size={16} /> : "Generate"}</Button>
        <div className="flex gap-2">
          <input className={inputClass} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="github.com/owner/repo" />
          <Button variant="secondary" onClick={() => run("repo")} disabled={busy || !repo.trim()}>Repo</Button>
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        {res && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="overflow-auto rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: preview }} />
            <p className="mt-2 text-xs text-[var(--fg-muted)]">{res.explanation} · {res.mode === "claude" ? "Claude" : "offline generator"}</p>
            {canEdit && <Button size="sm" className="mt-2" onClick={() => onInsert(res.code, res.diagramType, prompt.slice(0, 40) || "AI diagram")}>Add to canvas</Button>}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

/* ------------------------------------------------------------ Comments */
export function CommentsPanel({ fileId, comments, reload, onClose, focusId, pendingAnchor, clearPending }: { fileId: string; comments: Comment[]; reload: () => void; onClose: () => void; focusId: string | null; pendingAnchor: Comment["anchor"]; clearPending: () => void }) {
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const roots = comments.filter((c) => !c.parentId);
  const send = async (parentId?: string, text = body, anchor = pendingAnchor) => {
    if (!text.trim()) return;
    try {
      await api.comments.create(fileId, { body: text.trim(), parentId: parentId ?? null, anchor: parentId ? null : anchor });
      if (!parentId) {
        setBody("");
        clearPending();
      }
      reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  return (
    <PanelShell title="Comments" onClose={onClose}>
      <div className="space-y-4 p-4">
        <div>
          {pendingAnchor && <p className="mb-1 text-xs text-[var(--color-brand)]">Pinned to the canvas · <button className="underline" onClick={clearPending}>unpin</button></p>}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Add a comment…" className={cx(inputClass, "h-auto py-2")} />
          <Button size="sm" className="mt-2" onClick={() => send()} disabled={!body.trim()}>Comment</Button>
          {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
        </div>
        {roots.length === 0 && <p className="text-sm text-[var(--fg-muted)]">No comments yet. Use the comment tool (C) to pin one on the canvas.</p>}
        {roots.map((c, i) => (
          <Thread key={c.id} n={i + 1} c={c} replies={comments.filter((r) => r.parentId === c.id)} focused={focusId === c.id} onReply={(t) => send(c.id, t)} reload={reload} />
        ))}
      </div>
    </PanelShell>
  );
}

function Thread({ n, c, replies, focused, onReply, reload }: { n: number; c: Comment; replies: Comment[]; focused: boolean; onReply: (t: string) => void; reload: () => void }) {
  const [reply, setReply] = useState("");
  return (
    <div className={cx("rounded-xl border p-3 text-sm", focused ? "border-[var(--color-brand)]" : "border-[var(--border)]", c.resolved && "opacity-60")}>
      {[c, ...replies].map((m) => (
        <div key={m.id} className="mb-2 flex gap-2">
          <Avatar name={m.authorName} color={m.avatarColor} size={22} />
          <div className="min-w-0">
            <div className="text-xs text-[var(--fg-muted)]">{m.authorName}{m === c && c.anchor ? ` · pin ${n}` : ""} · {new Date(m.createdAt).toLocaleString()}</div>
            <div className="whitespace-pre-wrap break-words">{m.body}</div>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply" className={cx(inputClass, "!h-8 text-xs")} onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) { onReply(reply); setReply(""); } }} />
        <button className="cursor-pointer text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]" onClick={async () => { await api.comments.update(c.id, { resolved: !c.resolved }); reload(); }}>{c.resolved ? "Reopen" : "Resolve"}</button>
        <button className="cursor-pointer text-xs text-red-500" onClick={async () => { await api.comments.remove(c.id); reload(); }}>Delete</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Versions */
export function VersionsPanel({ fileId, onClose, onRestored, canEdit }: { fileId: string; onClose: () => void; onRestored: () => void; canEdit: boolean }) {
  const [list, setList] = useState<VersionSummary[] | null>(null);
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = () => api.versions.list(fileId).then(setList).catch((e) => setErr(errMsg(e)));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);
  return (
    <PanelShell title="Version history" onClose={onClose}>
      <div className="space-y-3 p-4">
        {canEdit && (
          <div className="flex gap-2">
            <input className={inputClass} placeholder="Name this version" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button onClick={async () => { try { await api.versions.create(fileId, label || undefined); setLabel(""); await load(); } catch (e) { setErr(errMsg(e)); } }}>Save</Button>
          </div>
        )}
        {err && <p className="text-sm text-red-500">{err}</p>}
        {!list && <Spinner />}
        {list?.length === 0 && <p className="text-sm text-[var(--fg-muted)]">No versions yet.</p>}
        {list?.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{v.label || (v.auto ? "Auto-saved" : "Version")}</div>
              <div className="text-xs text-[var(--fg-muted)]">{v.authorName} · {new Date(v.createdAt).toLocaleString()}</div>
            </div>
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={async () => { if (!confirm("Restore this version? Current content is saved as a version first.")) return; try { await api.versions.restore(fileId, v.id); onRestored(); } catch (e) { setErr(errMsg(e)); } }}>Restore</Button>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

/* --------------------------------------------------------------- Share */
export function ShareDialog({ fileId, open, onClose }: { fileId: string; open: boolean; onClose: () => void }) {
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    if (open) api.share.get(fileId).then(setInfo).catch((e) => setErr(errMsg(e)));
  }, [open, fileId]);
  const link = info ? `${location.origin}/s/${info.token}` : "";
  const embed = info ? `<iframe src="${location.origin}/embed/${info.token}?theme=${theme}" width="100%" height="480" style="border:1px solid #ddd;border-radius:12px" loading="lazy"></iframe>` : "";
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setErr("Copy failed – select the text and copy it manually.");
    }
  };
  const set = async (a: LinkAccess) => {
    try {
      setInfo(await api.share.setLink(fileId, a));
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Share" width={520}>
      {!info ? (
        err ? <p className="text-sm text-red-500">{err}</p> : <Spinner />
      ) : (
        <div className="space-y-5 text-sm">
          <div>
            <div className="mb-2 font-medium">Anyone with the link can</div>
            <div className="flex gap-2">
              {(["none", "view", "edit"] as LinkAccess[]).map((a) => (
                <button key={a} onClick={() => set(a)} className={cx("cursor-pointer rounded-full border px-4 py-1.5 capitalize", info.linkAccess === a ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white" : "border-[var(--border)]")}>{a === "none" ? "Nothing" : a}</button>
              ))}
            </div>
          </div>
          {info.linkAccess !== "none" && (
            <>
              <div className="flex gap-2">
                <input readOnly value={link} className={inputClass} onFocus={(e) => e.target.select()} />
                <Button onClick={() => copy("link", link)}>{copied === "link" ? "Copied" : "Copy"}</Button>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between font-medium">Embed <select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")} className="rounded border border-[var(--border)] bg-transparent px-2 py-0.5 text-xs"><option value="light">light</option><option value="dark">dark</option></select></div>
                <textarea readOnly rows={3} value={embed} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => copy("embed", embed)}>{copied === "embed" ? "Copied" : "Copy embed code"}</Button>
              </div>
            </>
          )}
          <p className="text-xs text-[var(--fg-muted)]">easydraw has no sign-in, so access is controlled by this link only. Anyone who can reach the server can open every file in the workspace.</p>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      )}
    </Modal>
  );
}
