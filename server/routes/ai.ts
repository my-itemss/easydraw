import { Hono } from "hono";
import type { AiHistoryItem, AiResult, DiagramType } from "../../client/src/lib/types";
import { renderDiagram } from "../../client/src/lib/engine";
import { optionalUser, limitOrThrow, user, requireUser, type AppEnv } from "../auth";
import { all, newId, now, run } from "../db";
import { HttpError, clientIp, isDiagramType, readJson, strField } from "../util";
import { claudeEnabled, docWithClaude, generateWithClaude } from "../ai/claude";
import { offlineDiagram, offlineDoc } from "../ai/offline";
import { pickType } from "../ai/prompts";
import { repoDiagram } from "../ai/repo";

export const aiRoutes = new Hono<AppEnv>();
const HOUR = 3600_000;

function limit(userId: string | null, ip: string) {
  if (userId) limitOrThrow(`ai:u:${userId}`, 120, HOUR, "AI rate limit reached (120 requests per hour). Try again later.");
  else limitOrThrow(`ai:ip:${ip}`, 20, HOUR, "Anonymous AI rate limit reached (20 requests per hour). Sign up for a higher limit.");
}

function log(userId: string | null, kind: string, prompt: string, type: DiagramType | null) {
  run("INSERT INTO ai_requests (id,user_id,kind,prompt,diagram_type,created_at) VALUES (?,?,?,?,?,?)", newId(), userId, kind, prompt.slice(0, 2000), type, now());
}

export async function generateDiagram(o: {
  prompt: string;
  type?: DiagramType;
  currentCode?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  userId: string | null;
  ip: string;
}): Promise<AiResult> {
  limit(o.userId, o.ip);
  const type = o.type ?? pickType(o.prompt);
  log(o.userId, "diagram", o.prompt, type);
  if (claudeEnabled()) {
    try {
      return await generateWithClaude({ prompt: o.prompt, type, currentCode: o.currentCode, history: o.history });
    } catch (e) {
      console.error("Claude call failed, falling back to offline mode:", (e as Error).message);
    }
  }
  const r = offlineDiagram(o.prompt, type, o.currentCode);
  const errs = renderDiagram(r.code, type).diagnostics.filter((d) => d.severity === "error");
  return { code: r.code, diagramType: type, explanation: errs.length ? `${r.explanation} (Note: ${errs[0]!.message})` : r.explanation, mode: "offline" };
}

aiRoutes.post("/ai/diagram", optionalUser, async (c) => {
  const b = await readJson(c);
  const prompt = strField(b.prompt, "prompt", 8000, { required: true })!;
  if (b.diagramType !== undefined && !isDiagramType(b.diagramType)) throw new HttpError(400, "Invalid diagramType");
  const currentCode = strField(b.currentCode, "currentCode", 200 * 1024, { trim: false });
  let history: { role: "user" | "assistant"; content: string }[] | undefined;
  if (b.history !== undefined) {
    if (!Array.isArray(b.history)) throw new HttpError(400, "history must be an array");
    history = b.history
      .filter((h: any) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
      .slice(-10)
      .map((h: any) => ({ role: h.role, content: String(h.content).slice(0, 8000) }));
  }
  const u = c.get("user");
  const r = await generateDiagram({ prompt, type: b.diagramType, currentCode, history, userId: u?.id ?? null, ip: clientIp(c) });
  return c.json(r);
});

aiRoutes.post("/ai/doc", optionalUser, async (c) => {
  const b = await readJson(c);
  const prompt = strField(b.prompt, "prompt", 8000, { required: true })!;
  const u = c.get("user");
  limit(u?.id ?? null, clientIp(c));
  log(u?.id ?? null, "doc", prompt, null);
  if (claudeEnabled()) {
    try {
      return c.json({ markdown: await docWithClaude(prompt), mode: "claude" });
    } catch (e) {
      console.error("Claude doc call failed:", (e as Error).message);
    }
  }
  return c.json({ markdown: offlineDoc(prompt), mode: "offline" });
});

aiRoutes.post("/ai/repo", optionalUser, async (c) => {
  const b = await readJson(c);
  const url = strField(b.url, "url", 300, { required: true })!;
  const u = c.get("user");
  limit(u?.id ?? null, clientIp(c));
  log(u?.id ?? null, "repo", url, "architecture");
  return c.json(await repoDiagram(url));
});

aiRoutes.get("/ai/history", requireUser, (c) => {
  const rows = all<{ id: string; kind: string; prompt: string; diagram_type: string | null; created_at: number }>(
    "SELECT * FROM ai_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    user(c).id,
  );
  const out: AiHistoryItem[] = rows.map((r) => ({ id: r.id, kind: r.kind as AiHistoryItem["kind"], prompt: r.prompt, diagramType: r.diagram_type as DiagramType | null, createdAt: r.created_at }));
  return c.json(out);
});
