import { LinkButton } from "../../components/ui";
import { Badge, CtaBand, FeatureCard, PageHero, Section, SectionHeading } from "../../components/marketing/parts";
import { REPO_URL } from "../../components/marketing/nav";

export default function EnterprisePage() {
  return (
    <>
      <PageHero
        eyebrow="Enterprise"
        title="Your diagrams, on your servers."
        sub="easydraw runs entirely inside your infrastructure, with the access controls teams actually need. Some enterprise features are still planned, and we say which."
      >
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center rounded-full bg-[var(--fg)] px-6 text-[15px] font-medium text-[var(--bg)] hover:opacity-85">View on GitHub</a>
        <LinkButton to="/docs/self-hosting" variant="secondary" size="lg">Self-hosting guide</LinkButton>
      </PageHero>

      <Section>
        <SectionHeading eyebrow="Available today" title="Built and working." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon="users" title="Workspaces and roles">Owner, admin, member and guest roles. Guests only see files shared with them.</FeatureCard>
          <FeatureCard icon="globe" title="Allowed email domain">Set a company domain and people with that email domain join the workspace automatically.</FeatureCard>
          <FeatureCard icon="history" title="Audit log">Sign-ins, file changes, sharing, member and token events, visible to owners and admins.</FeatureCard>
          <FeatureCard icon="lock" title="Private files">Mark a file private so only its owner and people invited by email can open it.</FeatureCard>
          <FeatureCard icon="server" title="Data ownership">Self-hosted on Bun and SQLite. Documents and diagrams stay on your server, and nothing is used for training.</FeatureCard>
          <FeatureCard icon="key" title="API tokens">Scripted access with revocable tokens for automation and CI.</FeatureCard>
        </div>
      </Section>

      <Section soft>
        <SectionHeading eyebrow="Planned" title="Not built yet." sub="These are on the wishlist and not available. Do not plan a rollout around them." />
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="shield" title="SAML SSO" badge={<Badge tone="planned">Planned</Badge>}>Single sign-on with your identity provider.</FeatureCard>
          <FeatureCard icon="users" title="SCIM" badge={<Badge tone="planned">Planned</Badge>}>Automatic user provisioning and deprovisioning.</FeatureCard>
          <FeatureCard icon="check" title="SOC 2" badge={<Badge tone="planned">Planned</Badge>}>No audit or certification has been completed.</FeatureCard>
        </div>
      </Section>
      <CtaBand title="Evaluate it on your own hardware." sub="Clone the repository, run it with Bun, and decide for yourself." />
    </>
  );
}
