import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, LinkButton, cx } from "../../components/ui";
import DiagramView from "../../components/DiagramView";
import { DIAGRAM_TYPES, samples } from "../../lib/engine";
import type { DiagramType } from "../../lib/types";
import { useOpenInEditor } from "../../lib/files";
import { CopyButton, CtaBand, FeatureCard, MockWindow, PageHero, Section, SectionHeading } from "../../components/marketing/parts";

const CHEAT = [
  ["Node", "Name [icon: server, color: blue]", "flow, architecture"],
  ["Connection", "A > B: label", "all"],
  ["Operators", ">  <  <>  -  --  -->", "arrow, back, both, line, dotted, dotted arrow"],
  ["Chain / branch", "A > B > C    A > B, C", "flow, architecture"],
  ["Group", "Backend { API, DB }", "flow, architecture"],
  ["Message", "Browser > API: POST /login", "sequence"],
  ["Block", "alt [label: ok] { ... } else { ... }", "sequence (loop, alt, opt, par, break)"],
  ["Entity", "users { id string pk }", "erd"],
  ["Relation", "posts.authorId > users.id", "erd (> < - <>)"],
  ["Settings", "title \"..\"  direction right  autoNumber on", "top of the file"],
];

export default function DiagramAsCodePage() {
  const [type, setType] = useState<DiagramType>("architecture");
  const [codes, setCodes] = useState<Record<DiagramType, string>>({ ...samples });
  const [busy, setBusy] = useState(false);
  const openInEditor = useOpenInEditor();
  const code = codes[type];
  const lines = code.split("\n").length;

  const open = async () => {
    setBusy(true);
    try {
      await openInEditor({ title: "Playground diagram", diagramType: type, code });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Diagram as code"
        title="Describe the structure. We draw the diagram."
        sub="A small, readable language for flow charts, cloud architecture, sequence diagrams and ERDs. Try it below, it renders as you type."
      />

      <Section className="!pt-10">
        <div role="tablist" aria-label="Diagram type" className="mb-4 flex flex-wrap gap-2">
          {DIAGRAM_TYPES.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={type === t.id}
              onClick={() => setType(t.id)}
              className={cx(
                "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium",
                type === t.id ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)] hover:text-[var(--fg)]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <MockWindow
          title="Playground"
          tabs={
            <>
              <button onClick={() => setCodes((c) => ({ ...c, [type]: samples[type] }))} className="cursor-pointer rounded-md px-2 py-0.5 text-[var(--fg-muted)] hover:bg-[var(--bg-elev)]">Reset</button>
              <CopyButton text={code} />
            </>
          }
        >
          <div className="grid lg:grid-cols-2">
            <div className="flex border-b border-[var(--border)] bg-[var(--bg-soft)] lg:border-b-0 lg:border-r">
              <div aria-hidden="true" className="mono select-none whitespace-pre py-4 pl-3 pr-2 text-right text-[12.5px] leading-[1.6] text-[var(--fg-muted)]/60">
                {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
              </div>
              <textarea
                aria-label="Diagram code"
                spellCheck={false}
                wrap="off"
                value={code}
                onChange={(e) => setCodes((c) => ({ ...c, [type]: e.target.value }))}
                className="mono h-[260px] w-full resize-none overflow-auto bg-transparent py-4 pr-4 text-[12.5px] leading-[1.6] outline-none lg:h-[480px]"
              />
            </div>
            <div className="ed-grid flex min-h-[260px] items-center justify-center overflow-auto p-4 lg:h-[480px]">
              <DiagramView code={code} type={type} showErrors className="w-full" />
            </div>
          </div>
        </MockWindow>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={open} disabled={busy}>{busy ? "Opening..." : "Open in editor"}</Button>
          <span className="text-sm text-[var(--fg-muted)]">Opens as a new file in your workspace.</span>
        </div>
      </Section>

      <Section soft>
        <SectionHeading center eyebrow="Why code" title="Diagrams your team can actually maintain." />
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="git" title="Diffable">A change to the system is a few changed lines, not a re-exported image.</FeatureCard>
          <FeatureCard icon="eye" title="Reviewable">Review diagrams in pull requests next to the code they describe.</FeatureCard>
          <FeatureCard icon="history" title="Version controlled">Keep .eraser files in git and render SVGs in CI, or use built-in version history.</FeatureCard>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Cheat sheet" title="The whole language on one page." />
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-[var(--bg-soft)] text-xs uppercase tracking-wider text-[var(--fg-muted)]">
              <tr><th className="px-4 py-3">Concept</th><th className="px-4 py-3">Example</th><th className="px-4 py-3">Used in</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {CHEAT.map(([a, b, c]) => (
                <tr key={a}>
                  <td className="px-4 py-3 font-medium">{a}</td>
                  <td className="mono px-4 py-3 text-[12.5px]">{b}</td>
                  <td className="px-4 py-3 text-[var(--fg-muted)]">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 text-sm text-[var(--fg-muted)]">
          Full reference: <Link className="underline" to="/docs/syntax-flowchart">flow chart</Link>, <Link className="underline" to="/docs/syntax-architecture">architecture</Link>, <Link className="underline" to="/docs/syntax-sequence">sequence</Link>, <Link className="underline" to="/docs/syntax-erd">ERD</Link>.
        </p>
        <div className="mt-6"><LinkButton to="/docs" variant="secondary">Read the docs</LinkButton></div>
      </Section>
      <CtaBand />
    </>
  );
}
