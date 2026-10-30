import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Container, cx } from "../ui";

export interface ToolInfo {
  path: string;
  title: string;
  desc: string;
}

export const TOOLS: ToolInfo[] = [
  { path: "/diagramgpt", title: "DiagramGPT", desc: "Describe anything and get the right diagram type." },
  { path: "/ai/flowchart-generator", title: "Flowchart generator", desc: "Turn a process or decision flow into a flowchart." },
  { path: "/ai/sequence-diagram-generator", title: "Sequence diagram generator", desc: "Show who calls whom, and in what order." },
  { path: "/ai/erd-generator", title: "ERD generator", desc: "Sketch tables, keys and relationships." },
  { path: "/ai/architecture-diagram-generator", title: "Architecture diagram generator", desc: "Map services, data stores and infrastructure." },
  { path: "/ai/git-diagrammer", title: "Git diagrammer", desc: "Paste a public GitHub repo URL, get a structure diagram." },
  { path: "/ai/file-to-diagram", title: "File to diagram", desc: "Convert SQL, Terraform or docker-compose in your browser." },
];

export function ToolHero({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
      <Container className="py-12 text-center sm:py-16">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">{eyebrow}</p>
        <h1 className="mx-auto max-w-3xl text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">{sub}</p>
      </Container>
    </section>
  );
}

export function ToolFaq({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`tool-faq-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium"
              >
                {it.q}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={cx("shrink-0 text-[var(--fg-muted)] transition-transform", isOpen && "rotate-180")}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </h3>
            {isOpen && (
              <div id={`tool-faq-${i}`} className="px-5 pb-5 text-sm leading-relaxed text-[var(--fg-muted)]">
                {it.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ToolsGrid({ exclude }: { exclude?: string }) {
  const tools = TOOLS.filter((t) => t.path !== exclude);
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((t) => (
        <li key={t.path}>
          <Link
            to={t.path}
            className="block h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 transition hover:border-[var(--color-brand)] hover:shadow-sm"
          >
            <span className="text-[15px] font-semibold tracking-tight">{t.title}</span>
            <span className="mt-1 block text-sm leading-relaxed text-[var(--fg-muted)]">{t.desc}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ToolSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mt-14 sm:mt-20", className)}>
      <h2 className="mb-5 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

export const COMMON_FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Is it free? Do I need an account?",
    a: "Yes, and no. You can generate, edit, copy and download diagrams without signing in. Anonymous visitors are limited to 20 AI requests per hour. Create a free account to save diagrams and keep editing them on the canvas.",
  },
  {
    q: "Does it use AI?",
    a: "If the server has an Anthropic API key configured, requests go to Claude. Without one it falls back to an offline rule-based generator that always returns valid diagram code but understands fewer phrasings. A badge above the result tells you which one ran.",
  },
  {
    q: "What do I get back?",
    a: "Plain diagram code, not an image. You can edit it by hand, ask for changes with the refine box, export SVG or PNG, or open it in the easydraw editor.",
  },
];
