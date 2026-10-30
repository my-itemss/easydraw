// Deterministic, rule-based diagram generator used when no ANTHROPIC_API_KEY is configured.
// It always emits valid easydraw DSL.
import type { DiagramType } from "../../client/src/lib/types";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const q = (name: string) => (/^[A-Za-z_][\w]*$/.test(name) ? name : `"${name.replace(/"/g, "'")}"`);
const clean = (s: string) => s.replace(/["{}\[\]<>:]/g, "").replace(/\s+/g, " ").trim();

const LEAD = /^(please\s+)?(can you\s+)?(create|draw|make|generate|build|design|show|give me|sketch|diagram|visuali[sz]e)\s+(me\s+)?(an?\s+|the\s+)?(simple\s+)?((flow\s?chart|flow|sequence|er|erd|architecture|cloud|database|process|network|system)\s+)*(diagram|chart|schema|model|flow)?\s*(of|for|showing|that shows|about|:)?\s*/i;

function steps(prompt: string): string[] {
  const base = prompt.trim().replace(LEAD, "");
  const parts = base
    .split(/\s*(?:->|=>|→|;|\n|\bthen\b|\band then\b|\bafter that\b|,|\d+[.)]\s)\s*/i)
    .flatMap((p) => (p.split(/\s+and\s+/i).length > 1 && p.length < 60 ? p.split(/\s+and\s+/i) : [p]))
    .map((p) => clean(p.replace(/^(and|then|next|finally|first)\s+/i, "").replace(/[.!]+$/, "")))
    .filter((p) => p.length > 0 && p.length < 70);
  const seen = new Map<string, number>();
  return parts.slice(0, 14).map((p) => {
    const k = p.toLowerCase();
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return cap(n > 1 ? `${p} ${n}` : p);
  });
}

// ---------------- flow chart ----------------
function flowchart(prompt: string): string {
  let s = steps(prompt);
  if (s.length === 0) s = ["Start", "Process", "Done"];
  if (s.length === 1) s = ["Start", s[0]!, "Done"];
  const decision = (x: string) => /\?$/.test(x) || /^(is|are|does|do|has|have|can|check|if|valid|verify|approved?)\b/i.test(x);
  const out: string[] = [`title "${clean(prompt).slice(0, 48) || "Flow"}"`, "direction right", ""];
  const first = s[0]!;
  const startLike = /^(start|begin|user|customer|visitor)/i.test(first);
  const names = [...s];
  if (!startLike) names.unshift("Start");
  const last = names[names.length - 1]!;
  if (!/^(end|done|finish|complete)/i.test(last)) names.push("End");
  const hasDecision = names.some((n) => decision(n));
  for (const n of names) {
    if (n === names[0] || n === names[names.length - 1]) out.push(`${q(n)} [shape: oval, color: ${n === names[0] ? "green" : "red"}]`);
    else if (decision(n)) out.push(`${q(n)} [shape: diamond, color: yellow]`);
  }
  if (hasDecision) out.push(`Retry [color: orange]`);
  out.push("");
  for (let i = 0; i < names.length - 1; i++) {
    const a = names[i]!;
    const b = names[i + 1]!;
    out.push(decision(a) ? `${q(a)} > ${q(b)}: yes` : `${q(a)} > ${q(b)}`);
    if (decision(a)) out.push(`${q(a)} > Retry: no`);
  }
  if (hasDecision) out.push(`Retry > ${q(names[1] ?? names[0]!)}`);
  return out.join("\n") + "\n";
}

// ---------------- architecture ----------------
interface Comp {
  re: RegExp;
  name: string;
  icon: string;
  tier: number;
  shape?: string;
}
const COMPS: Comp[] = [
  { re: /\b(users?|clients?|customers?|browsers?|visitors?)\b/i, name: "Users", icon: "users", tier: 0 },
  { re: /\b(mobile|ios|android)\b/i, name: "Mobile app", icon: "mobile", tier: 0 },
  { re: /\b(cdn|cloudfront|cloudflare|edge)\b/i, name: "CDN", icon: "cdn", tier: 1 },
  { re: /\b(dns|route ?53)\b/i, name: "DNS", icon: "dns", tier: 1 },
  { re: /\b(waf|firewall)\b/i, name: "Firewall", icon: "firewall", tier: 1 },
  { re: /\b(load ?balancers?|alb|elb|nginx|ingress)\b/i, name: "Load balancer", icon: "loadbalancer", tier: 2 },
  { re: /\b(api gateway|gateway)\b/i, name: "API gateway", icon: "api", tier: 3 },
  { re: /\b(front ?end|web app|website|spa|react|next\.?js)\b/i, name: "Web frontend", icon: "browser", tier: 3 },
  { re: /\b(auth|authentication|login|oauth|sso|identity)\b/i, name: "Auth service", icon: "lock", tier: 4 },
  { re: /\b(back ?end|api|servers?|services?|microservices?|app|application|lambda|functions?|ec2|containers?|kubernetes|k8s)\b/i, name: "API service", icon: "server", tier: 4 },
  { re: /\b(workers?|jobs?|cron|background)\b/i, name: "Worker", icon: "gear", tier: 5 },
  { re: /\b(queues?|kafka|sqs|rabbitmq|pub ?sub|events?|bus)\b/i, name: "Message queue", icon: "queue", tier: 5 },
  { re: /\b(cache|redis|memcached)\b/i, name: "Cache", icon: "cache", tier: 6 },
  { re: /\b(databases?|db|postgres(?:ql)?|mysql|mongo(?:db)?|sql|rds|dynamo(?:db)?)\b/i, name: "Database", icon: "database", tier: 6, shape: "cylinder" },
  { re: /\b(storage|s3|bucket|blob|files?)\b/i, name: "Object storage", icon: "bucket", tier: 6 },
  { re: /\b(monitoring|logging|metrics|observability|grafana|datadog)\b/i, name: "Monitoring", icon: "chart", tier: 7 },
  { re: /\b(payments?|stripe)\b/i, name: "Payments", icon: "credit-card", tier: 7 },
  { re: /\b(email|smtp|ses|sendgrid|notifications?)\b/i, name: "Email service", icon: "mail", tier: 7 },
];

function architecture(prompt: string): string {
  const found = COMPS.filter((c) => c.re.test(prompt));
  if (found.length < 2) {
    const s = steps(prompt);
    if (s.length >= 2) {
      const out = [`title "${clean(prompt).slice(0, 48)}"`, "direction right", ""];
      s.forEach((n) => out.push(`${q(n)} [icon: ${/data|store|db/i.test(n) ? "database" : /user|client/i.test(n) ? "users" : /queue|event/i.test(n) ? "queue" : "server"}]`));
      for (let i = 0; i < s.length - 1; i++) out.push(`${q(s[i]!)} > ${q(s[i + 1]!)}`);
      return out.join("\n") + "\n";
    }
    return `title "System"\ndirection right\n\nUsers [icon: users]\nWeb [icon: browser]\nAPI [icon: server]\nDatabase [icon: database, shape: cylinder]\n\nUsers > Web > API > Database\n`;
  }
  const cloud = /\baws\b|amazon/i.test(prompt) ? "AWS" : /\bgcp\b|google cloud/i.test(prompt) ? "Google Cloud" : /\bazure\b/i.test(prompt) ? "Azure" : /\bcloud|vpc|kubernetes|k8s\b/i.test(prompt) ? "Cloud" : "";
  const inner = found.filter((c) => c.tier > 0);
  const clients = found.filter((c) => c.tier === 0);
  const out: string[] = [`title "${clean(prompt).slice(0, 48)}"`, "direction right", ""];
  for (const c of clients) out.push(`${q(c.name)} [icon: ${c.icon}, color: gray]`);
  if (cloud) {
    out.push(`${q(cloud)} [icon: cloud, color: blue] {`);
    for (const c of inner) out.push(`  ${q(c.name)} [icon: ${c.icon}${c.shape ? `, shape: ${c.shape}` : ""}]`);
    out.push("}");
  } else for (const c of inner) out.push(`${q(c.name)} [icon: ${c.icon}${c.shape ? `, shape: ${c.shape}` : ""}]`);
  out.push("");
  const ordered = [...found].sort((a, b) => a.tier - b.tier);
  const tiers = [...new Set(ordered.map((c) => c.tier))];
  const edge = new Set<string>();
  for (let i = 0; i < tiers.length - 1; i++) {
    const cur = ordered.filter((c) => c.tier === tiers[i]);
    const nxt = ordered.filter((c) => c.tier === tiers[i + 1]);
    for (const a of cur) for (const b of nxt) edge.add(`${q(a.name)} > ${q(b.name)}`);
  }
  // data stores hang off the API service rather than a queue/worker chain
  const api = found.find((c) => c.name === "API service") ?? found.find((c) => c.name === "API gateway");
  if (api) {
    for (const d of found.filter((c) => c.tier >= 6)) edge.add(`${q(api.name)} > ${q(d.name)}`);
    for (const e of edge) if (api && /Message queue|Worker/.test(e) === false) void e;
  }
  out.push(...[...edge].slice(0, 30));
  return out.join("\n") + "\n";
}

// ---------------- sequence ----------------
const ACTORS: { re: RegExp; name: string; icon: string }[] = [
  { re: /\b(user|customer|visitor|person)\b/i, name: "User", icon: "user" },
  { re: /\b(browser|web ?app|frontend|front-end|client|spa)\b/i, name: "Browser", icon: "browser" },
  { re: /\b(mobile|app)\b/i, name: "Mobile app", icon: "mobile" },
  { re: /\b(gateway)\b/i, name: "API gateway", icon: "api" },
  { re: /\b(auth(?:entication|orization)? (?:server|service)?|oauth|identity)\b/i, name: "Auth server", icon: "lock" },
  { re: /\b(server|backend|back-end|api)\b/i, name: "API", icon: "server" },
  { re: /\b(service)\b/i, name: "Service", icon: "gear" },
  { re: /\b(cache|redis)\b/i, name: "Cache", icon: "cache" },
  { re: /\b(queue|kafka|sqs)\b/i, name: "Queue", icon: "queue" },
  { re: /\b(database|db|postgres|mysql|sql)\b/i, name: "Database", icon: "database" },
  { re: /\b(payments?|stripe)\b/i, name: "Payment provider", icon: "credit-card" },
  { re: /\b(email|smtp|mail)\b/i, name: "Email service", icon: "mail" },
];

function sequence(prompt: string): string {
  const hits = ACTORS.map((a) => ({ a, i: prompt.search(a.re) })).filter((x) => x.i >= 0).sort((x, y) => x.i - y.i);
  const found = hits.map((h) => h.a).slice(0, 6);
  const actors = found.length >= 2 ? found : [ACTORS[0]!, ACTORS[5]!, ACTORS[9]!];
  const out: string[] = [`title "${clean(prompt).slice(0, 48)}"`, "autoNumber on", ""];
  for (const a of actors) out.push(`${q(a.name)} [icon: ${a.icon}]`);
  out.push("");
  const verbs = steps(prompt).filter((s) => s.split(" ").length <= 6);
  const n = actors.length;
  let k = 0;
  const label = (def: string) => (verbs[k] && !ACTORS.some((x) => x.re.test(verbs[k]!)) ? verbs[k++]! : def);
  for (let i = 0; i < n - 1; i++) out.push(`${q(actors[i]!.name)} > ${q(actors[i + 1]!.name)}: ${label(i === 0 ? "Request" : "Call")}`);
  out.push(`${q(actors[n - 1]!.name)} > ${q(actors[n - 1]!.name)}: Process`);
  for (let i = n - 1; i > 0; i--) out.push(`${q(actors[i]!.name)} --> ${q(actors[i - 1]!.name)}: ${i === 1 ? "Response" : "Result"}`);
  return out.join("\n") + "\n";
}

// ---------------- ERD ----------------
const STOP = new Set(["a", "an", "the", "and", "with", "for", "of", "to", "in", "on", "that", "has", "have", "tables", "table", "database", "schema", "diagram", "entities", "entity", "model", "data", "app", "application", "system", "simple", "basic", "like", "using", "named", "called"]);

function singular(w: string) {
  return w.endsWith("ies") ? w.slice(0, -3) + "y" : w.endsWith("sses") ? w.slice(0, -2) : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}
function plural(w: string) {
  return w.endsWith("s") ? w : w.endsWith("y") ? w.slice(0, -1) + "ies" : w + "s";
}

function erd(prompt: string): string {
  const base = prompt.replace(LEAD, "");
  const m = /(?:with|containing|having|including|tables?:?|entities:?|for|of)\s+(.+)$/i.exec(base);
  const list = (m ? m[1]! : base).split(/,|\band\b|&|\//i).map((x) => x.trim()).filter(Boolean);
  const tables: string[] = [];
  for (const item of list) {
    const words = item.toLowerCase().replace(/[^a-z0-9_ ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
    const w = words[words.length - 1];
    if (w && !tables.includes(plural(w))) tables.push(plural(w));
  }
  if (tables.length === 0) tables.push("users", "posts", "comments");
  if (tables.length === 1) tables.push(...(tables[0] === "users" ? ["posts"] : ["users"]));
  const t = tables.slice(0, 10);
  const has = (n: string) => t.includes(n);
  if (has("orders") && has("products") && !has("order_items")) t.push("order_items");
  const owner = ["users", "customers", "accounts", "members", "authors"].find(has);
  const rels: string[] = [];
  const cols = new Map<string, string[]>();
  const colsFor = (name: string): string[] => {
    const base = ["id string pk"];
    switch (name) {
      case "users":
      case "customers":
      case "members":
      case "accounts":
        return [...base, "name string", "email string unique", "createdAt timestamp"];
      case "posts":
      case "articles":
        return [...base, "title string", "body text", "publishedAt timestamp nullable"];
      case "comments":
      case "reviews":
        return [...base, "body text", "createdAt timestamp"];
      case "products":
      case "items":
        return [...base, "name string", "price decimal", "stock int"];
      case "orders":
        return [...base, "status string", "total decimal", "createdAt timestamp"];
      case "order_items":
        return [...base, "quantity int", "price decimal"];
      case "tags":
      case "categories":
        return [...base, "name string unique"];
      default:
        return [...base, "name string", "createdAt timestamp"];
    }
  };
  for (const n of t) cols.set(n, colsFor(n));
  const addFk = (child: string, parent: string) => {
    const fk = `${singular(parent)}Id`;
    if (!(cols.get(child) ?? []).some((c) => c.startsWith(fk + " "))) cols.get(child)?.splice(1, 0, `${fk} string fk`);
    rels.push(`${child}.${fk} > ${parent}.id`);
  };
  t.forEach((n, i) => {
    if (n === owner || n === "tags" || n === "categories") return;
    if (n === "order_items") {
      addFk(n, "orders");
      addFk(n, "products");
      return;
    }
    if ((n === "comments" || n === "reviews") && (has("posts") || has("articles") || has("products"))) {
      addFk(n, has("posts") ? "posts" : has("articles") ? "articles" : "products");
      if (owner) addFk(n, owner);
      return;
    }
    if (owner) addFk(n, owner);
    else if (i > 0) addFk(n, t[i - 1]!);
  });
  if ((has("posts") || has("articles")) && (has("tags") || has("categories"))) rels.push(`${has("posts") ? "posts" : "articles"} <> ${has("tags") ? "tags" : "categories"}`);
  const out: string[] = [`title "${clean(prompt).slice(0, 48)}"`, ""];
  for (const n of t) {
    out.push(`${n} {`);
    for (const c of cols.get(n)!) out.push(`  ${c}`);
    out.push("}");
  }
  out.push("", ...rels);
  return out.join("\n") + "\n";
}

// ---------------- edit commands ----------------
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function nameRe(name: string) {
  return new RegExp(`("${esc(name)}"|(?<![\\w"])${esc(name)}(?![\\w"]))`, "gi");
}

/** Returns edited code, or null if the prompt is not an edit command. */
export function applyEdit(code: string, prompt: string, type: DiagramType): { code: string; note: string } | null {
  const p = prompt.trim().replace(/[.!]+$/, "");
  let m = /^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i.exec(p);
  if (m) {
    const from = clean(m[1]!.replace(/^["']|["']$/g, ""));
    const to = clean(m[2]!.replace(/^["']|["']$/g, ""));
    const re = nameRe(from);
    if (!re.test(code)) return null;
    return { code: code.replace(nameRe(from), q(to)), note: `Renamed ${from} to ${to}.` };
  }
  m = /^(?:remove|delete|drop)\s+(?:the\s+)?(.+)$/i.exec(p);
  if (m) {
    const name = clean(m[1]!.replace(/^["']|["']$/g, ""));
    const re = nameRe(name);
    if (!re.test(code)) return null;
    const lines = code.split("\n").filter((l) => !(nameRe(name).test(l) && !/^\s*(title|direction)\b/.test(l)));
    return { code: lines.join("\n"), note: `Removed ${name}.` };
  }
  m = /^(?:connect|link)\s+(.+?)\s+(?:to|with|and)\s+(.+)$/i.exec(p);
  if (m && type !== "erd") {
    const a = clean(m[1]!);
    const b = clean(m[2]!);
    const line = type === "sequence" ? `${q(a)} > ${q(b)}: Request` : `${q(a)} > ${q(b)}`;
    return { code: code.replace(/\n*$/, "\n") + line + "\n", note: `Connected ${a} to ${b}.` };
  }
  m = /^add\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+(after|before|to|between)\s+(.+))?$/i.exec(p);
  if (m) {
    const name = cap(clean(m[1]!));
    if (!name) return null;
    const rel = m[2]?.toLowerCase();
    const target = m[3] ? clean(m[3]) : "";
    const body = code.replace(/\n*$/, "\n");
    if (type === "erd") {
      const t = name.toLowerCase().replace(/\s+/g, "_");
      return { code: `${body}\n${t} {\n  id string pk\n  name string\n}\n`, note: `Added table ${t}.` };
    }
    if (type === "sequence") return { code: `${body}${q(name)}\n`, note: `Added ${name}.` };
    let add = `${q(name)}\n`;
    if (rel === "between") {
      const mm = /^(.+?)\s+and\s+(.+)$/i.exec(target);
      if (mm) {
        const a = clean(mm[1]!);
        const b = clean(mm[2]!);
        const lineRe = new RegExp(`^\\s*${nameRe(a).source}\\s*>\\s*${nameRe(b).source}[^\\n]*$`, "im");
        const stripped = body.replace(lineRe, "");
        return { code: `${stripped.replace(/\n*$/, "\n")}${q(a)} > ${q(name)}\n${q(name)} > ${q(b)}\n`, note: `Inserted ${name} between ${a} and ${b}.` };
      }
    }
    if (rel === "after" || rel === "to") add += `${q(target)} > ${q(name)}\n`;
    else if (rel === "before") add += `${q(name)} > ${q(target)}\n`;
    return { code: body + add, note: `Added ${name}.` };
  }
  return null;
}

export function offlineDiagram(prompt: string, type: DiagramType, currentCode?: string): { code: string; explanation: string } {
  if (currentCode?.trim()) {
    const e = applyEdit(currentCode, prompt, type);
    if (e) return { code: e.code, explanation: `${e.note} (offline mode)` };
  }
  const code = type === "sequence" ? sequence(prompt) : type === "erd" ? erd(prompt) : type === "architecture" ? architecture(prompt) : flowchart(prompt);
  return {
    code,
    explanation: "Generated by the offline rule-based generator. Set ANTHROPIC_API_KEY on the server for full AI generation.",
  };
}

export function offlineDoc(prompt: string): string {
  const topic = cap(clean(prompt.replace(LEAD, "")) || "Untitled design");
  return `# ${topic}

## Overview
Describe ${topic.toLowerCase()} in two or three sentences: what it is, who it is for and why it matters now.

## Goals
- The outcome this design must achieve
- How success will be measured

## Non-goals
- What is explicitly out of scope

## Background
Context a new reader needs: the current system, constraints and prior art.

## Design
### Architecture
_Diagram: high-level components and how they interact_

### Data model
_Diagram: the main entities and relationships_

### Key flows
_Diagram: the most important request or user flow_

## Alternatives considered
| Option | Pros | Cons |
| --- | --- | --- |
| Option A | | |
| Option B | | |

## Risks
- Risk and mitigation

## Open questions
- Question that still needs an owner

## Rollout / milestones
1. Prototype
2. Internal beta
3. General availability
`;
}
