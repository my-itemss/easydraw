// Deterministic file → diagram converters (SQL schema, Terraform, docker-compose).
// Pure TypeScript, no DOM, no network: everything runs in the browser (or in a test).
// Emitted code follows docs/DSL.md.

import type { DiagramType } from "./types";

export type ImportKind = "sql" | "terraform" | "compose";

export interface ConvertResult {
  diagramType: DiagramType;
  code: string;
  warnings: string[];
}

/* ------------------------------------------------------------------ detection */

export function detectFileKind(filename: string, text: string): ImportKind | null {
  const base = (filename.split(/[\\/]/).pop() ?? "").toLowerCase();
  if (base.endsWith(".sql")) return "sql";
  if (base.endsWith(".tf")) return "terraform";
  if (/^(docker-)?compose([.-][\w.-]+)?\.ya?ml$/.test(base) || /^docker-compose.*\.ya?ml$/.test(base)) return "compose";
  if (/\bcreate\s+(?:or\s+replace\s+)?(?:(?:global\s+|local\s+)?(?:temp(?:orary)?\s+)|unlogged\s+)?table\b/i.test(text)) return "sql";
  if (/^\s*resource\s+"[^"]+"\s+"[^"]+"\s*\{/m.test(text)) return "terraform";
  if (/^services\s*:/m.test(text)) return "compose";
  return null;
}

export function convertToDiagram(kind: ImportKind, text: string): ConvertResult {
  switch (kind) {
    case "sql":
      return sqlToErd(text);
    case "terraform":
      return terraformToArchitecture(text);
    case "compose":
      return composeToArchitecture(text);
  }
}

/* ------------------------------------------------------------------ DSL helpers */

/** Quote a name/label for the DSL (always quoted: safe for any characters). */
const q = (s: string) => `"${s.replace(/\\/g, "/").replace(/"/g, "'").replace(/[\r\n]+/g, " ").trim()}"`;

const RESERVED = new Set([
  "title",
  "direction",
  "colormode",
  "stylemode",
  "typeface",
  "autonumber",
  "activate",
  "deactivate",
  "loop",
  "alt",
  "else",
  "opt",
  "par",
  "and",
  "break",
]);

/** Bare identifier safe for ERD entity / attribute names. */
function identify(s: string): string {
  let r = s.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, (m) => (m.length > 2 ? "_" : m));
  if (r === "") r = "_";
  if (/^\d/.test(r)) r = "_" + r;
  return r;
}
const entityRef = (n: string) => (RESERVED.has(n.toLowerCase()) ? q(n) : n);

/* ------------------------------------------------------------------ SQL → ERD */

interface SqlCol {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  unique: boolean;
  required: boolean;
}
interface SqlTable {
  schema: string;
  name: string;
  display: string;
  cols: SqlCol[];
  pkCols: string[];
}
interface SqlFk {
  table: SqlTable;
  cols: string[];
  refParts: string[];
  refCols: string[];
}

