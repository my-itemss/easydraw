export const STROKE_COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
export const STROKE_MORE = ["#343a40", "#c2255c", "#9c36b5", "#6741d9", "#0c8599", "#099268", "#66a80f", "#e8590c", "#868e96", "#ffffff"];
export const BG_COLORS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
export const BG_MORE = ["#ffd8a8", "#eebefa", "#d0bfff", "#99e9f2", "#96f2d7", "#d8f5a2", "#f1f3f5", "#ced4da", "#ffffff", "#1e1e1e"];
export const CANVAS_COLORS = ["#ffffff", "#f8f9fa", "#f5faff", "#fffce8", "#fdf8f6"];
export const PEER_COLORS = ["#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5", "#0c8599", "#c2255c", "#6741d9"];

const cache = new Map<string, string>();

function parse(c: string): [number, number, number] | null {
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    if (h.length !== 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

/** Same math as CSS `invert(93%) hue-rotate(180deg)` — keeps hues recognisable in dark mode. */
export function darkColor(c: string): string {
  if (c === "transparent") return c;
  const hit = cache.get(c);
  if (hit) return hit;
  const rgb = parse(c);
  if (!rgb) return c;
  const [r0, g0, b0] = rgb.map((v) => 0.93 - 0.86 * (v / 255));
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const r = clamp(-0.574 * r0 + 1.43 * g0 + 0.144 * b0);
  const g = clamp(0.426 * r0 + 0.43 * g0 + 0.144 * b0);
  const b = clamp(0.426 * r0 + 1.43 * g0 - 0.856 * b0);
  const out = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  cache.set(c, out);
  return out;
}
