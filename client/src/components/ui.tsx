import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useTheme } from "../lib/theme";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Logo */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" />
      <path
        d="M9 21.5c3.2-7.5 5.3-10.5 7.2-10.5 2.6 0 .2 8.2 2.9 8.2 1.3 0 2.4-1.3 3.9-3.6"
        fill="none"
        stroke="var(--logo-fg, #fff)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ to = "/product", className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cx("inline-flex items-center gap-2 font-semibold tracking-tight text-[17px] text-[var(--fg)]", className)}
      style={{ ["--logo-fg" as string]: "var(--bg)" }}
    >
      <LogoMark />
      easydraw
    </Link>
  );
}

/* ---------------------------------------------------------------- Button */
type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
const variants: Record<Variant, string> = {
  primary: "bg-[var(--fg)] text-[var(--bg)] hover:opacity-85",
  secondary: "border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg)] hover:bg-[var(--bg-soft)]",
  ghost: "text-[var(--fg)] hover:bg-[var(--bg-soft)]",
  accent: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-600)]",
  danger: "bg-red-600 text-white hover:bg-red-700",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export const btnClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cx(base, variants[variant], sizes[size], extra);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", className, ...rest },
  ref,
) {
  return <button ref={ref} className={btnClass(variant, size, className)} {...rest} />;
});

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

/* ---------------------------------------------------------------- Bits */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[1160px] px-5 sm:px-8", className)}>{children}</div>;
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color || "#5b5bd6", fontSize: size * 0.4 }}
      title={name}
    >
      {initials || "?"}
    </span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] cursor-pointer",
        className,
      )}
    >
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------- Modal */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ed fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[88vh] w-full overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 shadow-2xl"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[var(--fg)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--fg-muted)]">{hint}</span>}
    </label>
  );
}
