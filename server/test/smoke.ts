// Run: bun test/smoke.ts   (boots the app on a temp DB and exercises the API)
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "easydraw-")), "t.db");
process.env.PORT = "0";
delete process.env.ANTHROPIC_API_KEY;

const { server } = await import("../index");
const base = `http://localhost:${server.port}`;
let fails = 0;
let n = 0;
function ok(cond: unknown, msg: string) {
  n++;
  if (!cond) {
    fails++;
    console.error("  FAIL:", msg);
  }
}
async function call(method: string, path: string, body?: unknown, token?: string, raw = false): Promise<{ status: number; json: any; text: string; headers: Headers }> {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  if (!raw) try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, headers: res.headers };
}

// ---- auth
const a = await call("POST", "/api/auth/register", { name: "Alice", email: "alice@acme.com", password: "password123" });
ok(a.status === 200 || a.status === 201, `register alice ${a.status} ${a.text}`);
const A = a.json.token as string;
ok((await call("POST", "/api/auth/register", { name: "A2", email: "alice@acme.com", password: "password123" })).status === 409, "duplicate email → 409");
ok((await call("POST", "/api/auth/login", { email: "alice@acme.com", password: "wrong" })).status === 401, "bad password → 401");
const me = await call("GET", "/api/auth/me", undefined, A);
ok(me.json.user.email === "alice@acme.com" && me.json.teams.length === 1, "me");
ok((await call("GET", "/api/files")).status === 200, "no login needed: anonymous requests use the local workspace");
ok((await call("GET", "/api/files", undefined, "ek_bogus")).status === 401, "invalid API token → 401");

// ---- files
const f = await call("POST", "/api/files", { title: "Design" }, A);
ok(f.status === 201 && f.json.title === "Design", "create file");
const fid = f.json.id as string;
const el = { id: "d1", kind: "diagram", diagramType: "flowchart", code: "A > B: go\n", x: 0, y: 0, w: 400, h: 300 };
const ops = await call("POST", `/api/files/${fid}/ops`, { upsert: [el], doc: "# Design\n\n```diagram:d1\n```\n" }, A);
ok(ops.status === 200 && typeof ops.json.updatedAt === "number", "ops");
const got = await call("GET", `/api/files/${fid}`, undefined, A);
ok(got.json.content.canvas.elements.length === 1 && got.json.preview?.diagramType === "flowchart", "get has element + preview");
const list = await call("GET", "/api/files?filter=recent", undefined, A);
ok(list.json.length === 1, "list recent");
ok((await call("GET", `/api/files/${fid}/export?format=json`, undefined, A)).status === 200, "export json");
const md = await call("GET", `/api/files/${fid}/export?format=md`, undefined, A, true);
ok(md.text.includes("```eraser"), "export md embeds eraser fence");
const svg = await call("GET", `/api/files/${fid}/export?format=svg&figure=d1`, undefined, A, true);
ok(svg.text.startsWith("<svg") && svg.headers.get("content-security-policy")?.includes("default-src 'none'") === true, "export svg + CSP");
const dup = await call("POST", `/api/files/${fid}/duplicate`, {}, A);
ok(dup.status === 201 || dup.status === 200, "duplicate");
ok((await call("PATCH", `/api/files/${dup.json.id}`, { trashed: true }, A)).status === 200, "trash");
ok((await call("GET", "/api/files?filter=trash", undefined, A)).json.length === 1, "trash list");
ok((await call("DELETE", `/api/files/${dup.json.id}`, undefined, A)).status === 200, "delete forever");

// ---- folders
const fo = await call("POST", "/api/folders", { name: "Specs" }, A);
ok(fo.status === 201 || fo.status === 200, "create folder");
ok((await call("PATCH", `/api/files/${fid}`, { folderId: fo.json.id }, A)).status === 200, "move to folder");
ok((await call("GET", `/api/files?folderId=${fo.json.id}`, undefined, A)).json.length === 1, "list by folder");

// ---- versions
const v = await call("POST", `/api/files/${fid}/versions`, { label: "v1" }, A);
ok(v.status === 201 || v.status === 200, "create version");
await call("POST", `/api/files/${fid}/ops`, { doc: "# Changed\n" }, A);
const rest = await call("POST", `/api/files/${fid}/versions/${v.json.id}/restore`, {}, A);
ok(rest.json.content.doc.startsWith("# Design"), "restore version");
ok((await call("GET", `/api/files/${fid}/versions`, undefined, A)).json.length >= 2, "versions listed (snapshot before restore)");