/** Remove comments, blank out string literals ('…' → '') and dollar-quoted bodies. */
function cleanSql(src: string): string {
  let out = "";
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i] as string;
    const c2 = src[i + 1];
    if (c === "-" && c2 === "-") {
      while (i < n && src[i] !== "\n") i++;
    } else if (c === "/" && c2 === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e < 0 ? n : e + 2;
      out += " ";
    } else if (c === "'") {
      i++;
      while (i < n) {
        if (src[i] === "\\") i += 2;
        else if (src[i] === "'" && src[i + 1] === "'") i += 2;
        else if (src[i] === "'") break;
        else i++;
      }
      i++;
      out += "''";
    } else if (c === '"' || c === "`") {
      const e = src.indexOf(c, i + 1);
      const end = e < 0 ? n : e + 1;
      out += src.slice(i, end);
      i = end;
    } else if (c === "$") {
      const m = /^\$(\w*)\$/.exec(src.slice(i, i + 64));
      if (m) {
        const e = src.indexOf(m[0], i + m[0].length);
        i = e < 0 ? n : e + m[0].length;
        out += " ";
      } else {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const IDENT_RE = '(?:"(?:[^"]|"")+"|`[^`]+`|\\[[^\\]]+\\]|[\\w$\\u0080-\\uffff]+)';
const QUAL_RE = `${IDENT_RE}(?:\\s*\\.\\s*${IDENT_RE})*`;

function unquoteIdent(s: string): string {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t.slice(1, -1).replace(/""/g, '"');
  if (t.startsWith("`") && t.endsWith("`") && t.length >= 2) return t.slice(1, -1);
  if (t.startsWith("[") && t.endsWith("]") && t.length >= 2) return t.slice(1, -1);
  return t;
}
function splitQualified(s: string): string[] {
  const parts: string[] = [];
  const re = new RegExp(IDENT_RE, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) parts.push(unquoteIdent(m[0]));
  return parts;
}
function identList(s: string): string[] {
  return splitTopLevel(s)
    .map((p) => {
      const m = new RegExp("^\\s*(" + IDENT_RE + ")").exec(p);
      return m ? unquoteIdent(m[1] as string) : "";
    })
    .filter(Boolean);
}

function matchParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "`") {
      const e = s.indexOf(c, i + 1);
      if (e < 0) return -1;
      i = e;
    } else if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c === '"' || c === "`") {
      const e = s.indexOf(c, i + 1);
      const end = e < 0 ? s.length : e + 1;
      cur += s.slice(i, end);
      i = end - 1;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

type SqlItem =
  | { kind: "pk"; cols: string[] }
  | { kind: "unique"; cols: string[] }
  | { kind: "fk"; cols: string[]; ref: string[]; refCols: string[] }
  | { kind: "skip" }
  | { kind: "col"; col: SqlCol; ref?: { parts: string[]; col: string } };

const COL_STOP = new Set([
  "NOT",
  "NULL",
  "PRIMARY",
  "UNIQUE",
  "REFERENCES",
  "DEFAULT",
  "CHECK",
  "CONSTRAINT",
  "COLLATE",
  "GENERATED",
  "AS",
  "AUTO_INCREMENT",
  "AUTOINCREMENT",
  "COMMENT",
  "ON",
]);

function parseSqlItem(raw: string): SqlItem {
  let s = raw.trim();
  s = s.replace(new RegExp(`^CONSTRAINT\\s+${IDENT_RE}\\s+`, "i"), (m) => (/^CONSTRAINT\s+(PRIMARY|UNIQUE|FOREIGN|CHECK)/i.test(m) ? m : ""));
  // (CONSTRAINT name) prefix: drop it when followed by a table-level keyword
  s = s.replace(new RegExp(`^CONSTRAINT\\s+${IDENT_RE}\\s+(?=PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE)`, "i"), "");

  let m = /^PRIMARY\s+KEY\s*(?:\w+\s*)?\(([^)]*)\)/i.exec(s);
  if (m) return { kind: "pk", cols: identList(m[1] as string) };
  m = /^UNIQUE(?:\s+(?:KEY|INDEX))?\s*(?:[^\s(]+\s*)?\(([^)]*)\)/i.exec(s);
  if (m) return { kind: "unique", cols: identList(m[1] as string) };
  m = new RegExp(`^FOREIGN\\s+KEY\\s*(?:[^\\s(]+\\s*)?\\(([^)]*)\\)\\s*REFERENCES\\s+(${QUAL_RE})\\s*(?:\\(([^)]*)\\))?`, "i").exec(s);
  if (m) return { kind: "fk", cols: identList(m[1] as string), ref: splitQualified(m[2] as string), refCols: m[3] ? identList(m[3]) : [] };
  if (/^(?:(?:KEY|INDEX)|(?:FULLTEXT|SPATIAL)(?:\s+(?:KEY|INDEX))?)\s*(?:[^\s(]+\s*)?\(/i.test(s)) return { kind: "skip" };
  if (/^(?:CHECK\s*\(|EXCLUDE\b|LIKE\b|PERIOD\b|CONSTRAINT\b|FOREIGN\b|PRIMARY\b)/i.test(s)) return { kind: "skip" };

  const nm = new RegExp(`^(${IDENT_RE})\\s*`).exec(s);
  if (!nm) return { kind: "skip" };
  const name = unquoteIdent(nm[1] as string);
  const rest = s.slice(nm[0].length);
  // type
  let type = "";
  const tm = /^([A-Za-z_][\w]*)(?:\s+(varying|precision))?/.exec(rest);
  if (tm && !COL_STOP.has((tm[1] as string).toUpperCase())) {
    const w = (tm[1] as string).toLowerCase();
    const w2 = (tm[2] ?? "").toLowerCase();
    type = w === "character" && w2 === "varying" ? "varchar" : w === "double" && w2 === "precision" ? "double" : w;
  }
  const flat = rest.replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "(…)");
  const pk = /\bPRIMARY\s+KEY\b/i.test(flat);
  const required = pk || /\bNOT\s+NULL\b/i.test(flat);
  const unique = /\bUNIQUE\b/i.test(flat) && !pk;
  let ref: { parts: string[]; col: string } | undefined;
  const rm = new RegExp(`\\bREFERENCES\\s+(${QUAL_RE})\\s*(?:\\(([^)]*)\\))?`, "i").exec(rest);
  if (rm) ref = { parts: splitQualified(rm[1] as string), col: rm[2] ? (identList(rm[2])[0] ?? "") : "" };
  return { kind: "col", col: { name, type, pk, fk: !!ref, unique, required }, ref };
}

function sqlToErd(text: string): ConvertResult {
  const warnings: string[] = [];
  const cleaned = cleanSql(text);
  const statements = cleaned.split(";");
  const tables: SqlTable[] = [];
  const fks: SqlFk[] = [];
  const alters: { parts: string[]; rest: string }[] = [];

  const createRe = new RegExp(
    `^\\s*CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:(?:GLOBAL|LOCAL)\\s+)?(?:(?:TEMP|TEMPORARY|UNLOGGED)\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${QUAL_RE})\\s*`,
    "i",
  );
  const alterRe = new RegExp(`^\\s*ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(${QUAL_RE})\\s+([\\s\\S]*)$`, "i");

  for (const stmt of statements) {
    const cm = createRe.exec(stmt);
    if (cm) {
      const parts = splitQualified(cm[1] as string);
      const after = stmt.slice(cm[0].length);
      if (!after.startsWith("(")) {
        warnings.push(`Skipped table "${parts.join(".")}": only plain CREATE TABLE (...) statements are supported.`);
        continue;
      }
      const close = matchParen(after, 0);
      const body = after.slice(1, close < 0 ? undefined : close);
      const table: SqlTable = { schema: parts.length > 1 ? (parts[parts.length - 2] as string) : "", name: parts[parts.length - 1] as string, display: "", cols: [], pkCols: [] };
      const uniq: string[] = [];
      const inlineRefs: { col: string; parts: string[]; refCol: string }[] = [];
      for (const item of splitTopLevel(body)) {
        const r = parseSqlItem(item);
        if (r.kind === "col") {
          table.cols.push(r.col);
          if (r.ref) inlineRefs.push({ col: r.col.name, parts: r.ref.parts, refCol: r.ref.col });
        } else if (r.kind === "pk") table.pkCols.push(...r.cols);
        else if (r.kind === "unique" && r.cols.length === 1) uniq.push(r.cols[0] as string);
        else if (r.kind === "fk") fks.push({ table, cols: r.cols, refParts: r.ref, refCols: r.refCols });
      }
      for (const c of table.cols) if (c.pk) table.pkCols.push(c.name);
      for (const u of uniq) {
        const c = table.cols.find((x) => x.name.toLowerCase() === u.toLowerCase());
        if (c) c.unique = true;
      }
      for (const r of inlineRefs) fks.push({ table, cols: [r.col], refParts: r.parts, refCols: r.refCol ? [r.refCol] : [] });
      tables.push(table);
      continue;
    }
    const am = alterRe.exec(stmt);
    if (am) alters.push({ parts: splitQualified(am[1] as string), rest: am[2] as string });
  }

  const key = (parts: string[]) => parts.join(".").toLowerCase();
  const byKey = new Map<string, SqlTable>();
  const byName = new Map<string, SqlTable[]>();
  for (const t of tables) {
    byKey.set(key(t.schema ? [t.schema, t.name] : [t.name]), t);
    const l = byName.get(t.name.toLowerCase()) ?? [];
    l.push(t);
    byName.set(t.name.toLowerCase(), l);
  }
  const findTable = (parts: string[]): SqlTable | undefined => {
    const exact = byKey.get(key(parts));
    if (exact) return exact;
    const c = byName.get((parts[parts.length - 1] as string).toLowerCase());
    return c && c.length ? c[0] : undefined;
  };

  // ALTER TABLE … ADD [CONSTRAINT x] PRIMARY KEY / FOREIGN KEY / UNIQUE
  for (const a of alters) {
    const t = findTable(a.parts);
    if (!t) continue;
    for (const piece of splitTopLevel(a.rest)) {
      const p = piece.replace(/^ADD\s+/i, "");
      if (p === piece) continue;
      if (!/^(?:CONSTRAINT|PRIMARY|FOREIGN|UNIQUE)\b/i.test(p)) continue;
      const r = parseSqlItem(p);
      if (r.kind === "pk") {
        t.pkCols.push(...r.cols);
        for (const cn of r.cols) {
          const c = t.cols.find((x) => x.name.toLowerCase() === cn.toLowerCase());
          if (c) {
            c.pk = true;
            c.required = true;
          }
        }
      } else if (r.kind === "unique" && r.cols.length === 1) {
        const c = t.cols.find((x) => x.name.toLowerCase() === (r.cols[0] as string).toLowerCase());
        if (c) c.unique = true;
      } else if (r.kind === "fk") fks.push({ table: t, cols: r.cols, refParts: r.ref, refCols: r.refCols });
    }
  }

  if (tables.length === 0) {
    warnings.push("No CREATE TABLE statements found.");
    return { diagramType: "erd", code: "// No CREATE TABLE statements found\n", warnings };
  }

  // entity names (unique, DSL-safe)
  const used = new Set<string>();
  for (const t of tables) {
    const dup = (byName.get(t.name.toLowerCase())?.length ?? 0) > 1;
    let base = identify(dup && t.schema ? `${t.schema}_${t.name}` : t.name);
    if (base !== (dup && t.schema ? `${t.schema}_${t.name}` : t.name)) warnings.push(`Renamed table "${t.name}" to "${base}" (names may only contain letters, digits and _).`);
    let n = base;
    let i = 2;
    while (used.has(n.toLowerCase())) n = `${base}_${i++}`;
    used.add(n.toLowerCase());
    t.display = n;
    base = n;
  }
  // attribute names
  for (const t of tables) {
    const seen = new Set<string>();
    for (const c of t.cols) {
      const orig = c.name;
      let n = identify(orig);
      if (n !== orig) warnings.push(`Renamed column "${t.name}.${orig}" to "${n}".`);
      let k = 2;
      const b = n;
      while (seen.has(n.toLowerCase())) n = `${b}_${k++}`;
      seen.add(n.toLowerCase());
      (c as SqlCol & { orig?: string }).orig = orig;
      c.name = n;
    }
  }
  const colOf = (t: SqlTable, name: string) => {
    const l = name.toLowerCase();
    return t.cols.find((c) => ((c as SqlCol & { orig?: string }).orig ?? c.name).toLowerCase() === l || c.name.toLowerCase() === l);
  };

  const rels: string[] = [];
  const relSeen = new Set<string>();
  for (const fk of fks) {
    const parent = findTable(fk.refParts);
    if (!parent) {
      warnings.push(`Foreign key on "${fk.table.name}" references unknown table "${fk.refParts.join(".")}" – relationship skipped.`);
      for (const cn of fk.cols) {
        const c = colOf(fk.table, cn);
        if (c) c.fk = true;
      }
      continue;
    }
    fk.cols.forEach((cn, idx) => {
      const child = colOf(fk.table, cn);
      if (!child) return;
      child.fk = true;
      const pcName = fk.refCols[idx] ?? parent.pkCols[idx] ?? parent.pkCols[0] ?? "id";
      const pc = colOf(parent, pcName) ?? colOf(parent, "id");
      const line = `${entityRef(fk.table.display)}.${child.name} > ${entityRef(parent.display)}.${pc ? pc.name : identify(pcName)}`;
      if (!relSeen.has(line)) {
        relSeen.add(line);
        rels.push(line);
      }
    });
  }

  const out: string[] = ['title "Database schema"', ""];
  for (const t of tables) {
    out.push(`${entityRef(t.display)} {`);
    const pkSet = new Set(t.pkCols.map((x) => x.toLowerCase()));
    for (const c of t.cols) {
      const isPk = c.pk || pkSet.has(((c as SqlCol & { orig?: string }).orig ?? c.name).toLowerCase());
      const flags: string[] = [];
      if (isPk) flags.push("pk");
      if (c.fk) flags.push("fk");
      if (c.unique) flags.push("unique");
      if (c.required && !isPk) flags.push("required");
      out.push(`  ${[c.name, c.type, ...flags].filter(Boolean).join(" ")}`);
    }
    out.push("}");
  }
  if (rels.length) out.push("", ...rels);
  return { diagramType: "erd", code: out.join("\n") + "\n", warnings };
}

/* ------------------------------------------------------------------ Terraform → architecture */

function heredocEnd(src: string, i: number): number {
  const m = /^<<-?[ \t]*([A-Za-z_]\w*)[ \t]*\r?\n/.exec(src.slice(i, i + 200));
  if (!m) return -1;
  const tag = m[1] as string;
  let pos = i + m[0].length;
  while (pos <= src.length) {
    let e = src.indexOf("\n", pos);
    if (e < 0) e = src.length;
    if (src.slice(pos, e).trim() === tag) return e;
    if (e >= src.length) return src.length;
    pos = e + 1;
  }
  return src.length;
}

/** Index just after the closing quote of the string starting at src[i] === '"'. Handles ${ … } interpolation with nested strings. */
function skipTfString(src: string, i: number): number {
  let j = i + 1;
  const n = src.length;
  while (j < n) {
    const c = src[j];
    if (c === "\\") j += 2;
    else if ((c === "$" || c === "%") && src[j + 1] === c && src[j + 2] === "{") j += 3;
    else if ((c === "$" || c === "%") && src[j + 1] === "{") {
      j += 2;
      let depth = 1;
      while (j < n && depth > 0) {
        const d = src[j];
        if (d === '"') j = skipTfString(src, j);
        else {
          if (d === "{") depth++;
          else if (d === "}") depth--;
          j++;
        }
      }
    } else if (c === '"') return j + 1;
    else j++;
  }
  return n;
}

function stripTfComments(src: string): string {
  let out = "";
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i] as string;
    if (c === '"') {
      const j = skipTfString(src, i);
      out += src.slice(i, j);
      i = j;
    } else if (c === "<" && src[i + 1] === "<") {
      const e = heredocEnd(src, i);
      if (e >= 0) {
        out += src.slice(i, e);
        i = e;
      } else {
        out += c;
        i++;
      }
    } else if (c === "#" || (c === "/" && src[i + 1] === "/")) {
      while (i < n && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      const end = e < 0 ? n : e + 2;
      out += src.slice(i, end).replace(/[^\n]/g, " ");
      i = end;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index of the `}` matching the `{` at src[open] (or -1). */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  const n = src.length;
  let i = open;
  while (i < n) {
    const c = src[i];
    if (c === '"') i = skipTfString(src, i);
    else if (c === "<" && src[i + 1] === "<") {
      const e = heredocEnd(src, i);
      i = e >= 0 ? e : i + 1;
    } else {
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return i;
      }
      i++;
    }
  }
  return -1;
}

interface TfBlock {
  kind: string;
  labels: string[];
  body: string;
}

function scanTfBlocks(src: string, warnings: string[]): TfBlock[] {
  const blocks: TfBlock[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(src[i] as string)) i++;
    if (i >= n) break;
    const im = /^[A-Za-z_][\w-]*/.exec(src.slice(i, i + 80));
    if (!im) {
      i++;
      continue;
    }
    const kind = im[0];
    i += kind.length;
    const labels: string[] = [];
    for (;;) {
      while (i < n && (src[i] === " " || src[i] === "\t")) i++;
      if (src[i] === '"') {
        const j = skipTfString(src, i);
        labels.push(src.slice(i + 1, j - 1));
        i = j;
      } else {
        const lm = /^[A-Za-z_][\w-]*/.exec(src.slice(i, i + 80));
        if (lm && src[i] !== "{") {
          labels.push(lm[0]);
          i += lm[0].length;
        } else break;
      }
    }
    if (src[i] === "{") {
      const close = matchBrace(src, i);
      if (close < 0) {
        warnings.push(`Unbalanced braces in ${kind} ${labels.join(".")} – the rest of the file was ignored.`);
        blocks.push({ kind, labels, body: src.slice(i + 1) });
        break;
      }
      blocks.push({ kind, labels, body: src.slice(i + 1, close) });
      i = close + 1;
    } else {
      // top-level attribute or garbage: skip the line
      while (i < n && src[i] !== "\n") i++;
    }
  }
  return blocks;
}

const TF_ICON_RULES: [RegExp, string][] = [
  [/(?:^|_)(?:vpc|virtual_network|vnet|compute_network|subnet|subnetwork|subnets|network_interface|vpn|vpc_peering|peering)(?:_|$)/, "network"],
  [/security_group|firewall|network_security|(?:^|_)waf|nsg|shield/, "firewall"],
  [/api_gateway|apigateway|api_management|apigatewayv2|(?:^|_)api(?:_|$)/, "api"],
  [/load_?balancer|(?:^|_)(?:lb|elb|alb|nlb)(?:_|$)|forwarding_rule|application_gateway|target_group/, "loadbalancer"],
  [/cloudfront|(?:^|_)cdn(?:_|$)|front_door/, "cdn"],
  [/route53|(?:^|_)dns(?:_|$)|dns_/, "dns"],
  [/lambda|(?:^|_)function(?:s|_app)?(?:_|$)|cloudfunctions|cloud_run_function|step_function|sfn/, "function"],
  [/sqs|sns|queue|pubsub|eventhub|servicebus|kinesis|(?:^|_)mq(?:_|$)|kafka|(?:^|_)msk(?:_|$)|eventbridge|event_grid/, "queue"],
  [/elasticache|redis|memcache|(?:^|_)cache(?:_|$)/, "cache"],
  [/db_instance|(?:^|_)rds(?:_|$)|dynamodb|(?:^|_)sql(?:_|$)|database|cosmos|aurora|redshift|bigquery|spanner|docdb|neptune|mysql|postgres|bigtable|firestore|db_/, "database"],
  [/(?:^|_)s3(?:_|$)|bucket|storage|(?:^|_)efs(?:_|$)|(?:^|_)ebs(?:_|$)|blob|(?:^|_)disk(?:_|$)|volume|(?:^|_)fsx(?:_|$)/, "storage"],
  [/(?:^|_)(?:eks|aks|gke)(?:_|$)|kubernetes|k8s|container_cluster/, "kubernetes"],
  [/(?:^|_)(?:ecs|ecr|ecs_service)(?:_|$)|container|docker|cloud_run|app_service|apprunner|fargate/, "container"],
  [/(?:^|_)(?:iam|cognito|role|policy|principal|identity|user|group)(?:_|$)|oidc/, "key"],
  [/kms|secret|key_vault|keyvault|(?:^|_)acm(?:_|$)|certificate|ssl/, "lock"],
  [/cloudwatch|monitor|(?:^|_)log(?:s|_|$)|alarm|metric|logging|insights/, "chart"],
  [/route_table|(?:^|_)route(?:_|$)|internet_gateway|nat_gateway|(?:^|_)gateway|(?:^|_)router(?:_|$)|(?:^|_)eip(?:_|$)/, "router"],
  [/instance|virtual_machine|(?:^|_)vm(?:_|$)|ec2|launch_(?:template|configuration)|autoscaling|scale_set|compute_/, "server"],
];

function tfIcon(type: string): string {
  const t = type.replace(/^(aws|google|google_beta|azurerm|azuread|azapi|oci|digitalocean|kubernetes|helm|cloudflare|github)_/, "");
  if (/^(kubernetes|helm)_/.test(type)) return "kubernetes";
  if (/^cloudflare_/.test(type)) return /record|zone/.test(t) ? "dns" : "cdn";
  if (/^github_/.test(type)) return "github";
  for (const [re, icon] of TF_ICON_RULES) if (re.test(t)) return icon;
  return "cloud";
}

const isNetworkType = (t: string) => /^(aws_vpc|google_compute_network|azurerm_virtual_network|azurerm_vnet|oci_core_vcn|digitalocean_vpc)$/.test(t);
const isSubnetType = (t: string) => /^(aws_subnet|google_compute_subnetwork|azurerm_subnet|oci_core_subnet)$/.test(t);
const isNetworkMember = (t: string) => /security_group|firewall|route_table|internet_gateway|nat_gateway|network_interface/.test(t);

function terraformToArchitecture(text: string): ConvertResult {
  const warnings: string[] = [];
  const src = stripTfComments(text.replace(/\r\n?/g, "\n"));
  const blocks = scanTfBlocks(src, warnings);

  interface Res {
    key: string;
    type: string;
    isModule: boolean;
    body: string;
    refs: string[];
  }
  const res: Res[] = [];
  const byKey = new Map<string, Res>();
  const skipped: Record<string, number> = {};
  for (const b of blocks) {
    if (b.kind === "resource" && b.labels.length >= 2) {
      const type = b.labels[0] as string;
      const key = `${type}.${b.labels[1]}`;
      if (byKey.has(key)) continue;
      const r: Res = { key, type, isModule: false, body: b.body, refs: [] };
      res.push(r);
      byKey.set(key, r);
    } else if (b.kind === "module" && b.labels.length >= 1) {
      const key = `module.${b.labels[0]}`;
      if (byKey.has(key)) continue;
      const r: Res = { key, type: "module", isModule: true, body: b.body, refs: [] };
      res.push(r);
      byKey.set(key, r);
    } else {
      skipped[b.kind] = (skipped[b.kind] ?? 0) + 1;
    }
  }
  const skipKinds = Object.entries(skipped).filter(([k]) => ["data", "variable", "output", "locals", "provider", "terraform", "moved", "import", "check"].includes(k));
  if (skipKinds.length)
    warnings.push(`Skipped ${skipKinds.map(([k, n]) => `${n} ${k}${n > 1 ? " blocks" : " block"}`).join(", ")} (only resources and modules become nodes).`);

  if (res.length === 0) {
    warnings.push("No resource or module blocks found.");
    return { diagramType: "architecture", code: "// No Terraform resources found\n", warnings };
  }

  // references
  const refRe = /(^|[^\w.])(?:module\.([A-Za-z_]\w*(?:-\w+)*)|([a-z][a-z0-9]*_[a-z0-9_]+)\.([A-Za-z_]\w*(?:-\w+)*))/g;
  for (const r of res) {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(r.body))) {
      const key = m[2] ? `module.${m[2]}` : `${m[3]}.${m[4]}`;
      if (key !== r.key && byKey.has(key)) set.add(key);
    }
    r.refs = [...set];
  }

  // network containment
  const networkOf = new Map<string, string>();
  const resolve = (r: Res, seen: Set<string>): string | null => {
    if (networkOf.has(r.key)) return networkOf.get(r.key) ?? null;
    if (seen.has(r.key)) return null;
    seen.add(r.key);
    let found: string | null = null;
    for (const k of r.refs) {
      const t = byKey.get(k);
      if (t && isNetworkType(t.type)) {
        found = k;
        break;
      }
    }
    if (!found)
      for (const k of r.refs) {
        const t = byKey.get(k);
        if (t && (isSubnetType(t.type) || isNetworkMember(t.type))) {
          found = resolve(t, seen);
          if (found) break;
        }
      }
    return found;
  };
  for (const r of res) if (!isNetworkType(r.type) && !r.isModule) {
    const n = resolve(r, new Set());
    if (n) networkOf.set(r.key, n);
  }
  const members = new Map<string, Res[]>();
  for (const r of res) {
    const n = networkOf.get(r.key);
    if (n) members.set(n, [...(members.get(n) ?? []), r]);
  }
  const groupKeys = new Set([...members.keys()]);

  const colorFor = (type: string) => (/^aws_/.test(type) ? "orange" : /^google/.test(type) ? "blue" : /^azure/.test(type) ? "teal" : "gray");
  const nodeLine = (r: Res, indent: string) => `${indent}${q(r.key)} [icon: ${r.isModule ? "folder" : tfIcon(r.type)}]`;

  const out: string[] = ['title "Terraform infrastructure"', "direction right", ""];
  for (const r of res) if (!groupKeys.has(r.key) && !networkOf.has(r.key)) out.push(nodeLine(r, ""));
  for (const g of groupKeys) {
    const gr = byKey.get(g) as Res;
    out.push(`${q(gr.key)} [icon: network, color: ${colorFor(gr.type) === "gray" ? "blue" : colorFor(gr.type)}] {`);
    for (const m of members.get(g) ?? []) out.push(nodeLine(m, "  "));
    out.push("}");
  }
  // network resources without members are plain nodes
  for (const r of res) if (isNetworkType(r.type) && !groupKeys.has(r.key)) {
    // already emitted above (not in a group and not a member)
  }

  const edges: string[] = [];
  const seenEdge = new Set<string>();
  for (const r of res) {
    if (groupKeys.has(r.key)) continue;
    for (const k of r.refs) {
      if (groupKeys.has(k)) continue;
      const line = `${q(r.key)} > ${q(k)}`;
      if (!seenEdge.has(line)) {
        seenEdge.add(line);
        edges.push(line);
      }
    }
  }
  if (edges.length) out.push("", ...edges);
  if (res.length > 60) warnings.push(`Large configuration (${res.length} nodes): consider splitting it by module for a more readable diagram.`);
  return { diagramType: "architecture", code: out.join("\n") + "\n", warnings };
}

