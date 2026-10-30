import { Link } from "react-router-dom";
import { Container, LinkButton } from "../../components/ui";
import DiagramView from "../../components/DiagramView";
import { DIAGRAM_TYPES, samples } from "../../lib/engine";
import { Check, CodeBlock, CtaBand, Faq, FeatureCard, MockWindow, Section, SectionHeading, TwoCol } from "../../components/marketing/parts";
import { Icon } from "../../components/marketing/Icon";

const FAQ = [
  { q: "Is easydraw free?", a: "Yes. It is open source and self-hosted, so there are no seats, file limits or paywalled features. You run it on your own machine or server (Bun and SQLite). A hosted plan is only planned." },
  { q: "Where does the AI come from?", a: "If the server has an ANTHROPIC_API_KEY, generation runs on Claude. Without a key, an offline rule-based generator produces simpler but valid diagrams. Bring your own Anthropic key to power AI generation." },
  { q: "Can I edit what the AI makes?", a: "Always. The result is plain diagram code, so you can change it by hand, keep chatting to refine it, or drop it onto the canvas and move things around." },
  { q: "Is my data used for training?", a: "easydraw does not train anything. Your files live in a SQLite database on your server. If you enable Claude, prompts and the diagram being edited are sent to Anthropic's API under your own key." },
  { q: "Can my team use it together?", a: "Yes. Workspaces have roles (owner, admin, member, guest), invites, realtime cursors, comments and version history." },
  { q: "How do I get diagrams into other tools?", a: "Export PNG, SVG, JSON or Markdown, embed a stable SVG URL in a README, Notion or Confluence page, use the iframe embed, or call the REST API." },
];

const DEV_SNIPPET = `curl -X POST https://your-host/api/v1/diagrams \\
  -H "Authorization: Bearer ek_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text":"users, posts and comments","diagramType":"erd"}'

# then embed the result anywhere
![Schema](https://your-host/api/v1/diagrams/<id>.svg)`;

export default function ProductPage() {
  return (
    <>
      <div className="ed-grid border-b border-[var(--border)]">
        <div className="bg-gradient-to-b from-[var(--bg)]/0 to-[var(--bg)]">
          <Container className="pb-16 pt-16 text-center sm:pt-24">
            <h1 className="ed-fade-up mx-auto max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.04] lg:text-7xl">
              Diagrams and docs that live together.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">
              Write a design doc, sketch on an infinite canvas, and describe diagrams as code. easydraw keeps all of it in one workspace you own.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <LinkButton to="/app" size="lg">Start free</LinkButton>
              <LinkButton to="/diagramgpt" variant="secondary" size="lg">Try DiagramGPT</LinkButton>
            </div>
            <MockWindow title="Web application on AWS - easydraw" className="mx-auto mt-14 max-w-5xl text-left" tabs={<><span className="rounded-md bg-[var(--bg-elev)] px-2 py-0.5">Split</span></>}>
              <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <pre className="mono hidden max-h-[380px] overflow-hidden border-r border-[var(--border)] bg-[var(--bg-soft)] p-4 text-[12px] leading-relaxed text-[var(--fg-muted)] md:block">{samples.architecture}</pre>
                <div className="ed-grid flex items-center justify-center p-4">
                  <DiagramView code={samples.architecture} type="architecture" maxHeight={380} className="w-full" />
                </div>
              </div>
            </MockWindow>
          </Container>
        </div>
      </div>

      <Section>
        <SectionHeading center eyebrow="One workspace" title="Create, edit, document." sub="Everything you need to explain a system, without juggling five tools." />
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="code" title="Create from code or a prompt">Type a few lines in a small, readable language, or describe the system and let AI draft it. Layout is automatic.</FeatureCard>
          <FeatureCard icon="canvas" title="Edit on an infinite canvas">Pan and zoom, add sticky notes, shapes, arrows, text, images, or sketch with the pen. Diagrams stay editable as code.</FeatureCard>
          <FeatureCard icon="doc" title="Document in Markdown">Write with live preview and embed diagrams inline. Switch between doc, canvas and split views any time.</FeatureCard>
        </div>
      </Section>

      <Section soft>
        <SectionHeading center eyebrow="Four diagram types" title="One language, every diagram you need." sub="The same syntax drives all four. Pick a type, write the structure, and easydraw lays it out." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIAGRAM_TYPES.map((t) => (
            <Link key={t.id} to="/product/diagram-as-code" className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] transition hover:shadow-lg">
              <div className="ed-grid pointer-events-none flex h-44 items-center justify-center overflow-hidden p-3">
                <DiagramView code={samples[t.id]} type={t.id} maxHeight={160} className="w-full" />
              </div>
              <div className="border-t border-[var(--border)] p-4">
                <h3 className="text-sm font-semibold">{t.label}</h3>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{t.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <TwoCol
          text={
            <>
              <SectionHeading eyebrow="AI" title="From a sentence to a diagram." sub="Describe a flow, a schema or a cloud setup and get an editable diagram back. Point it at a public GitHub repo for an architecture overview, or drop in SQL, Terraform or docker-compose files." />
              <ul className="mb-6 space-y-2.5">
                <Check>Refine by chatting: "add a cache between API and DB"</Check>
                <Check>Generate a design doc outline for the diagram</Check>
                <Check>File import is deterministic and needs no AI</Check>
              </ul>
              <LinkButton to="/product/ai-diagrams" variant="secondary">Explore AI diagrams</LinkButton>
            </>
          }
          visual={
            <MockWindow title="DiagramGPT">
              <div className="space-y-3 p-4">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--fg)] px-3.5 py-2 text-sm text-[var(--bg)]">Sequence for a login with a password check</p>
                <div className="ed-grid rounded-xl border border-[var(--border)] p-3">
                  <DiagramView code={samples.sequence} type="sequence" maxHeight={260} className="w-full" />
                </div>
              </div>
            </MockWindow>
          }
        />
      </Section>

      <Section soft>
        <SectionHeading center eyebrow="Collaboration" title="Built for working together." sub="Realtime and asynchronous, with the controls a team expects." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon="users" title="Live multiplayer">See cursors and edits from teammates as they happen.</FeatureCard>
          <FeatureCard icon="chat" title="Comments">Threads you can resolve, right next to the work.</FeatureCard>
          <FeatureCard icon="history" title="Version history">Automatic snapshots with one-click restore.</FeatureCard>
          <FeatureCard icon="share" title="Sharing">Public view or edit links, invites by email, private files.</FeatureCard>
        </div>
      </Section>

      <Section>
        <TwoCol
          reverse
          text={
            <>
              <SectionHeading eyebrow="For developers" title="Diagrams that fit your workflow." sub="A REST API with tokens, stable SVG URLs for READMEs, an MCP server for AI agents, and a CLI with a ready-made GitHub Actions workflow." />
              <div className="flex flex-wrap gap-3">
                <LinkButton to="/product/api">Diagramming API</LinkButton>
                <LinkButton to="/product/integrations" variant="secondary">Integrations</LinkButton>
              </div>
            </>
          }
          visual={<CodeBlock title="shell" code={DEV_SNIPPET} />}
        />
      </Section>

      <Section soft>
        <SectionHeading center title="Questions, answered honestly" />
        <div className="mx-auto max-w-3xl"><Faq items={FAQ} /></div>
        <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
          More in the <Link className="underline" to="/docs">documentation</Link> <Icon name="arrow" size={14} className="inline" />
        </p>
      </Section>

      <CtaBand title="Your next diagram starts here." sub="Open a blank workspace, paste a few lines of code, and watch the diagram draw itself." />
    </>
  );
}
