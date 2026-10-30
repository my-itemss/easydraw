import type { AiResult, DiagramType } from "../../client/src/lib/types";
import { renderDiagram } from "../../client/src/lib/engine";
import { DOC_SYSTEM, systemPrompt } from "./prompts";

export const claudeEnabled = () => !!process.env.ANTHROPIC_API_KEY;
const model = () => process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

type Msg = { role: "user" | "assistant"; content: string };

export async function callClaude(system: string, messages: Msg[], maxTokens = 2048): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: model(), max_tokens: maxTokens, system, messages }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic API responded ${res.status}`);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text.trim()) throw new Error("Empty response from Anthropic API");
  return text;
}

/** Removes markdown fences if the model added them anyway. */
export function stripFences(s: string): string {
  const t = s.trim();
  const m = /^```[\w-]*\n([\s\S]*?)\n?```\s*$/.exec(t);
  if (m) return m[1]!.trim();
  const inner = /```[\w-]*\n([\s\S]*?)```/.exec(t);
  return (inner ? inner[1]! : t).trim();
}

export function errorsOf(code: string, type: DiagramType): string[] {
  try {
    return renderDiagram(code, type).diagnostics.filter((d) => d.severity === "error").map((d) => `line ${d.line}: ${d.message}`);
  } catch (e) {
    return [`render failed: ${(e as Error).message}`];
  }
}

export async function generateWithClaude(o: { prompt: string; type: DiagramType; currentCode?: string; history?: Msg[] }): Promise<AiResult> {
  const system = systemPrompt(o.type);
  const user = o.currentCode?.trim()
    ? `Current code:\n${o.currentCode}\n\nRequest: ${o.prompt}`
    : o.prompt;
  const messages: Msg[] = [...(o.history ?? []).slice(-10), { role: "user", content: user }];
  let code = stripFences(await callClaude(system, messages));
  let errs = errorsOf(code, o.type);
  if (errs.length) {
    const retry: Msg[] = [
      ...messages,
      { role: "assistant", content: code },
      { role: "user", content: `That code has errors:\n${errs.join("\n")}\nFix them and reply with ONLY the corrected diagram code.` },
    ];
    code = stripFences(await callClaude(system, retry));
    errs = errorsOf(code, o.type);
  }
  return {
    code,
    diagramType: o.type,
    mode: "claude",
    explanation: errs.length ? `Generated with Claude, but the diagram still has problems: ${errs.slice(0, 3).join("; ")}` : "Generated with Claude.",
  };
}

export async function docWithClaude(prompt: string): Promise<string> {
  return stripFences(await callClaude(DOC_SYSTEM, [{ role: "user", content: prompt }], 3000)).replace(/^\s+/, "");
}
