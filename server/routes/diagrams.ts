import { Hono } from "hono";
import type { PublicDiagram } from "../../client/src/lib/types";
import { renderDiagram } from "../../client/src/lib/engine";
import { optionalUser, requireUser, user, type AppEnv } from "../auth";
import { get, newId, now, run } from "../db";
import { HttpError, MAX_CODE, isDiagramType, originOf, readJson, strField, svgResponse } from "../util";
import { generateDiagram } from "./ai";
import { usageFor } from "./team";

export const diagramRoutes = new Hono<AppEnv>();

interface DRow {
  id: string;
  user_id: string;
  diagram_type: string;
  code: string;
  created_at: number;
  updated_at: number;
}
const pub = (r: DRow): PublicDiagram => ({ id: r.id, diagramType: r.diagram_type as PublicDiagram["diagramType"], code: r.code, createdAt: r.created_at, updatedAt: r.updated_at });

const themeOf = (v: unknown): "light" | "dark" => (v === "dark" ? "dark" : "light");

diagramRoutes.post("/v1/diagrams", requireUser, async (c) => {
  const u = user(c);
  const b = await readJson(c);
  if (!isDiagramType(b.diagramType)) throw new HttpError(400, "diagramType must be flowchart, architecture, sequence or erd");
  let code = strField(b.code, "code", MAX_CODE, { trim: false });
  if (!code?.trim()) {
    const text = strField(b.text, "text", 8000, { required: true });
    code = (await generateDiagram({ prompt: text!, type: b.diagramType, userId: u.id, ip: "api" })).code;
  }
  const id = newId();
  run("INSERT INTO diagrams (id,user_id,diagram_type,code,created_at,updated_at) VALUES (?,?,?,?,?,?)", id, u.id, b.diagramType, code, now(), now());
  const r = renderDiagram(code, b.diagramType, { theme: themeOf(b.theme), background: !!b.background });
  const fileUrl = `${originOf(c)}/api/v1/diagrams/${id}.svg`;
  return c.json({ id, code, diagramType: b.diagramType, ...(b.returnFile ? {} : { svg: r.svg }), fileUrl }, 201);
});

diagramRoutes.get("/v1/diagrams/:idsvg{[A-Za-z0-9]+\\.svg}", (c) => {
  const id = c.req.param("idsvg").replace(/\.svg$/, "");
  const row = get<DRow>("SELECT * FROM diagrams WHERE id = ?", id);
  if (!row) throw new HttpError(404, "Diagram not found");
  const svg = renderDiagram(row.code, row.diagram_type as PublicDiagram["diagramType"], {
    theme: themeOf(c.req.query("theme")),
    background: c.req.query("background") === "true",
  }).svg;
  return svgResponse(svg, { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" });
});

diagramRoutes.get("/v1/diagrams/:id", requireUser, (c) => {
  const row = get<DRow>("SELECT * FROM diagrams WHERE id = ?", c.req.param("id"));
  if (!row || row.user_id !== user(c).id) throw new HttpError(404, "Diagram not found");
  return c.json(pub(row));
});

diagramRoutes.put("/v1/diagrams/:id", requireUser, async (c) => {
  const row = get<DRow>("SELECT * FROM diagrams WHERE id = ?", c.req.param("id"));
  if (!row || row.user_id !== user(c).id) throw new HttpError(404, "Diagram not found");
  const b = await readJson(c);
  const code = strField(b.code, "code", MAX_CODE, { required: true, trim: false })!;
  run("UPDATE diagrams SET code = ?, updated_at = ? WHERE id = ?", code, now(), row.id);
  return c.json(pub({ ...row, code, updated_at: now() }));
});

diagramRoutes.post("/v1/render", requireUser, async (c) => {
  const b = await readJson(c);
  if (!isDiagramType(b.diagramType)) throw new HttpError(400, "diagramType must be flowchart, architecture, sequence or erd");
  const code = strField(b.code, "code", MAX_CODE, { required: true, trim: false })!;
  const r = renderDiagram(code, b.diagramType, { theme: themeOf(b.theme), background: !!b.background });
  return c.json({ svg: r.svg, width: r.width, height: r.height, diagnostics: r.diagnostics });
});

diagramRoutes.get("/v1/usage", requireUser, (c) => c.json(usageFor(user(c))));

void optionalUser;
