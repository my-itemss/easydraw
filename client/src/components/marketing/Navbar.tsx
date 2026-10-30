import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LinkButton, Logo, ThemeToggle, Container, cx } from "../ui";
import { Icon } from "./Icon";
import { NAV_GROUPS, NAV_LINKS, type NavGroup } from "./nav";

function Dropdown({ group, open, setOpen }: { group: NavGroup; open: boolean; setOpen: (v: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = `menu-${group.label}`;
  const wide = group.items.length > 5;

  const hover = (v: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(v), v ? 0 : 120);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          ref.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className={cx(
          "inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]",
          open && "bg-[var(--bg-soft)] text-[var(--fg)]",
        )}
      >
        {group.label}
        <Icon name="chevron" size={14} className={cx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={id} className="absolute left-0 top-full z-50 pt-2">
          <ul
            className={cx(
              "rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-2 shadow-xl",
              wide ? "w-[340px]" : "w-[320px]",
            )}
          >
            {group.items.map((it) => (
              <li key={it.to}>
                <Link
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--bg-soft)]"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]">
                    <Icon name={it.icon ?? "layers"} size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--fg)]">{it.label}</span>
                    {it.desc && <span className="block text-xs leading-snug text-[var(--fg-muted)]">{it.desc}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AuthButtons({ stacked }: { stacked?: boolean }) {
  return (
    <LinkButton to="/app" size={stacked ? "lg" : "sm"} className={stacked ? "w-full" : "h-9 px-4"}>
      Open easydraw
    </LinkButton>
  );
}

export default function Navbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setOpenMenu(null);
    setMobile(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobile]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-2">
        <Logo className="mr-3" />
        <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
          {NAV_GROUPS.map((g) => (
            <Dropdown key={g.label} group={g} open={openMenu === g.label} setOpen={(v) => setOpenMenu(v ? g.label : null)} />
          ))}
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cx(
                  "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]",
                  isActive ? "text-[var(--fg)]" : "text-[var(--fg-muted)]",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <div className="hidden items-center gap-1.5 sm:flex">
            <AuthButtons />
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--fg)] hover:bg-[var(--bg-soft)] lg:hidden"
            aria-label={mobile ? "Close menu" : "Open menu"}
            aria-expanded={mobile}
            aria-controls="mobile-menu"
            onClick={() => setMobile((v) => !v)}
          >
            <Icon name={mobile ? "x" : "menu"} />
          </button>
        </div>
      </Container>

      {mobile && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-[var(--border)] bg-[var(--bg)] lg:hidden"
        >
          <Container className="space-y-6 py-6">
            {NAV_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{g.label}</p>
                <ul>
                  {g.items.map((it) => (
                    <li key={it.to}>
                      <Link to={it.to} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] font-medium hover:bg-[var(--bg-soft)]">
                        <Icon name={it.icon ?? "layers"} size={18} className="text-[var(--fg-muted)]" />
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <ul className="border-t border-[var(--border)] pt-4">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="block rounded-lg px-2 py-2.5 text-[15px] font-medium hover:bg-[var(--bg-soft)]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 pb-6">
              <AuthButtons stacked />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
