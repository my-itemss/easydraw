import type { El, Style } from "../types";

const KEY = "easydraw:v1";
export interface Saved {
  elements: El[];
  canvasBg: string;
  grid: boolean;
  theme: "light" | "dark";
  style?: Partial<Style>;
  name?: string;
}

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch { return null; }
}

let timer: number | undefined;
export function saveSoon(get: () => Saved) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      const s = get();
      localStorage.setItem(KEY, JSON.stringify({ ...s, elements: s.elements.filter((e) => !e.isDeleted) }));
    } catch { /* quota */ }
  }, 400);
}

export function loadName(): string {
  try { return localStorage.getItem("easydraw:name") || ""; } catch { return ""; }
}
export function saveName(n: string) {
  try { localStorage.setItem("easydraw:name", n); } catch { /* */ }
}
