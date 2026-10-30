// Small, dependency-free and XSS-safe markdown renderer.
// Everything is HTML-escaped first; only a fixed set of tags is ever produced.
//
// Special fences:
//   ```eraser-flowchart | eraser-architecture | eraser-sequence | eraser-erd   → renders the diagram (+ the source below it)
//   ```diagram:<elementId>                                                      → asks opts.figure(elementId) for SVG/HTML
import { renderDiagram } from "./engine";
import type { DiagramType } from "./types";

export interface MdOptions {
  /** Resolve a canvas element id to trusted HTML (usually an SVG string). Return null if unknown. */
  figure?: (elementId: string) => string | null;
  theme?: "light" | "dark";
  /** Show the source under `eraser-*` diagram fences (default true). */
  showSource?: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeUrl = (u: string) => {
  const t = u.trim().replace(/&amp;/g, "&");
  if (/^(https?:|mailto:|#|\/)/i.test(t)) return esc(t);
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(t)) return esc(t);
  return "#";
};

function inline(raw: string): string {
  let s = esc(raw);
  // code spans first (protect contents)
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => `<img alt="${alt}" src="${safeUrl(url)}" />`);
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text: string, url: string) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)] ?? "");
  return s;
}

const DIAGRAM_FENCE = /^eraser-(flowchart|architecture|sequence|erd)$/;

export function renderMarkdown(md: string, opts: MdOptions = {}): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const showSource = opts.showSource !== false;

  const isBlockStart = (l: string) =>
    /^(#{1,6})\s/.test(l) || /^```/.test(l) || /^\s*[-*+]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l) || /^>\s?/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l) || /^\|.*\|\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (/^```/.test(line)) {
      const info = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i++;
      }
      i++; // closing fence
      const code = body.join("\n");
      const dm = DIAGRAM_FENCE.exec(info);
      if (dm) {
        const r = renderDiagram(code, dm[1] as DiagramType, { theme: opts.theme });
        out.push(`<div class="figure">${r.svg}</div>`);
        if (showSource) out.push(`<pre><code>${esc(code)}</code></pre>`);
      } else if (info.startsWith("diagram:")) {
        const html = opts.figure?.(info.slice(8).trim()) ?? null;
        out.push(
          html
            ? `<div class="figure">${html}</div>`
            : `<div class="figure" style="color:var(--fg-muted);font-size:13px">Diagram not found on the canvas.</div>`,
        );
      } else {
        out.push(`<pre><code>${esc(code)}</code></pre>`);
      }
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = (h[1] ?? "#").length;
      out.push(`<h${lvl}>${inline((h[2] ?? "").trim())}</h${lvl}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        q.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(q.join("\n"), { ...opts, showSource })}</blockquote>`);
      continue;
    }

    if (/^\|.*\|\s*$/.test(line) && /^\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const cells = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i] ?? "")) {
        rows.push(cells(lines[i] ?? ""));
        i++;
      }
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }

    const ul = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    const ol = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? "";
        const m = ordered ? /^(\s*)\d+[.)]\s+(.*)$/.exec(l) : /^(\s*)[-*+]\s+(.*)$/.exec(l);
        if (!m) break;
        let text = m[2] ?? "";
        const task = /^\[( |x|X)\]\s+(.*)$/.exec(text);
        let prefix = "";
        if (task) {
          prefix = `<input type="checkbox" disabled ${task[1] !== " " ? "checked" : ""} style="margin-right:6px" />`;
          text = task[2] ?? "";
        }
        items.push(`<li>${prefix}${inline(text)}</li>`);
        i++;
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [line];
    i++;
    while (i < lines.length && (lines[i] ?? "").trim() !== "" && !isBlockStart(lines[i] ?? "")) {
      para.push(lines[i] ?? "");
      i++;
    }
    out.push(`<p>${para.map((p) => inline(p)).join("<br />")}</p>`);
  }
  return out.join("\n");
}
