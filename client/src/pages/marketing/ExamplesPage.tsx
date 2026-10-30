import { useState } from "react";
import { Modal, cx } from "../../components/ui";
import DiagramView from "../../components/DiagramView";
import { DIAGRAM_TYPES, examples, type Example } from "../../lib/engine";
import { useOpenInEditor } from "../../lib/files";
import type { DiagramType } from "../../lib/types";
import { Badge, CodeBlock, CopyButton, CtaBand, PageHero, Section } from "../../components/marketing/parts";
import { Button } from "../../components/ui";

const label = (t: DiagramType) => DIAGRAM_TYPES.find((d) => d.id === t)?.label ?? t;

export default function ExamplesPage() {
  const [filter, setFilter] = useState<DiagramType | "all">("all");
  const [active, setActive] = useState<Example | null>(null);
  const openInEditor = useOpenInEditor();
  const list = examples.filter((e) => filter === "all" || e.diagramType === filter);
  return (
    <>
      <PageHero eyebrow="Examples" title="Start from something real." sub="Ready-made diagrams in all four types. Open one to see the code, copy it, or send it to the editor." />
      <Section>
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by diagram type">
          {[{ id: "all" as const, label: "All" }, ...DIAGRAM_TYPES].map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={cx("cursor-pointer rounded-full border px-3.5 py-1.5 text-sm", filter === t.id ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <button key={e.slug} type="button" onClick={() => setActive(e)} className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] text-left transition hover:border-[var(--fg-muted)]">
              <div className="ed-grid pointer-events-none h-48 overflow-hidden p-3">
                <DiagramView code={e.code} type={e.diagramType} maxHeight={168} className="w-full" />
              </div>
              <div className="border-t border-[var(--border)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight">{e.title}</h2>
                  <Badge>{label(e.diagramType)}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">{e.description}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>
      <Modal open={!!active} onClose={() => setActive(null)} title={active?.title} width={980}>
        {active && (
          <div className="space-y-4">
            <div className="ed-grid rounded-xl border border-[var(--border)] p-4">
              <DiagramView code={active.code} type={active.diagramType} className="w-full" />
            </div>
            <CodeBlock title={label(active.diagramType)} code={active.code} maxHeight={240} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void openInEditor({ title: active.title, diagramType: active.diagramType, code: active.code })}>Open in editor</Button>
              <CopyButton text={active.code} label="Copy code" className="h-10 px-4 text-sm" />
              <Button variant="ghost" onClick={() => setActive(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
      <CtaBand title="Make your own." />
    </>
  );
}
