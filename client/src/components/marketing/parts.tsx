import { useState, type ReactNode } from "react";
import { Container, LinkButton, cx } from "../ui";
import { Icon } from "./Icon";

export function Section({
  children,
  className,
  soft,
  id,
}: {
  children: ReactNode;
  className?: string;
  soft?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cx("py-16 sm:py-24", soft && "border-y border-[var(--border)] bg-[var(--bg-soft)]", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  center,
  as: H = "h2",
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  center?: boolean;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cx("mb-10 max-w-2xl sm:mb-14", center && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">{eyebrow}</p>}
      <H className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</H>
      {sub && <p className="mt-4 text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">{sub}</p>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "planned" | "green" }) {
  const tones = {
    neutral: "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--fg-muted)]",
    brand: "border-transparent bg-[var(--color-brand)]/12 text-[var(--color-brand)]",
    planned: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4", tones[tone])}>
      {children}
    </span>
  );
}

export function PageHero({
  eyebrow,
  title,
  sub,
  children,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  sub: string;
  children?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className="ed-grid border-b border-[var(--border)]">
      <div className="bg-gradient-to-b from-[var(--bg)]/0 via-[var(--bg)]/60 to-[var(--bg)]">
        <Container className={cx("pb-14 pt-16 sm:pb-20 sm:pt-24", center && "text-center")}>
          {eyebrow && (
            <p className="mb-4 inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-xs font-medium text-[var(--fg-muted)]">
              {eyebrow}
            </p>
          )}
          <h1 className={cx("ed-fade-up text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.05]", center && "mx-auto max-w-3xl")}>
            {title}
          </h1>
          <p className={cx("mt-5 text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg", center && "mx-auto max-w-2xl")}>{sub}</p>
          {children && <div className={cx("mt-8 flex flex-wrap gap-3", center && "justify-center")}>{children}</div>}
        </Container>
      </div>
    </div>
  );
}

export function FeatureCard({
  icon,
  title,
  children,
  badge,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--fg)]">
          <Icon name={icon} />
        </span>
        {badge}
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-muted)]">{children}</p>
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium"
              >
                {it.q}
                <Icon name="chevron" size={18} className={cx("shrink-0 text-[var(--fg-muted)] transition-transform", isOpen && "rotate-180")} />
              </button>
            </h3>
            {isOpen && (
              <div id={`faq-${i}`} className="px-5 pb-5 text-sm leading-relaxed text-[var(--fg-muted)]">
                {it.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function copyText(text: string) {
  try {
    return navigator.clipboard.writeText(text);
  } catch {
    return Promise.reject(new Error("clipboard unavailable"));
  }
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        copyText(text)
          .then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1600);
          })
          .catch(() => {});
      }}
      className={cx(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-2 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]",
        className,
      )}
    >
      <Icon name={done ? "check" : "file"} size={13} />
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

export function CodeBlock({
  code,
  title,
  className,
  maxHeight,
}: {
  code: string;
  title?: string;
  className?: string;
  maxHeight?: number | string;
}) {
  return (
    <div className={cx("overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-1.5">
        <span className="truncate text-xs text-[var(--fg-muted)]">{title ?? ""}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-auto p-4 text-[12.5px] leading-relaxed" style={{ maxHeight }} tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MockWindow({
  title,
  children,
  className,
  tabs,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tabs?: ReactNode;
}) {
  return (
    <div className={cx("overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-[0_24px_60px_-24px_rgba(0,0,0,.25)]", className)}>
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-2.5 w-2.5 rounded-full bg-[var(--border)]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[var(--border)]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[var(--border)]" />
        </span>
        <span className="truncate text-xs font-medium text-[var(--fg-muted)]">{title}</span>
        {tabs && <span className="ml-auto flex gap-1 text-xs">{tabs}</span>}
      </div>
      {children}
    </div>
  );
}

export function CtaBand({
  title = "Draw it, document it, ship it.",
  sub = "Create a workspace in a minute, or run your own copy from the repository.",
}: {
  title?: string;
  sub?: string;
}) {
  return (
    <Section>
      <div className="ed-grid relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-soft)] px-6 py-14 text-center sm:py-20">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[var(--fg-muted)] sm:text-lg">{sub}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton to="/app" size="lg">
            Start free
          </LinkButton>
          <LinkButton to="/examples" variant="secondary" size="lg">
            Browse examples
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}

export function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>{children}</span>
    </li>
  );
}

export function TwoCol({
  text,
  visual,
  reverse,
}: {
  text: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cx(reverse && "lg:order-2")}>{text}</div>
      <div className={cx("min-w-0", reverse && "lg:order-1")}>{visual}</div>
    </div>
  );
}
