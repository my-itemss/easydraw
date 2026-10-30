import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Container } from "../../components/ui";
import DiagramTool, { type ToolExample } from "../../components/tools/DiagramTool";
import { COMMON_FAQ, ToolFaq, ToolHero, ToolSection, ToolsGrid } from "../../components/tools/ToolParts";

const EXAMPLES: ToolExample[] = [
  { label: "Login flow between browser, API and DB", prompt: "The browser posts credentials to the API, which checks the user in the database and returns a session token.", type: "sequence" },
  { label: "Blog database schema", prompt: "A blog with users, posts, comments and tags. A post belongs to a user and has many comments and tags.", type: "erd" },
  { label: "Web app on AWS", prompt: "A React app on a CDN calls an API behind a load balancer. The API runs on containers in a VPC and uses Postgres and Redis.", type: "architecture" },
  { label: "Refund approval process", prompt: "A customer requests a refund. If the amount is under 50 dollars, approve it automatically, otherwise a manager reviews it. Then notify the customer.", type: "flowchart" },
  { label: "Let DiagramGPT choose", prompt: "A checkout service takes an order, charges Stripe, writes to Postgres and publishes an event to a queue." },
];

const FAQ = [
  ...COMMON_FAQ,
  {
    q: "How do I get better results?",
    a: "Name the parts and say how they interact, in order. Pick a diagram type if you know which one you want. Then use the refine box for follow-ups such as 'add a cache' or 'rename API to Gateway'.",
  },
  {
    q: "Is my prompt stored?",
    a: "Requests are logged on the server for rate limiting and, if you are signed in, your history. Your last prompt is also kept in this browser tab (session storage) so a refresh does not lose it. Do not paste secrets.",
  },
  {
    q: "Can I use the diagram commercially?",
    a: "Yes. The output is yours: plain text code and exported images with no watermark.",
  },
];

export default function DiagramGptPage() {
  useEffect(() => {
    document.title = "DiagramGPT: free AI diagram generator | easydraw";
  }, []);
  return (
    <>
      <ToolHero
        eyebrow="Free tool, no sign-up"
        title="Describe it. Get a diagram."
        sub="DiagramGPT turns a few sentences into a flowchart, architecture, sequence or database diagram. The result is editable code, so you can keep tweaking it."
      />
      <Container className="py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <DiagramTool examples={EXAMPLES} storageKey="easydraw.diagramgpt.prompt" />
        </div>
        <div className="mx-auto max-w-4xl">
          <ToolSection title="Frequently asked questions">
            <ToolFaq items={FAQ} />
          </ToolSection>
        </div>
        <ToolSection title="More free tools">
          <ToolsGrid exclude="/diagramgpt" />
          <p className="mt-6 text-sm text-[var(--fg-muted)]">
            Prefer to write the code yourself? Read the <Link to="/docs/getting-started" className="underline underline-offset-2">docs</Link>.
          </p>
        </ToolSection>
      </Container>
    </>
  );
}
