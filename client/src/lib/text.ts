import type { El, FontFamily } from "../types";

export const FONTS: Record<FontFamily, string> = {
  hand: '"Caveat", "Comic Sans MS", "Segoe Print", cursive',
  normal: '"Nunito", "Segoe UI", system-ui, sans-serif',
  code: '"JetBrains Mono", "Cascadia Code", Menlo, monospace',
};
export const LINE_HEIGHT = 1.25;

let ctx: CanvasRenderingContext2D | null = null;
const getCtx = () => (ctx ??= document.createElement("canvas").getContext("2d")!);

export const fontString = (size: number, family: FontFamily) => `${size}px ${FONTS[family]}`;

export function measureLines(lines: string[], size: number, family: FontFamily) {
  const c = getCtx();
  c.font = fontString(size, family);
  let width = 0;
  for (const l of lines) width = Math.max(width, c.measureText(l || " ").width);
  return { width: Math.ceil(width), height: Math.ceil(lines.length * size * LINE_HEIGHT) };
}

export function measureText(text: string, size: number, family: FontFamily) {
  return measureLines(text.split("\n"), size, family);
}

/** Word-wrap `text` to `maxWidth` using the current font. */
export function wrapText(text: string, size: number, family: FontFamily, maxWidth: number): string[] {
  const c = getCtx();
  c.font = fontString(size, family);
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (c.measureText(test).width <= maxWidth || !line) {
        // very long single word: break by character
        if (!line && c.measureText(word).width > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (c.measureText(chunk + ch).width > maxWidth && chunk) { out.push(chunk); chunk = ch; } else chunk += ch;
          }
          line = chunk;
        } else line = test;
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

export const labelFont = (el: El) => ({ size: el.fontSize ?? 20, family: el.fontFamily ?? "hand" });
