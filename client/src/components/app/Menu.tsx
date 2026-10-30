import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../ui";

export function Menu({
  trigger,
  children,
  align = "right",
  label = "Menu",
  className,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className={cx("relative inline-block", className)}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className="cursor-pointer">
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cx(
            "absolute z-50 mt-2 min-w-[190px] rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1.5 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onClick, danger, children, disabled }: { onClick?: () => void; danger?: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-soft)] disabled:cursor-default disabled:opacity-40",
        danger ? "text-red-500" : "text-[var(--fg)]",
      )}
    >
      {children}
    </button>
  );
}

export const MenuSep = () => <div className="my-1 h-px bg-[var(--border)]" />;
