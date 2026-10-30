export type ColorMode = "pastel" | "bold" | "outline";

export interface Theme {
  dark: boolean;
  bg: string;
  fg: string;
  muted: string;
  line: string;
  nodeFill: string;
  nodeStroke: string;
  groupFill: string;
  groupStroke: string;
  font: string;
  mono: string;
}

export const NAMED_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22a55e",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
  gray: "#71717a",
  grey: "#71717a",
  black: "#18181b",
  white: "#ffffff",
};

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
const ROUGH = "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive";

export function makeTheme(mode: "light" | "dark", typeface: "clean" | "mono" | "rough"): Theme {
  const font = typeface === "mono" ? MONO : typeface === "rough" ? ROUGH : FONT;
  return mode === "dark"
    ? {
        dark: true,
        bg: "#14141a",
        fg: "#f4f4f5",
        muted: "#a1a1aa",
        line: "#a1a1aa",
        nodeFill: "#20202a",
        nodeStroke: "#454552",
        groupFill: "#ffffff08",
        groupStroke: "#454552",
        font,
        mono: MONO,
      }
    : {
        dark: false,
        bg: "#ffffff",
        fg: "#18181b",
        muted: "#71717a",
        line: "#52525b",
        nodeFill: "#ffffff",
        nodeStroke: "#c9c9d1",
        groupFill: "#00000006",
        groupStroke: "#c9c9d1",
        font,
        mono: MONO,
      };
}

export function parseHex(c: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  let h = m[1] as string;
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Returns a hex colour or null when unknown. */
export function resolveColor(c: string | undefined): string | null {
  if (!c) return null;
  const t = c.trim().toLowerCase();
  if (NAMED_COLORS[t]) return NAMED_COLORS[t] as string;
  return parseHex(t) ? t : null;
}

export function mix(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  if (!A || !B) return a;
  const m = (i: number) => Math.round((A[i] as number) * t + (B[i] as number) * (1 - t));
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(m(0))}${h(m(1))}${h(m(2))}`;
}

function luminance(c: string): number {
  const p = parseHex(c);
  if (!p) return 0;
  return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255;
}

export interface Paint {
  fill: string;
  stroke: string;
  text: string;
}

export function paintFor(theme: Theme, color: string | undefined, mode: ColorMode): Paint {
  const c = resolveColor(color);
  if (!c) return { fill: theme.nodeFill, stroke: theme.nodeStroke, text: theme.fg };
  if (mode === "bold") {
    return { fill: c, stroke: mix(c, "#000000", 0.8), text: luminance(c) > 0.7 ? "#18181b" : "#ffffff" };
  }
  if (mode === "outline") return { fill: theme.bg, stroke: c, text: theme.fg };
  return { fill: mix(c, theme.bg, theme.dark ? 0.24 : 0.14), stroke: c, text: theme.fg };
}
