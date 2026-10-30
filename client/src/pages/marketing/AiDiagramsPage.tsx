import { LinkButton } from "../../components/ui";
import DiagramView from "../../components/DiagramView";
import { samples } from "../../lib/engine";
import { Badge, Check, CodeBlock, CtaBand, Faq, FeatureCard, MockWindow, PageHero, Section, SectionHeading, TwoCol } from "../../components/marketing/parts";

const FAQ = [
  { q: "Do I need an API key?", a: "No. Without one, easydraw uses an offline rule-based generator. It is deterministic and works with no network, but it understands fewer phrasings. Add ANTHROPIC_API_KEY on the server to switch to Claude." },
  { q: "Which model is used?", a: "Claude, through Anthropic's API, using your own key. The model can be changed with the ANTHROPIC_MODEL environment variable." },
  { q: "What happens if the AI writes invalid code?", a: "The server renders the reply with the same engine you use in the editor. If it finds errors it asks the model to fix them once, and returns the best result with a note." },
  { q: "Are there limits?", a: "Built-in rate limits are 20 AI requests per hour for anonymous visitors and 120 per hour for signed-in users, per server." },
  { q: "Does file to diagram use AI?", a: "No. SQL, Terraform and docker-compose files are parsed deterministically, so the same input always gives the same diagram." },
];

const PROMPT = "A checkout service takes an order, charges Stripe, then writes to Postgres and publishes an event to a queue.";
const REFINED = `title "Checkout"
direction right

Client [icon: browser]
"Checkout API" [icon: server]
Stripe [icon: stripe]
Postgres [icon: database, shape: cylinder]
Queue [icon: queue]

Client > "Checkout API": place order
"Checkout API" > Stripe: charge
"Checkout API" > Postgres: save order
"Checkout API" > Queue: order.created
`;

export default function AiDiagramsPage() {
  return (
    <>
      <PageHero
        eyebrow="AI diagrams"
        title="Describe it. Get a diagram you can keep editing."
        sub="AI drafts the structure as plain diagram code, so the result is never a dead-end image. Tweak it, refine it by chat, or take it to the canvas."
      >
        <LinkButton to="/diagramgpt" size="lg">Try DiagramGPT</LinkButton>
        <LinkButton to="/app" variant="secondary" size="lg">Start free</LinkButton>
      </PageHero>

      <Section>
        <TwoCol
          text={
            <>
              <SectionHeading eyebrow="Prompt to diagram" title="Say what the system does." sub="Name the parts and how they talk. The generator picks a diagram type for you (or you choose one) and returns valid code with automatic layout." />
              <ul className="space-y-2.5">
                <Check>Flow charts, architecture, sequence and ERD</Check>
                <Check>Output is the same code you write by hand</Check>
                <Check>Works signed out, with rate limits</Check>
              </ul>
            </>
          }
          visual={
            <MockWindow title="DiagramGPT">
              <div className="grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="space-y-3 border-b border-[var(--border)] p-4 sm:border-b-0 sm:border-r">
                  <p className="rounded-2xl rounded-br-md bg-[var(--fg)] px-3.5 py-2 text-sm text-[var(--bg)]">{PROMPT}</p>
                  <p className="rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-2 text-sm">Here is the architecture. Ask me to change anything.</p>
                  <p className="rounded-2xl rounded-br-md bg-[var(--fg)] px-3.5 py-2 text-sm text-[var(--bg)]">Add a retry from the queue.</p>
                </div>
                <div className="ed-grid flex items-center p-4">
                  <DiagramView code={REFINED} type="architecture" className="w-full" />
                </div>
              </div>
            </MockWindow>
          }
        />
      </Section>

      <Section soft>
        <SectionHeading center eyebrow="Refine" title="Keep the conversation going." sub="Ask for changes in plain language. With an existing diagram, the assistant edits the code instead of starting over." />
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <CodeBlock title="Your instruction: connect Client to Queue" code={`Client > "Checkout API": place order\n+ "Checkout API" > Queue: order.created`} />
          <div className="ed-grid rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            <DiagramView code={samples.flowchart} type="flowchart" maxHeight={260} className="w-full" />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading center eyebrow="More ways in" title="Start from what you already have." />
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="github" title="GitHub repo to diagram">Paste a public repository URL and get an architecture overview built from its folder structure and key files.</FeatureCard>
          <FeatureCard icon="upload" title="File to diagram" badge={<Badge tone="green">No AI</Badge>}>Import SQL schemas, Terraform or docker-compose files and get an ERD or architecture diagram, deterministically.</FeatureCard>
          <FeatureCard icon="doc" title="AI doc outline">Turn a one-line idea into a technical design doc skeleton: overview, goals, design, alternatives, risks.</FeatureCard>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton to="/ai/git-diagrammer" variant="secondary">Git diagrammer</LinkButton>
          <LinkButton to="/ai/file-to-diagram" variant="secondary">File to diagram</LinkButton>
        </div>
      </Section>

      <Section soft>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Two modes, no surprises</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <Badge tone="brand">With Claude</Badge>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">Set <code className="mono rounded bg-[var(--bg-soft)] px-1">ANTHROPIC_API_KEY</code> on the server. Prompts are understood in depth and results are validated and repaired. Bring your own Anthropic key to power AI generation.</p>
            </div>
            <div>
              <Badge>Offline</Badge>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">No key? A built-in rule-based generator extracts steps, actors and tables from your prompt. Simpler, fully local, always valid.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading center title="AI questions" />
        <div className="mx-auto max-w-3xl"><Faq items={FAQ} /></div>
      </Section>
      <CtaBand title="Draft faster, then make it yours." />
    </>
  );
}
