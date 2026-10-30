import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Container, cx } from "../../components/ui";
import { DOCS, DOC_GROUPS } from "../../lib/docsContent";
import { renderMarkdown } from "../../lib/markdown";
import { useTheme } from "../../lib/theme";
import NotFoundPage from "./NotFoundPage";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function withIds(html: string): { html: string; toc: { id: string; text: string; level: number }[] } {
  const toc: { id: string; text: string; level: number }[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "");
    let id = slugify(text) || "section";
    while (used.has(id)) id += "-2";
    used.add(id);
    toc.push({ id, text, level: Number(lvl) });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  return { html: out, toc };
}

function Sidebar({ current, onNavigate }: { current?: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Documentation" className="space-y-6 text-sm">
      <Link to="/docs" onClick={onNavigate} className={cx("block font-medium", !current ? "text-[var(--color-brand)]" : "text-[var(--fg)]")}>
        Overview
      </Link>
      {DOC_GROUPS.map((g) => (
        <div key={g}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{g}</div>
          <ul className="space-y-0.5">
            {DOCS.filter((d) => d.group === g).map((d) => (
              <li key={d.slug}>
                <Link
                  to={`/docs/${d.slug}`}
                  onClick={onNavigate}
                  className={cx(
                    "block rounded-lg px-3 py-1.5",
                    current === d.slug ? "bg-[var(--bg-soft)] font-medium text-[var(--fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]",
                  )}
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Landing() {
  useEffect(() => {
    document.title = "Docs · easydraw";
  }, []);
  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-3 max-w-xl text-[var(--fg-muted)]">Learn the diagram language, the workspace, and the API. Everything here describes what easydraw does today.</p>
      <div className="mt-10 space-y-10">
        {DOC_GROUPS.map((g) => (
          <section key={g}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{g}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {DOCS.filter((d) => d.group === g).map((d) => (
                <Link key={d.slug} to={`/docs/${d.slug}`} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 transition hover:border-[var(--color-brand)]">
                  <div className="font-medium">{d.title}</div>
                  <div className="mt-1 text-sm text-[var(--fg-muted)]">{d.summary}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function DocsPage() {
  const { slug } = useParams();
  const { theme } = useTheme();
  const [drawer, setDrawer] = useState(false);
  const idx = DOCS.findIndex((d) => d.slug === slug);
  const doc = idx >= 0 ? DOCS[idx] : undefined;

  const rendered = useMemo(() => {
    if (!doc) return null;
    return withIds(renderMarkdown(doc.body, { theme, showSource: false }));
  }, [doc, theme]);

  useEffect(() => {
    if (doc) document.title = `${doc.title} · easydraw docs`;
    window.scrollTo({ top: 0 });
  }, [doc]);

  if (slug && !doc) return <NotFoundPage />;
  const prev = idx > 0 ? DOCS[idx - 1] : undefined;
  const next = idx >= 0 && idx < DOCS.length - 1 ? DOCS[idx + 1] : undefined;

  return (
    <Container className="py-10">
      <button
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm lg:hidden"
        onClick={() => setDrawer(true)}
        aria-label="Open documentation menu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        Docs menu
      </button>
      {drawer && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-auto bg-[var(--bg)] p-6 shadow-xl">
            <Sidebar current={slug} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
        <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] self-start overflow-auto lg:block">
          <Sidebar current={slug} />
        </aside>
        {!doc || !rendered ? (
          <Landing />
        ) : (
          <>
            <article className="md min-w-0 max-w-3xl">
              <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
              <div className="mt-14 grid gap-3 border-t border-[var(--border)] pt-6 sm:grid-cols-2">
                {prev ? (
                  <Link to={`/docs/${prev.slug}`} className="rounded-xl border border-[var(--border)] p-4 no-underline hover:border-[var(--color-brand)]">
                    <div className="text-xs text-[var(--fg-muted)]">Previous</div>
                    <div className="font-medium text-[var(--fg)]">{prev.title}</div>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link to={`/docs/${next.slug}`} className="rounded-xl border border-[var(--border)] p-4 text-right no-underline hover:border-[var(--color-brand)]">
                    <div className="text-xs text-[var(--fg-muted)]">Next</div>
                    <div className="font-medium text-[var(--fg)]">{next.title}</div>
                  </Link>
                )}
              </div>
            </article>
            <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] self-start overflow-auto text-sm xl:block">
              {rendered.toc.length > 0 && (
                <>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">On this page</div>
                  <ul className="space-y-1.5">
                    {rendered.toc.map((t) => (
                      <li key={t.id} className={t.level === 3 ? "pl-3" : ""}>
                        <a href={`#${t.id}`} className="text-[var(--fg-muted)] hover:text-[var(--fg)]">
                          {t.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          </>
        )}
      </div>
    </Container>
  );
}
