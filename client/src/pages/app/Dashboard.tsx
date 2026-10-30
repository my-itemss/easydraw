import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { contentWithDiagram, emptyContent } from "../../lib/files";
import { importFile } from "../../lib/importFile";
import { DIAGRAM_TYPES, examples } from "../../lib/engine";
import type { FileSummary, Folder, Usage } from "../../lib/types";
import DiagramView from "../../components/DiagramView";
import { Button, Modal, Spinner, cx } from "../../components/ui";
import { Menu, MenuItem, MenuSep } from "../../components/app/Menu";
import TextPrompt from "../../components/app/TextPrompt";

type Filter = "all" | "recent" | "shared" | "mine" | "trash";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All files" },
  { id: "recent", label: "Recent" },
  { id: "mine", label: "Created by me" },
  { id: "shared", label: "Shared with me" },
  { id: "trash", label: "Trash" },
];

function ago(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(ts).toLocaleDateString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [files, setFiles] = useState<FileSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState(false);
  const [rename, setRename] = useState<FileSummary | null>(null);
  const [folderPrompt, setFolderPrompt] = useState<{ mode: "new" | "rename"; folder?: Folder } | null>(null);
  const [move, setMove] = useState<FileSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Files · easydraw";
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const f = await api.files.list({ filter, q: dq || undefined, folderId: filter === "all" && !dq ? (folderId ?? "root") : undefined });
      setFiles(f);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setFiles([]);
    }
  }, [filter, dq, folderId]);
  const loadSide = useCallback(async () => {
    try {
      const [fo, u] = await Promise.all([api.folders.list(), api.usage()]);
      setFolders(fo);
      setUsage(u);
    } catch {
      /* shown by the main load */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadSide();
  }, [loadSide]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };
  const guard = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Something went wrong");
    }
  };

  const createBlank = () =>
    guard(async () => {
      const f = await api.files.create({ title: "Untitled", folderId: filter === "all" ? folderId : null, content: emptyContent("Untitled") });
      navigate(`/app/f/${f.id}`);
    });
  const createFromTemplate = (i: number) =>
    guard(async () => {
      const ex = examples[i]!;
      const f = await api.files.create({ title: ex.title, folderId: filter === "all" ? folderId : null, content: contentWithDiagram(ex.diagramType, ex.code, ex.title) });
      navigate(`/app/f/${f.id}`);
    });
  const onImport = (file: File | undefined) => {
    if (!file) return;
    void guard(async () => {
      const r = await importFile(file);
      const f = await api.files.create({ title: r.title, folderId: filter === "all" ? folderId : null, content: r.content });
      navigate(`/app/f/${f.id}`);
    });
  };

  const tree = useMemo(() => {
    const out: { f: Folder; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const f of folders.filter((x) => x.parentId === parent).sort((a, b) => a.name.localeCompare(b.name))) {
        out.push({ f, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [folders]);

  const title = filter === "all" ? (folderId ? (folders.find((f) => f.id === folderId)?.name ?? "Folder") : "All files") : FILTERS.find((f) => f.id === filter)?.label;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-8 px-5 py-8">
      <aside className="hidden w-56 shrink-0 md:block">
        <Menu
          align="left"
          label="New file"
          className="mb-6 block"
          trigger={
            <span className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--fg)] px-5 text-sm font-medium text-[var(--bg)]">
              <span aria-hidden>+</span> New file
            </span>
          }
        >
          {(close) => (
            <>
              <MenuItem onClick={() => (close(), void createBlank())}>Blank file</MenuItem>
              <MenuItem onClick={() => (close(), setTemplates(true))}>From template…</MenuItem>
              <MenuSep />
              <MenuItem onClick={() => (close(), fileInput.current?.click())}>Import…</MenuItem>
            </>
          )}
        </Menu>
        <nav className="space-y-0.5 text-sm" aria-label="File filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setFolderId(null);
              }}
              className={cx("block w-full cursor-pointer rounded-lg px-3 py-2 text-left", filter === f.id && !folderId ? "bg-[var(--bg-soft)] font-medium" : "text-[var(--fg-muted)] hover:bg-[var(--bg-soft)]")}
            >
              {f.label}
            </button>
          ))}
        </nav>
        <div className="mt-6 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          Folders
          <button className="cursor-pointer text-base leading-none hover:text-[var(--fg)]" aria-label="New folder" onClick={() => setFolderPrompt({ mode: "new" })}>
            +
          </button>
        </div>
        <ul className="mt-2 space-y-0.5 text-sm">
          {tree.length === 0 && <li className="px-3 py-1 text-xs text-[var(--fg-muted)]">No folders yet</li>}
          {tree.map(({ f, depth }) => (
            <li key={f.id} className="group flex items-center" style={{ paddingLeft: depth * 12 }}>
              <button
                onClick={() => {
                  setFilter("all");
                  setFolderId(f.id);
                }}
                className={cx("flex-1 cursor-pointer truncate rounded-lg px-3 py-1.5 text-left", folderId === f.id && filter === "all" ? "bg-[var(--bg-soft)] font-medium" : "text-[var(--fg-muted)] hover:bg-[var(--bg-soft)]")}
              >
                {f.name}
              </button>
              <Menu label={`Folder ${f.name} actions`} trigger={<span className="px-1.5 text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100">⋯</span>}>
                {(close) => (
                  <>
                    <MenuItem onClick={() => (close(), setFolderPrompt({ mode: "rename", folder: f }))}>Rename</MenuItem>
                    <MenuItem
                      danger
                      onClick={() => {
                        close();
                        void guard(async () => {
                          await api.folders.remove(f.id);
                          if (folderId === f.id) setFolderId(null);
                          await Promise.all([load(), loadSide()]);
                        });
                      }}
                    >
                      Delete folder
                    </MenuItem>
                  </>
                )}
              </Menu>
            </li>
          ))}
        </ul>
        {usage && (
          <div className="mt-8 rounded-xl border border-[var(--border)] p-3 text-xs text-[var(--fg-muted)]">
            <div>{usage.files} files</div>
            <div>{usage.aiRequestsThisMonth} AI requests this month</div>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              className="h-10 w-56 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-4 text-sm outline-none focus:border-[var(--color-brand)]"
            />
            <Button className="md:hidden" onClick={() => void createBlank()}>
              New
            </Button>
          </div>
        </div>
        <input ref={fileInput} type="file" hidden accept=".json,.md,.markdown,.txt,.sql,.tf,.yml,.yaml" onChange={(e) => (onImport(e.target.files?.[0]), (e.target.value = ""))} />

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500" role="alert">
            {error}
          </div>
        )}
        {files === null ? (
          <div className="flex justify-center py-20 text-[var(--fg-muted)]">
            <Spinner size={24} />
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-14 text-center">
            <div className="text-lg font-medium">{filter === "trash" ? "Trash is empty" : dq ? "No files match your search" : "No files here yet"}</div>
            {filter !== "trash" && !dq && (
              <>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">Start from a blank file or pick a template.</p>
                <div className="mt-5 flex justify-center gap-2">
                  <Button onClick={() => void createBlank()}>Blank file</Button>
                  <Button variant="secondary" onClick={() => setTemplates(true)}>
                    Templates
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
            {files.map((f) => (
              <li key={f.id} className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] transition hover:border-[var(--color-brand)]">
                <button
                  className="block h-40 w-full cursor-pointer overflow-hidden bg-[var(--bg-soft)] ed-grid p-3 text-left"
                  onClick={() => (f.trashed ? flash("Restore the file to open it") : navigate(`/app/f/${f.id}`))}
                  aria-label={`Open ${f.title}`}
                >
                  {f.preview ? (
                    <DiagramView code={f.preview.code} type={f.preview.diagramType} className="pointer-events-none flex h-full items-center justify-center [&_svg]:max-h-[136px]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--fg-muted)]">Empty canvas</div>
                  )}
                </button>
                <div className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {f.private && <span title="Private">🔒 </span>}
                      {f.title}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--fg-muted)]">
                      {f.ownerName} · {ago(f.updatedAt)}
                    </div>
                  </div>
                  <Menu label={`${f.title} actions`} trigger={<span className="rounded-md px-2 py-1 text-[var(--fg-muted)] hover:bg-[var(--bg-soft)]">⋯</span>}>
                    {(close) =>
                      f.trashed ? (
                        <>
                          <MenuItem onClick={() => (close(), void guard(async () => (await api.files.update(f.id, { trashed: false }), load())))}>Restore</MenuItem>
                          <MenuItem danger onClick={() => (close(), confirm(`Delete "${f.title}" forever?`) && void guard(async () => (await api.files.remove(f.id), load())))}>
                            Delete forever
                          </MenuItem>
                        </>
                      ) : (
                        <>
                          <MenuItem onClick={() => (close(), navigate(`/app/f/${f.id}`))}>Open</MenuItem>
                          <MenuItem disabled={f.access === "view"} onClick={() => (close(), setRename(f))}>
                            Rename
                          </MenuItem>
                          <MenuItem onClick={() => (close(), void guard(async () => (await api.files.duplicate(f.id), load(), flash("Duplicated"))))}>Duplicate</MenuItem>
                          <MenuItem disabled={f.access !== "owner"} onClick={() => (close(), setMove(f))}>
                            Move to folder…
                          </MenuItem>
                          <MenuItem disabled={f.access !== "owner"} onClick={() => (close(), void guard(async () => (await api.files.update(f.id, { private: !f.private }), load())))}>
                            {f.private ? "Make visible to workspace" : "Make private"}
                          </MenuItem>
                          <MenuSep />
                          <MenuItem danger disabled={f.access !== "owner"} onClick={() => (close(), void guard(async () => (await api.files.update(f.id, { trashed: true }), load(), loadSide())))}>
                            Move to trash
                          </MenuItem>
                        </>
                      )
                    }
                  </Menu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Modal open={templates} onClose={() => setTemplates(false)} title="Start from a template" width={860}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {examples.map((ex, i) => (
            <button key={ex.slug} onClick={() => (setTemplates(false), void createFromTemplate(i))} className="cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] text-left hover:border-[var(--color-brand)]">
              <div className="ed-grid h-28 overflow-hidden bg-[var(--bg-soft)] p-2">
                <DiagramView code={ex.code} type={ex.diagramType} className="pointer-events-none flex h-full items-center justify-center [&_svg]:max-h-[104px]" />
              </div>
              <div className="p-3">
                <div className="text-sm font-medium">{ex.title}</div>
                <div className="text-xs text-[var(--fg-muted)]">{DIAGRAM_TYPES.find((t) => t.id === ex.diagramType)?.label}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      <TextPrompt
        open={!!rename}
        title="Rename file"
        label="Title"
        initial={rename?.title}
        onClose={() => setRename(null)}
        onSubmit={(v) => guard(async () => (await api.files.update(rename!.id, { title: v }), load()))}
      />
      <TextPrompt
        open={!!folderPrompt}
        title={folderPrompt?.mode === "new" ? "New folder" : "Rename folder"}
        label="Folder name"
        initial={folderPrompt?.folder?.name}
        confirm={folderPrompt?.mode === "new" ? "Create" : "Save"}
        onClose={() => setFolderPrompt(null)}
        onSubmit={(v) =>
          guard(async () => {
            if (folderPrompt?.mode === "new") await api.folders.create({ name: v, parentId: filter === "all" ? folderId : null });
            else if (folderPrompt?.folder) await api.folders.update(folderPrompt.folder.id, { name: v });
            await loadSide();
          })
        }
      />
      <Modal open={!!move} onClose={() => setMove(null)} title="Move to folder" width={380}>
        <div className="space-y-1">
          {[{ f: null as Folder | null, depth: 0 }, ...tree.map((t) => ({ f: t.f as Folder | null, depth: t.depth + 1 }))].map(({ f, depth }) => (
            <button
              key={f?.id ?? "root"}
              style={{ paddingLeft: 12 + depth * 14 }}
              className="block w-full cursor-pointer rounded-lg py-2 pr-3 text-left text-sm hover:bg-[var(--bg-soft)]"
              onClick={() => guard(async () => (await api.files.update(move!.id, { folderId: f?.id ?? null }), setMove(null), load()))}
            >
              {f ? f.name : "No folder (top level)"}
            </button>
          ))}
        </div>
      </Modal>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-[var(--fg)] px-5 py-2.5 text-sm text-[var(--bg)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