// ---- comments
const cm = await call("POST", `/api/files/${fid}/comments`, { body: "Looks good", anchor: { elementId: "d1" } }, A);
ok(cm.status === 201 || cm.status === 200, "comment");
ok((await call("PATCH", `/api/comments/${cm.json.id}`, { resolved: true }, A)).json.resolved === true, "resolve");
ok((await call("GET", `/api/files/${fid}/comments`, undefined, A)).json.length === 1, "comments list");

// ---- second user + access control
const b = await call("POST", "/api/auth/register", { name: "Bob", email: "bob@other.com", password: "password123" });
const B = b.json.token as string;
ok((await call("GET", `/api/files/${fid}`, undefined, B)).status === 404, "other user cannot read file");
ok((await call("PATCH", `/api/files/${fid}`, { title: "x" }, B)).status === 404, "other user cannot patch");
const share = await call("PUT", `/api/files/${fid}/share`, { linkAccess: "view" }, A);
const tok = share.json.token as string;
const pubv = await call("GET", `/api/shared/${tok}`);
ok(pubv.status === 200 && pubv.json.access === "view", "public view link");
ok((await call("POST", `/api/shared/${tok}/ops`, { doc: "hack" })).status >= 400, "view link cannot edit");
const fig = await call("GET", `/api/shared/${tok}/figure/d1.svg?theme=dark`, undefined, undefined, true);
ok(fig.text.startsWith("<svg") && fig.headers.get("access-control-allow-origin") === "*", "figure svg public + CORS");
await call("PUT", `/api/files/${fid}/share`, { linkAccess: "edit" }, A);
ok((await call("POST", `/api/shared/${tok}/ops`, { doc: "# via link\n" })).status === 200, "edit link can edit");
await call("PUT", `/api/files/${fid}/share`, { linkAccess: "none" }, A);
ok((await call("GET", `/api/shared/${tok}`)).status === 404, "disabled link → 404");
const inv = await call("POST", `/api/files/${fid}/members`, { email: "bob@other.com", role: "viewer" }, A);
ok(inv.status === 200 || inv.status === 201, "share with member");
ok((await call("GET", `/api/files/${fid}`, undefined, B)).json.access === "view", "member gets view access");
ok((await call("GET", "/api/files?filter=shared", undefined, B)).json.length === 1, "shared-with-me list");

// ---- team
ok((await call("PATCH", "/api/team", { allowedDomain: "acme.com" }, A)).status === 200, "set allowed domain");
const c2 = await call("POST", "/api/auth/register", { name: "Carol", email: "carol@acme.com", password: "password123" });
ok(c2.json.teams.some((t: any) => t.id === me.json.teams[0].id), "domain auto-join");
ok((await call("POST", "/api/team/invite", { email: "dave@nowhere.org", role: "member" }, A)).status < 300, "invite pending");
const tm = await call("GET", "/api/team", undefined, A);
ok(tm.json.members.some((m: any) => m.email === "dave@nowhere.org" && m.status === "pending"), "pending member listed");
const aud = await call("GET", "/api/team/audit", undefined, A);
ok(Array.isArray(aud.json) && aud.json.length > 0, "audit log");
ok((await call("GET", "/api/team/audit", undefined, c2.json.token)).status >= 400, "non-admin audit denied");

// ---- tokens + v1
const tk = await call("POST", "/api/tokens", { name: "ci" }, A);
ok(tk.json.token?.startsWith("ek_"), "api token created");
const viaTok = await call("GET", "/api/v1/files", undefined, tk.json.token);
ok(viaTok.status === 200 && viaTok.json.length >= 1, "v1 files via api token");
const dg = await call("POST", "/api/v1/diagrams", { code: "X > Y\n", diagramType: "flowchart" }, tk.json.token);
ok(dg.status === 201 && dg.json.svg.startsWith("<svg"), "v1 diagrams with code");
const dsvg = await call("GET", `/api/v1/diagrams/${dg.json.id}.svg?theme=dark`, undefined, undefined, true);
ok(dsvg.text.startsWith("<svg"), "v1 diagram svg public");
const rn = await call("POST", "/api/v1/render", { code: "A > B", diagramType: "flowchart" }, tk.json.token);
ok(rn.json.width > 0, "v1 render");
ok((await call("DELETE", `/api/tokens/${tk.json.info.id}`, undefined, A)).status === 200, "token revoked");
ok((await call("GET", "/api/v1/files", undefined, tk.json.token)).status === 401, "revoked token rejected");

