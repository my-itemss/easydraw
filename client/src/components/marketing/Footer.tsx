import { Link } from "react-router-dom";
import { Container, Logo } from "../ui";
import { Icon } from "./Icon";
import { NAV_GROUPS, REPO_URL } from "./nav";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-soft)]">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-[var(--fg-muted)]">
              Docs, diagrams and an infinite canvas. Open source and self-hosted.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--fg)] hover:underline"
            >
              <Icon name="github" size={18} /> Star on GitHub
            </a>
          </div>
          {NAV_GROUPS.map((g) => (
            <nav key={g.label} aria-label={g.label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{g.label}</h2>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li key={it.to}>
                    <Link to={it.to} className="text-sm text-[var(--fg)] hover:underline">
                      {it.label}
                    </Link>
                  </li>
                ))}
                {g.label === "Product" && (
                  <>
                    <li>
                      <Link to="/pricing" className="text-sm text-[var(--fg)] hover:underline">Pricing</Link>
                    </li>
                    <li>
                      <Link to="/enterprise" className="text-sm text-[var(--fg)] hover:underline">Enterprise</Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-12 border-t border-[var(--border)] pt-6 text-xs text-[var(--fg-muted)]">
          easydraw is free software you run yourself. Your diagrams stay on your server.
        </p>
      </Container>
    </footer>
  );
}
