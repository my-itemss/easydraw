// Minimal stdio MCP server (JSON-RPC 2.0, newline-delimited). No SDK required.
// Env: EASYDRAW_API_URL (default http://localhost:3001), EASYDRAW_API_TOKEN (create one in Settings -> API tokens)
const BASE = (process.env.EASYDRAW_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const TOKEN = process.env.EASYDRAW_API_TOKEN ?? "";

async function api(method: string, path: string, body?: unknown, text = false): Promise<any> {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await res.text();
  if (!res.ok) {
    let msg = t;
    try { msg = JSON.parse(t).error ?? t; } catch { /* plain text */ }
    throw new Error(`${res.status}: ${msg}`);
  }
  return text ? t : t ? JSON.parse(t) : null;
}

const TYPES = ["flowchart", "architecture", "sequence", "erd"];
const tools = [
  {
    name: "create_diagram",
    description: "Create a new file in the easydraw workspace containing a diagram. Provide either `code` (easydraw diagram-as-code) or a natural-language `prompt`.",
    inputSchema: { type: "object", properties: { prompt: { type: "string" }, code: { type: "string" }, diagramType: { type: "string", enum: TYPES }, title: { type: "string" } }, required: ["diagramType"] },
  },
  { name: "list_files", description: "List files in the active workspace, optionally filtered by title.", inputSchema: { type: "object", properties: { q: { type: "string" } } } },
  { name: "read_file", description: "Read a file: markdown doc plus all canvas elements (including diagram code).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "update_diagram",
    description: "Replace the code of a diagram element in a file. Uses the first diagram when elementId is omitted.",
    inputSchema: { type: "object", properties: { fileId: { type: "string" }, elementId: { type: "string" }, code: { type: "string" } }, required: ["fileId", "code"] },
  },
  {
    name: "export_diagram",
    description: "Return the SVG markup of a diagram in a file.",
    inputSchema: { type: "object", properties: { fileId: { type: "string" }, elementId: { type: "string" }, theme: { type: "string", enum: ["light", "dark"] } }, required: ["fileId"] },
  },
];

const uid = () => Math.random().toString(36).slice(2, 12);

async function callTool(name: string, a: any): Promise<string> {
  switch (name) {
    case "create_diagram": {
      if (!TYPES.includes(a.diagramType)) throw new Error("diagramType must be one of " + TYPES.join(", "));
      let code: string = a.code;
      if (!code) {
        if (!a.prompt) throw new Error("Provide `code` or `prompt`");
        code = (await api("POST", "/api/ai/diagram", { prompt: a.prompt, diagramType: a.diagramType })).code;
      }
      const title = a.title || "Diagram";
      const id = uid();
      const content = {
        doc: `# ${title}\n\n\`\`\`diagram:${id}\n\`\`\`\n`,
        canvas: { elements: [{ id, kind: "diagram", diagramType: a.diagramType, code, title, x: 80, y: 80, w: 640, h: 420 }] },
      };
      const f = await api("POST", "/api/files", { title, content });
      return JSON.stringify({ fileId: f.id, elementId: id, url: `${BASE.replace(":3001", ":5173")}/app/f/${f.id}`, code });
    }
    case "list_files": {
      const q = a.q ? `?q=${encodeURIComponent(a.q)}` : "";
      const files = await api("GET", "/api/files" + q);
      return JSON.stringify(files.map((f: any) => ({ id: f.id, title: f.title, updatedAt: f.updatedAt })));
    }
    case "read_file":
      return JSON.stringify(await api("GET", `/api/files/${encodeURIComponent(a.id)}`));
    case "update_diagram": {
      const f = await api("GET", `/api/files/${encodeURIComponent(a.fileId)}`);
      const el = f.content.canvas.elements.find((e: any) => e.kind === "diagram" && (!a.elementId || e.id === a.elementId));
      if (!el) throw new Error("Diagram not found");
      await api("POST", `/api/files/${encodeURIComponent(a.fileId)}/ops`, { upsert: [{ ...el, code: a.code }] });
      return JSON.stringify({ ok: true, elementId: el.id });
    }
    case "export_diagram": {
      const f = a.elementId ? `&figure=${encodeURIComponent(a.elementId)}` : "";
      return await api("GET", `/api/files/${encodeURIComponent(a.fileId)}/export?format=svg&theme=${a.theme ?? "light"}${f}`, undefined, true);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const send = (m: unknown) => process.stdout.write(JSON.stringify(m) + "\n");

async function handle(msg: any) {
  const { id, method, params } = msg;
  const reply = (result: unknown) => id !== undefined && send({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => id !== undefined && send({ jsonrpc: "2.0", id, error: { code, message } });
  try {
    if (method === "initialize") return reply({ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "easydraw", version: "1.0.0" } });
    if (method === "notifications/initialized" || method?.startsWith("notifications/")) return;
    if (method === "ping") return reply({});
    if (method === "tools/list") return reply({ tools });
    if (method === "tools/call") {
      try {
        const text = await callTool(params?.name, params?.arguments ?? {});
        return reply({ content: [{ type: "text", text }] });
      } catch (e) {
        return reply({ content: [{ type: "text", text: (e as Error).message }], isError: true });
      }
    }
    fail(-32601, `Method not found: ${method}`);
  } catch (e) {
    fail(-32603, (e as Error).message);
  }
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buf += chunk;
  let i: number;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      void handle(JSON.parse(line));
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }
  }
});