/* ------------------------------------------------------------------ docker-compose → architecture */

type Y = string | null | Y[] | { [k: string]: Y };
interface YLine {
  indent: number;
  text: string;
}

function stripYamlComment(s: string): string {
  let inS = false;
  let inD = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS && s[i - 1] !== "\\") inD = !inD;
    else if (c === "#" && !inS && !inD && (i === 0 || /\s/.test(s[i - 1] as string))) return s.slice(0, i);
  }
  return s;
}

function yScalar(s: string): string | null {
  const t = s.trim();
  if (t === "" || t === "~" || t === "null") return null;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

function splitFlow(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  let inS = false;
  let inD = false;
  for (const c of s) {
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    if (!inS && !inD) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (c === "," && depth === 0) {
        parts.push(cur);
        cur = "";
        continue;
      }
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function yFlow(s: string): Y {
  const t = s.trim();
  if (t.startsWith("[") && t.endsWith("]")) return splitFlow(t.slice(1, -1)).map((p) => yFlow(p));
  if (t.startsWith("{") && t.endsWith("}")) {
    const o: { [k: string]: Y } = {};
    for (const p of splitFlow(t.slice(1, -1))) {
      const i = p.indexOf(":");
      if (i < 0) o[(yScalar(p) ?? "") as string] = null;
      else o[(yScalar(p.slice(0, i)) ?? "") as string] = yFlow(p.slice(i + 1));
    }
    return o;
  }
  return yScalar(t);
}

const MAP_KEY_RE = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s:#'"\-[{&*!|>][^:#]*?|-[^\s:][^:#]*?)\s*:(?:\s+(.*))?$/;

/** Minimal YAML reader for the docker-compose subset (block maps/lists, flow collections, scalars, anchors + merge keys). */
function parseYaml(text: string): Y {
  const lines: YLine[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n")) {
    if (/^(---|\.\.\.)\s*$/.test(raw)) continue;
    const noC = stripYamlComment(raw);
    if (noC.trim() === "") continue;
    const indent = noC.length - noC.trimStart().length;
    lines.push({ indent, text: noC.trim() });
  }
  const anchors: Record<string, Y> = {};
  let idx = 0;

  const isList = (l: YLine) => l.text === "-" || l.text.startsWith("- ");

  function parseBlock(indent: number): Y {
    const l = lines[idx];
    if (!l) return null;
    return isList(l) ? parseList(l.indent) : parseMap(l.indent);
    void indent;
  }

  function parseList(indent: number): Y {
    const arr: Y[] = [];
    while (idx < lines.length) {
      const l = lines[idx] as YLine;
      if (l.indent !== indent || !isList(l)) break;
      const content = l.text === "-" ? "" : l.text.slice(2).trimStart();
      if (content === "") {
        idx++;
        const nx = lines[idx];
        arr.push(nx && nx.indent > indent ? parseBlock(nx.indent) : null);
      } else if (!content.startsWith("[") && !content.startsWith("{") && MAP_KEY_RE.test(content) && !/^["'].*["']$/.test(content)) {
        // "- key: value" – the map continues at the content column
        const off = l.text.length - content.length;
        lines[idx] = { indent: indent + off, text: content };
        arr.push(parseMap(indent + off));
      } else {
        idx++;
        arr.push(content.startsWith("*") ? (anchors[content.slice(1).trim()] ?? null) : yFlow(content));
      }
    }
    return arr;
  }

  function parseMap(indent: number): Y {
    const obj: { [k: string]: Y } = {};
    while (idx < lines.length) {
      const l = lines[idx] as YLine;
      if (l.indent !== indent || isList(l)) break;
      const m = MAP_KEY_RE.exec(l.text);
      if (!m) {
        idx++;
        continue;
      }
      const key = (yScalar(m[1] as string) ?? "") as string;
      let rest = (m[2] ?? "").trim();
      idx++;
      let anchor = "";
      const am = /^&(\S+)\s*(.*)$/.exec(rest);
      if (am) {
        anchor = am[1] as string;
        rest = (am[2] ?? "").trim();
      }
      let val: Y;
      if (rest === "") {
        const nx = lines[idx];
        if (nx && nx.indent > indent) val = parseBlock(nx.indent);
        else if (nx && nx.indent === indent && isList(nx)) val = parseList(indent);
        else val = null;
      } else if (/^[|>][+-]?\d*$/.test(rest)) {
        const buf: string[] = [];
        while (idx < lines.length && (lines[idx] as YLine).indent > indent) buf.push((lines[idx++] as YLine).text);
        val = buf.join(rest.startsWith("|") ? "\n" : " ");
      } else if (rest.startsWith("*")) val = anchors[rest.slice(1).trim()] ?? null;
      else val = yFlow(rest);
      if (anchor) anchors[anchor] = val;
      if (key === "<<") {
        const srcs = Array.isArray(val) ? val : [val];
        for (const s of srcs) if (s && typeof s === "object" && !Array.isArray(s)) for (const [k, v] of Object.entries(s)) if (!(k in obj)) obj[k] = v;
      } else obj[key] = val;
    }
    return obj;
  }

  const first = lines[0];
  if (!first) return null;
  return parseBlock(first.indent);
}

const asMap = (v: Y | undefined): { [k: string]: Y } => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const asList = (v: Y | undefined): Y[] => (Array.isArray(v) ? v : []);
const asStr = (v: Y | undefined): string => (typeof v === "string" ? v : "");

function composeIcon(name: string, image: string): string {
  const s = `${image.split("/").pop() ?? ""} ${name}`.toLowerCase();
  if (/redis|memcache|valkey|keydb|dragonfly/.test(s)) return "cache";
  if (/postgres|mysql|mariadb|mongo|mssql|sqlserver|cockroach|clickhouse|cassandra|influx|timescale|couchdb|neo4j|surreal|(?:^|[\s_-])db(?:[\s_-]|$)|database/.test(s)) return "database";
  if (/rabbit|kafka|nats|activemq|redpanda|pulsar|mosquitto|(?:^|[\s_-])queue/.test(s)) return "queue";
  if (/nginx|traefik|haproxy|envoy|caddy|proxy|gateway|ingress/.test(s)) return "loadbalancer";
  if (/minio|localstack|s3|storage|(?:^|[\s_-])ftp/.test(s)) return "storage";
  if (/elastic|opensearch|meili|typesense|solr|search/.test(s)) return "search";
  if (/grafana|prometheus|kibana|loki|jaeger|zipkin|metrics/.test(s)) return "chart";
  if (/mail|smtp|postfix/.test(s)) return "mail";
  if (/worker|cron|job|scheduler/.test(s)) return "gear";
  if (/web|frontend|client|ui(?:$|[\s_-])|app/.test(s) && /node|nginx|react|vue|next|web|frontend/.test(s)) return "browser";
  if (/api|backend|server|service/.test(s)) return "server";
  return "container";
}

function hostPorts(v: Y): string[] {
  const out: string[] = [];
  for (const p of asList(v)) {
    if (typeof p === "string") {
      const parts = p.replace(/\/\w+$/, "").split(":");
      const host = parts.length >= 2 ? (parts[parts.length - 2] as string) : (parts[0] as string);
      if (host && /^[\d-]+$/.test(host)) out.push(host);
      else if (host) out.push(host);
    } else if (p && typeof p === "object" && !Array.isArray(p)) {
      const pub = asStr(p.published) || asStr(p.target);
      if (pub) out.push(pub);
    }
  }
  return [...new Set(out)];
}

function composeToArchitecture(text: string): ConvertResult {
  const warnings: string[] = [];
  let root: { [k: string]: Y } = {};
  try {
    root = asMap(parseYaml(text));
  } catch {
    warnings.push("Could not parse the YAML file.");
  }
  const servicesRaw = asMap(root.services);
  const names = Object.keys(servicesRaw);
  if (names.length === 0) {
    warnings.push(root.services === undefined ? "No `services:` section found." : "The `services:` section is empty.");
    return { diagramType: "architecture", code: "// No services found\n", warnings };
  }

  interface Svc {
    name: string;
    image: string;
    ports: string[];
    deps: string[];
    networks: string[];
    volumes: string[];
  }
  const svcs: Svc[] = names.map((name) => {
    const s = asMap(servicesRaw[name]);
    const deps = [...(Array.isArray(s.depends_on) ? s.depends_on.map((d) => asStr(d)) : Object.keys(asMap(s.depends_on))), ...asList(s.links).map((l) => asStr(l).split(":")[0] as string)].filter(Boolean);
    const networks = Array.isArray(s.networks) ? s.networks.map((n) => asStr(n)) : Object.keys(asMap(s.networks));
    const volumes: string[] = [];
    for (const v of asList(s.volumes)) {
      let src = "";
      if (typeof v === "string") src = v.split(":")[0] as string;
      else if (v && typeof v === "object" && !Array.isArray(v) && asStr(v.type) !== "bind") src = asStr(v.source);
      if (src && !/^[./~$]/.test(src) && !src.includes("/") && (typeof v !== "string" || v.includes(":"))) volumes.push(src);
    }
    return {
      name,
      image: asStr(s.image) || (s.build !== undefined ? "build" : ""),
      ports: hostPorts(s.ports),
      deps: [...new Set(deps)],
      networks: networks.filter(Boolean),
      volumes: [...new Set(volumes)],
    };
  });

  const nameSet = new Set(names);
  const out: string[] = [`title ${q(asStr(root.name) || "Docker Compose stack")}`, "direction right", ""];

  // network groups (only if every service is in at most one explicit network and there are >= 2 networks)
  const allNets = [...new Set(svcs.flatMap((s) => s.networks))];
  const groupable = allNets.length >= 2 && svcs.every((s) => s.networks.length <= 1);
  if (allNets.length >= 2 && !groupable) warnings.push("Networks were not drawn as groups because some services join several networks.");

  const nodeLine = (s: Svc, indent: string) => {
    const label = s.ports.length ? `${s.name} (${s.ports.map((p) => ":" + p).join(", ")})` : "";
    const props = [`icon: ${composeIcon(s.name, s.image)}`];
    if (label) props.push(`label: ${q(label)}`);
    return `${indent}${q(s.name)} [${props.join(", ")}]`;
  };
  if (groupable) {
    for (const s of svcs) if (s.networks.length === 0) out.push(nodeLine(s, ""));
    for (const net of allNets) {
      let gname = `network ${net}`;
      while (nameSet.has(gname)) gname += "_";
      out.push(`${q(gname)} [icon: network, color: blue] {`);
      for (const s of svcs) if (s.networks[0] === net) out.push(nodeLine(s, "  "));
      out.push("}");
    }
  } else for (const s of svcs) out.push(nodeLine(s, ""));

  // named volumes
  const declaredVols = Object.keys(asMap(root.volumes));
  const usedVols = [...new Set(svcs.flatMap((s) => s.volumes))].filter((v) => declaredVols.includes(v) || declaredVols.length === 0 || true);
  const volName = (v: string) => {
    let n = `volume ${v}`;
    while (nameSet.has(n)) n += "_";
    return n;
  };
  if (usedVols.length) {
    out.push(`Volumes [icon: storage, color: gray] {`);
    for (const v of usedVols) out.push(`  ${q(volName(v))} [icon: storage, label: ${q(v)}]`);
    out.push("}");
  }

  const edges: string[] = [];
  const seen = new Set<string>();
  const add = (l: string) => {
    if (!seen.has(l)) {
      seen.add(l);
      edges.push(l);
    }
  };
  for (const s of svcs) {
    for (const d of s.deps) {
      if (!nameSet.has(d)) {
        warnings.push(`Service "${s.name}" depends on unknown service "${d}" – edge skipped.`);
        continue;
      }
      if (d !== s.name) add(`${q(s.name)} > ${q(d)}`);
    }
    for (const v of s.volumes) add(`${q(s.name)} -- ${q(volName(v))}`);
  }
  if (edges.length) out.push("", ...edges);
  return { diagramType: "architecture", code: out.join("\n") + "\n", warnings };
}
