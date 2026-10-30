import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LinkButton, cx } from "../../components/ui";
import { Badge, Check, CtaBand, Faq, PageHero, Section } from "../../components/marketing/parts";
import { Icon } from "../../components/marketing/Icon";
import { REPO_URL } from "../../components/marketing/nav";

function Plan({ name, price, note, badge, items, cta, highlight }: { name: string; price: string; note: string; badge?: ReactNode; items: string[]; cta: ReactNode; highlight?: boolean }) {
  return (
    <div className={cx("flex flex-col rounded-2xl border bg-[var(--bg-elev)] p-6", highlight ? "border-[var(--fg)] shadow-[0_20px_50px_-24px_rgba(0,0,0,.35)]" : "border-[var(--border)]")}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
        {badge}
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight">{price}</p>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{note}</p>
      <ul className="my-6 flex-1 space-y-2.5">{items.map((i) => <Check key={i}>{i}</Check>)}</ul>
      {cta}
    </div>
  );
}

const TABLE: [string, string, string, string][] = [
  ["Docs, canvas and diagrams", "Yes", "Planned", "Planned"],
  ["Realtime collaboration", "Yes", "Planned", "Planned"],
  ["Workspaces, roles, audit log", "Yes", "Planned", "Planned"],
  ["REST API, MCP, CLI", "Yes", "Planned", "Planned"],
  ["AI generation", "Your Anthropic key or offline", "Planned", "Planned"],
  ["SAML SSO and SCIM", "Not available", "Not planned", "Planned"],
  ["Vendor support", "Community on GitHub", "Planned", "Planned"],
];

const FAQ = [
  { q: "Is easydraw really free?", a: "Yes. It is open source and self-hosted. There are no seat limits, file limits or feature gates in the code." },
  { q: "What does AI cost?", a: "Without a key, the offline generator is free and local. With ANTHROPIC_API_KEY set, you pay Anthropic directly for the tokens you use." },
  { q: "Will there be hosted plans?", a: "They are planned but not built. Nothing here is purchasable today, and we will not take payment details." },
  { q: "What do I need to run it?", a: <>Bun and a disk for SQLite. See <Link className="underline" to="/docs/self-hosting">self-hosting</Link>.</> },
];

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Free, because you host it." sub="easydraw is open source. Run it on your own server and everything is unlimited. Hosted options are planned, not for sale yet." />
      <Section>
        <div className="grid gap-5 lg:grid-cols-3">
          <Plan
            highlight
            name="Self-hosted"
            price="Free"
            note="Forever. Everything unlimited."
            badge={<Badge tone="green">Available</Badge>}
            items={["All editor, canvas and diagram features", "Collaboration, comments, version history", "Teams, roles and audit log", "API, MCP server and CLI", "AI via your own Anthropic key, or offline"]}
            cta={<LinkButton to="/docs/self-hosting" size="lg">Self-hosting guide</LinkButton>}
          />
          <Plan
            name="Hosted"
            price="Not yet"
            note="We run it for you."
            badge={<Badge tone="planned">Planned</Badge>}
            items={["Managed hosting and backups", "No servers to maintain"]}
            cta={<span className="inline-flex h-12 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-sm text-[var(--fg-muted)]" aria-disabled="true">Not available</span>}
          />
          <Plan
            name="Enterprise"
            price="Not yet"
            note="For larger organizations."
            badge={<Badge tone="planned">Planned</Badge>}
            items={["SAML single sign-on", "SCIM provisioning", "Support agreement"]}
            cta={<span className="inline-flex h-12 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-sm text-[var(--fg-muted)]" aria-disabled="true">Not available</span>}
          />
        </div>
        <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
          <Icon name="github" size={14} className="mr-1 inline" />
          Interested in a planned tier? Say so on <a className="underline" href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </Section>

      <Section soft>
        <h2 className="mb-8 text-3xl font-semibold tracking-tight">Compare</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-xs uppercase tracking-wider text-[var(--fg-muted)]">
              <tr><th className="px-4 py-3">Feature</th><th className="px-4 py-3">Self-hosted</th><th className="px-4 py-3">Hosted</th><th className="px-4 py-3">Enterprise</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {TABLE.map((r) => (
                <tr key={r[0]}>
                  <th scope="row" className="px-4 py-3 font-medium">{r[0]}</th>
                  {r.slice(1).map((c, i) => <td key={i} className={cx("px-4 py-3", c === "Planned" ? "text-amber-700 dark:text-amber-300" : "text-[var(--fg-muted)]")}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl"><Faq items={FAQ} /></div>
      </Section>
      <CtaBand title="Run it today. It costs nothing." />
    </>
  );
}