// ---- AI (offline)
for (const [prompt, type] of [
  ["user signs up, verifies email, then lands on dashboard", "flowchart"],
  ["web app on aws with load balancer, api service, redis cache and postgres database", "architecture"],
  ["browser logs in with api, api checks database", "sequence"],
  ["database for a blog with users, posts, comments and tags", "erd"],
] as const) {
  const r = await call("POST", "/api/ai/diagram", { prompt, diagramType: type });
  const { renderDiagram } = await import("../../client/src/lib/engine");
  const errs = r.json?.code ? renderDiagram(r.json.code, type).diagnostics.filter((d) => d.severity === "error") : [{ message: "no code" }];
  ok(r.status === 200 && r.json.mode === "offline" && errs.length === 0, `ai offline ${type}: ${JSON.stringify(errs)} ${r.text.slice(0, 100)}`);
}
const edit = await call("POST", "/api/ai/diagram", { prompt: "rename A to Start", diagramType: "flowchart", currentCode: "A > B\n" });
ok(edit.json.code.includes("Start > B"), "ai edit rename");
const auto = await call("POST", "/api/ai/diagram", { prompt: "database schema with customers and orders" });
ok(auto.json.diagramType === "erd", "ai auto type");
ok((await call("POST", "/api/ai/doc", { prompt: "Rate limiter" })).json.markdown.includes("## Goals"), "ai doc");
ok((await call("POST", "/api/ai/repo", { url: "not-a-url" })).status === 400, "ai repo invalid url");
const { treeToDsl } = await import("../ai/repo");
const dsl = treeToDsl([{ path: "client/src/App.tsx", type: "blob" }, { path: "client/package.json", type: "blob" }, { path: "server/index.ts", type: "blob" }, { path: "server/db.ts", type: "blob" }, { path: "docker-compose.yml", type: "blob" }], "demo");
const { renderDiagram: rd } = await import("../../client/src/lib/engine");
ok(rd(dsl, "architecture").diagnostics.filter((d) => d.severity === "error").length === 0, "repo tree → valid dsl");
// rate limit: 120/h per user
let limited = false;
for (let i = 0; i < 125; i++) if ((await call("POST", "/api/ai/diagram", { prompt: "x y", diagramType: "flowchart" })).status === 429) limited = true;
ok(limited, "AI rate limit → 429");
ok((await call("GET", "/api/ai/history", undefined, A)).status === 200, "ai history");

// ---- websocket presence
async function open(url: string): Promise<{ ws: WebSocket; msgs: any[] } | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const msgs: any[] = [];
    ws.onmessage = (e) => msgs.push(JSON.parse(String(e.data)));
    ws.onopen = () => resolve({ ws, msgs });
    ws.onerror = () => resolve(null);
    ws.onclose = () => resolve(null);
  });
}
const wsBase = base.replace("http", "ws");
const w1 = await open(`${wsBase}/ws/file:${fid}?token=${A}`);
ok(!!w1, "ws owner connects");
const denied = await open(`${wsBase}/ws/file:${fid}`);
ok(!denied, "ws: tokenless client (local user) cannot open another user's file");
const w2 = await open(`${wsBase}/ws/file:${fid}?token=${B}`);
ok(!!w2, "ws member connects");
await Bun.sleep(150);
ok(w1!.msgs.some((m) => m.type === "presence" && m.users.length === 2), "presence broadcast");
w1!.ws.send(JSON.stringify({ type: "cursor", x: 1, y: 2 }));
w2!.ws.send(JSON.stringify({ type: "ops", upsert: [] })); // view-only member: must be dropped
await Bun.sleep(150);
ok(w2!.msgs.some((m) => m.type === "cursor" && m.x === 1), "cursor relayed");
ok(!w1!.msgs.some((m) => m.type === "ops"), "view-only ops dropped");
w1!.ws.close();
w2!.ws.close();

console.log(fails === 0 ? `\n✓ all ${n} checks passed` : `\n✗ ${fails} of ${n} checks failed`);
server.stop(true);
process.exit(fails === 0 ? 0 : 1);
