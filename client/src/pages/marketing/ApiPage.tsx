import { Link } from "react-router-dom";
import { LinkButton } from "../../components/ui";
import { Badge, CodeBlock, CtaBand, Faq, FeatureCard, PageHero, Section, SectionHeading } from "../../components/marketing/parts";

const GEN = `curl -X POST https://YOUR-SERVER/api/v1/diagrams \\
  -H "Authorization: Bearer ek_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "A user logs in, the API checks the database, then returns a token",
    "diagramType": "sequence"
  }'
# -> { "id": "...", "code": "...", "svg": "<svg ...>", "fileUrl": ".../api/v1/diagrams/<id>.svg" }`;

const RENDER = `curl -X POST https://YOUR-SERVER/api/v1/render \\
  -H "Authorization: Bearer ek_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{ "code": "A > B > C", "diagramType": "flowchart", "theme": "dark" }'
# -> { "svg": "...", "width": 420, "height": 96, "diagnostics": [] }`;

const EXPORT = `curl -H "Authorization: Bearer ek_your_token" \\
  "https://YOUR-SERVER/api/v1/files/FILE_ID/export?format=svg&theme=light" \\
  -o diagram.svg

# format=json | md | svg   (svg also accepts figure=<elementId>)`;

const EMBED = `<img src="https://YOUR-SERVER/api/v1/diagrams/DIAGRAM_ID.svg" alt="Architecture" />

![Architecture](https://YOUR-SERVER/api/shared/SHARE_TOKEN/figure/ELEMENT_ID.svg)`;

const ENDPOINTS: [string, string, string][] = [
  ["POST", "/api/v1/diagrams", "Create a diagram from a prompt (text) or code. Returns id, code, svg and a stable file URL."],
  ["GET", "/api/v1/diagrams/:id", "Fetch a stored diagram."],
  ["PUT", "/api/v1/diagrams/:id", "Update the code (creator only)."],
  ["GET", "/api/v1/diagrams/:id.svg", "Public SVG, CORS enabled. Accepts theme and background."],
  ["POST", "/api/v1/render", "Stateless render of code to SVG, with diagnostics."],
  ["GET", "/api/v1/files", "List files in your active workspace."],
  ["GET", "/api/v1/files/:id/export", "Export JSON, Markdown or SVG."],
  ["GET", "/api/v1/usage", "Your usage counters."],
];

const FAQ = [
  { q: "How do I get a token?", a: <>Open <Link className="underline" to="/app/settings">Settings</Link> and create an API token. It starts with <code className="mono">ek_</code> and is shown once, so copy it right away. Revoke it any time from the same page.</> },
  { q: "What are the rate limits?", a: "AI generation is limited to 20 requests per hour for anonymous callers and 120 per hour for authenticated users. Rendering code to SVG does not call a model." },
  { q: "Is there a hosted API?", a: "easydraw is self-hosted. You run the server yourself, so the API lives at your own URL. There is no hosted service today." },
];

export default function ApiPage() {
  return (
    <>
      <PageHero
        eyebrow="Diagramming API"
        title="Diagrams over REST."
        sub="Generate, render and export diagrams from any language. Every diagram gets a stable SVG URL you can drop into a README or a wiki page."
      >
        <LinkButton to="/docs/api" size="lg">Read the API docs</LinkButton>
        <LinkButton to="/app/settings" variant="secondary" size="lg">Get a token</LinkButton>
      </PageHero>

      <Section>
        <SectionHeading eyebrow="Quick examples" title="Three calls cover most of it." />
        <div className="grid gap-6 lg:grid-cols-2">
          <CodeBlock title="Diagram from a prompt" code={GEN} />
          <CodeBlock title="Render code to SVG" code={RENDER} />
          <CodeBlock title="Export a file" code={EXPORT} className="lg:col-span-2" />
        </div>
      </Section>

      <Section soft>
        <SectionHeading eyebrow="Reference" title="Endpoints" sub="All under /api/v1 and authenticated with a Bearer token, except the public SVG route." />
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-xs uppercase tracking-wider text-[var(--fg-muted)]">
              <tr><th className="px-4 py-3">Method</th><th className="px-4 py-3">Path</th><th className="px-4 py-3">What it does</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {ENDPOINTS.map(([m, p, d]) => (
                <tr key={m + p}>
                  <td className="px-4 py-3"><Badge tone={m === "GET" ? "green" : "brand"}>{m}</Badge></td>
                  <td className="mono px-4 py-3 text-[13px]">{p}</td>
                  <td className="px-4 py-3 text-[var(--fg-muted)]">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="The SVG URL trick" title="Embed anywhere an image works." sub="Public SVG routes send permissive CORS headers and cache for a minute. Point an image tag, a Markdown image or a wiki embed at the URL and it always shows the latest version." />
          </div>
          <CodeBlock title="HTML and Markdown" code={EMBED} />
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <FeatureCard icon="key" title="API tokens">Create and revoke tokens in Settings. Tokens work anywhere a session does.</FeatureCard>
          <FeatureCard icon="clock" title="Rate limits">AI calls: 20 per hour anonymous, 120 per hour signed in.</FeatureCard>
          <FeatureCard icon="server" title="Your server">Self-hosted on Bun and SQLite, so requests never leave your infrastructure.</FeatureCard>
        </div>
      </Section>

      <Section soft>
        <SectionHeading center title="API questions" />
        <div className="mx-auto max-w-3xl"><Faq items={FAQ} /></div>
      </Section>
      <CtaBand title="Put diagrams in your pipeline." />
    </>
  );
}
