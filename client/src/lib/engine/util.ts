export interface Pt {
  x: number;
  y: number;
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Character-width heuristic (no canvas available in Bun / on the server). */
export function textWidth(s: string, size: number, mono = false): number {
  if (mono) return s.length * size * 0.6;
  let w = 0;
  for (const ch of s) {
    if ("iljtf.,:;|!'` ()[]/".includes(ch)) w += 0.32;
    else if ("mwMW@%".includes(ch)) w += 0.86;
    else if (/[A-Z0-9]/.test(ch)) w += 0.65;
    else if (ch.charCodeAt(0) > 0x2e80) w += 1.0;
    else w += 0.55;
  }
  return w * size;
}

export function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export const r1 = (n: number) => Math.round(n * 10) / 10;
