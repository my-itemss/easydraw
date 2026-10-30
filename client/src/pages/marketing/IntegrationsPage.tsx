import { LinkButton } from "../../components/ui";
import { Badge, CodeBlock, CtaBand, FeatureCard, PageHero, Section, SectionHeading } from "../../components/marketing/parts";
import { REPO_URL } from "../../components/marketing/nav";

const WORKFLOW = `name: Render diagrams
on:
  push:
    paths: ["docs/**/*.eraser", "docs/**/*.dsl"]
jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
        working-directory: server
      - run: bun cli/render.ts "../docs/**/*.eraser" --out ../docs/img
        working-directory: server
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "Render diagrams"`;

const MCP = `{
  "mcpServers": {
    "easydraw": {
      "command": "bun",
      "args": ["server/mcp/index.ts"],
      "env": {
        "EASYDRAW_API_URL": "http://localhost:3001",
        "EASYDRAW_API_TOKEN": "ek_your_token"
      }
    }
  }
}`;

const README = `![Architecture](https://YOUR-SERVER/api/v1/diagrams/DIAGRAM_ID.svg)`;
const CLI = `cd server
bun cli/render.ts "docs/*.eraser" --out docs/img --theme dark
# type from a first-line comment:  // type: sequence`;

const ROWS: { name: string; how: string; status: "Available" | "Planned" }[] = [
  { name: "GitHub Actions", how: "CLI renderer plus a workflow", status: "Available" },
  { name: "MCP (stdio)", how: "Tools for AI agents", status: "Available" },
  { name: "Markdown READMEs", how: "SVG image URL", status: "Available" },
  { name: "Notion, Confluence", how: "Embed the SVG URL or the iframe embed", status: "Available" },
  { name: "REST API", how: "Tokens and /api/v1", status: "Available" },
  { name: "Native Notion and Confluence apps", how: "Dedicated marketplace apps", status: "Planned" },
  { name: "VS Code extension", how: "Preview and edit in the IDE", status: "Planned" },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="Diagrams where your team already works."
        sub="easydraw plugs in through standard pieces: SVG URLs, an iframe embed, a CLI, an MCP server and a REST API."
      >
        <LinkButton to="/docs/embedding" size="lg">Embedding guide</LinkButton>
        <LinkButton to="/product/api" variant="secondary" size="lg">API</LinkButton>
      </PageHero>

      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="git" title="GitHub Actions">Render diagram files to SVG on every push and commit the result.</FeatureCard>
          <FeatureCard icon="doc" title="Markdown READMEs">One image line pulls a live diagram into any README.</FeatureCard>
          <FeatureCard icon="globe" title="Notion and Confluence">Embed via the SVG URL or the iframe at /embed/:token. No native app needed.</FeatureCard>
          <FeatureCard icon="plug" title="MCP">A stdio server lets AI agents create, read and update diagrams.</FeatureCard>
          <FeatureCard icon="terminal" title="CLI">Render .eraser and .dsl files locally or in CI.</FeatureCard>
          <FeatureCard icon="key" title="REST API">Tokens, render, files and export under /api/v1.</FeatureCard>
        </div>
      </Section>

      <Section soft>
        <SectionHeading eyebrow="CI" title="Keep diagrams in the repo, rendered by CI." />
        <div className="grid gap-6 lg:grid-cols-2">
          <CodeBlock title=".github/workflows/diagrams.yml" code={WORKFLOW} />
          <div className="space-y-6">
            <CodeBlock title="CLI" code={CLI} />
            <CodeBlock title="README.md" code={README} />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="AI agents" title="Use easydraw from an MCP client." sub="Add this to your MCP client config. Tools: create_diagram, list_files, read_file, update_diagram, export_diagram." />
        <CodeBlock title="mcp config" code={MCP} />
      </Section>

      <Section soft>
        <SectionHeading eyebrow="Status" title="What works today, and what does not." />
        <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
          {ROWS.map((r) => (
            <div key={r.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div>
                <p className="text-[15px] font-medium">{r.name}</p>
                <p className="text-sm text-[var(--fg-muted)]">{r.how}</p>
              </div>
              <Badge tone={r.status === "Planned" ? "planned" : "green"}>{r.status}</Badge>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-[var(--fg-muted)]">
          Want one of the planned items? <a className="underline" href={REPO_URL} target="_blank" rel="noreferrer">Open an issue on GitHub</a>.
        </p>
      </Section>
      <CtaBand title="Wire it into your stack." />
    </>
  );
}
