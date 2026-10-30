import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Pref = "light" | "dark" | "system";
interface ThemeCtx {
  pref: Pref;
  theme: "light" | "dark"; // resolved
  setPref: (p: Pref) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = "easydraw.theme";

const systemDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<Pref>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" || v === "system" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [sys, setSys] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const h = () => setSys(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const theme: "light" | "dark" = pref === "system" ? (sys ? "dark" : "light") : pref;

  const setPref = useCallback((p: Pref) => {
    setPrefState(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => setPref(theme === "dark" ? "light" : "dark"), [theme, setPref]);
  const value = useMemo(() => ({ pref, theme, setPref, toggle }), [pref, theme, setPref, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme outside ThemeProvider");
  return c;
}

/** Mount inside layouts: applies `.dark` to <html> while the layout is on screen (the legacy "/" page never mounts it). */
export function useApplyTheme() {
  const { theme } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    return () => {
      root.classList.remove("dark");
      root.style.colorScheme = "";
    };
  }, [theme]);
}
