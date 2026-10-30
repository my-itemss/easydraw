// Diagram engine public API. Pure TypeScript – no DOM, usable from the browser, the Bun server and the CLI.
import type { DiagramType } from "../types";
import { parse, type Diagnostic, type Parsed } from "./parse";
import { makeTheme } from "./theme";
import { errorSvg, makeCtx, wrapSvg } from "./svg";
import { renderFlow } from "./flow";
import { renderSequence } from "./sequence";
import { renderErd } from "./erd";
import { iconNames as icons } from "./icons";
import { hash } from "./util";

export type { DiagramType } from "../types";
export type { Diagnostic, Parsed } from "./parse";
export { DIAGRAM_TYPES, samples, examples } from "./samples";
export type { Example } from "./samples";

export interface RenderOptions {
  theme?: "light" | "dark";
  /** Paint an opaque background rect behind the diagram (default false). */
  background?: boolean;
  padding?: number;
}

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
  diagnostics: Diagnostic[];
}

export function parseDiagram(code: string, type: DiagramType): Parsed {
  return parse(code, type);
}

export function renderDiagram(code: string, type: DiagramType, opts: RenderOptions = {}): RenderResult {
  const mode = opts.theme === "dark" ? "dark" : "light";
  let P: Parsed;
  try {
    P = parse(code ?? "", type);
  } catch (e) {
    const er = errorSvg("Could not parse diagram", makeTheme(mode, "clean"));
    return { ...er, diagnostics: [{ line: 1, message: String((e as Error)?.message ?? e), severity: "error" }] };
  }
  const theme = makeTheme(mode, P.globals.typeface);
  try {
    const ctx = makeCtx(theme, P.globals, "ed" + hash(code + mode + type));
    const r = type === "sequence" ? renderSequence(P, ctx) : type === "erd" ? renderErd(P, ctx) : renderFlow(P, ctx);
    if (P.nodes.size === 0 && P.seq.length === 0) {
      const er = errorSvg("Empty diagram — start typing to see it here", theme);
      return { ...er, diagnostics: P.diagnostics };
    }
    const out = wrapSvg(ctx, r.body, r.bounds, { background: opts.background, padding: opts.padding });
    return { ...out, diagnostics: P.diagnostics };
  } catch (e) {
    const er = errorSvg("Could not render diagram", theme);
    return {
      ...er,
      diagnostics: [...P.diagnostics, { line: 1, message: `Render failed: ${String((e as Error)?.message ?? e)}`, severity: "error" }],
    };
  }
}

/** Heuristic guess of the diagram type for pasted code. */
export function detectType(code: string): DiagramType {
  const lines = code.split("\n").map((l) => l.trim());
  if (lines.some((l) => /^(activate|deactivate)\s/.test(l) || /^(alt|loop|opt|par|break)\b.*\{/.test(l) || /^autoNumber\b/.test(l))) return "sequence";
  if (lines.some((l) => /^\w+(\.\w+)?\s+(string|int|text|uuid|bigint|decimal|timestamp|boolean|date)\b/.test(l) || /\b(pk|fk)\b/.test(l))) return "erd";
  if (lines.some((l) => /\[[^\]]*icon\s*:/.test(l)) && lines.some((l) => /\{\s*$/.test(l))) return "architecture";
  const hasColonMsg = lines.filter((l) => /^[\w"][^>]*\s>\s[^:]+:/.test(l)).length;
  if (hasColonMsg >= 3 && !lines.some((l) => /shape\s*:/.test(l))) return "sequence";
  return "flowchart";
}

export function iconNames(): string[] {
  return icons();
}
