import type { DiagramType } from "../types";
import { resolveColor } from "./theme";
import { resolveIcon } from "./icons";

export type Props = Record<string, string>;

export interface Diagnostic {
  line: number; // 1-based
  message: string;
  severity: "error" | "warning";
}

export interface Attr {
  name: string;
  type?: string;
  flags: string[];
}

export interface NodeDef {
  name: string;
  label: string;
  props: Props;
  parent: string | null;
  isGroup: boolean;
  children: string[];
  attrs: Attr[];
  line: number;
  defined: boolean;
}

export interface EdgeDef {
  from: string;
  to: string;
  op: string; // normalised: > <> - -- -->
  label?: string;
  props: Props;
  line: number;
  fromAttr?: string;
  toAttr?: string;
  /** original operator (ERD cardinality needs the direction) */
  rawOp: string;
}

export interface SeqBranch {
  kind: string; // loop|alt|opt|par|break|else|and
  label?: string;
  items: SeqItem[];
}
export type SeqItem =
  | { t: "msg"; from: string; to: string; op: string; label: string; line: number; props: Props }
  | { t: "act"; name: string }
  | { t: "deact"; name: string }
  | { t: "block"; kind: string; branches: SeqBranch[] };

export interface Globals {
  title?: string;
  direction: "down" | "up" | "left" | "right";
  colorMode: "pastel" | "bold" | "outline";
  styleMode: "shadow" | "plain";
  typeface: "clean" | "mono" | "rough";
  autoNumber: boolean;
}

export interface Parsed {
  type: DiagramType;
  globals: Globals;
  nodes: Map<string, NodeDef>;
  order: string[];
  edges: EdgeDef[];
  seq: SeqItem[];
  diagnostics: Diagnostic[];
}

type Tok = { k: "str" | "word" | "op" | "comma" | "props"; v: string; props?: Props };

const OPS = new Set([">", "<", "<>", "-", "--", "-->"]);
const BLOCKS = new Set(["loop", "alt", "opt", "par", "break"]);
const SHAPES = new Set(["rectangle", "rect", "oval", "diamond", "cylinder", "hexagon", "document", "parallelogram", "circle"]);
const FLAGS = new Set(["pk", "fk", "unique", "nullable", "required"]);

function stripComment(line: string): string {
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (!q && c === "/" && line[i + 1] === "/" && line[i - 1] !== ":") return line.slice(0, i);
  }
  return line;
}

const unquote = (s: string) => {
  const t = s.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/\\"/g, '"') : t;
};

function parseProps(inner: string): Props {
  const out: Props = {};
  const parts: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of inner) {
    if (ch === '"') q = !q;
    if (ch === "," && !q) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const i = p.indexOf(":");
    if (i < 0) {
      const k = p.trim();
      if (k) out[k] = "true";
      continue;
    }
    out[p.slice(0, i).trim()] = unquote(p.slice(i + 1));
  }
  return out;
}

interface Tokenized {
  toks: Tok[];
  open: boolean;
  label?: string;
  labelProps?: Props;
  error?: string;
}

const WORD_STOP = new Set([" ", "\t", ":", ",", "{", "}", "[", "]", '"', ">", "<"]);

function tokenize(line: string): Tokenized {
  const toks: Tok[] = [];
  let open = false;
  let label: string | undefined;
  let labelProps: Props | undefined;
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i] as string;
    if (c === " " || c === "\t") {
      i++;
    } else if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < n && line[j] !== '"') {
        if (line[j] === "\\" && j + 1 < n) j++;
        s += line[j];
        j++;
      }
      if (j >= n) return { toks, open, error: "Unterminated string" };
      toks.push({ k: "str", v: s });
      i = j + 1;
    } else if (c === "[") {
      let j = i + 1;
      let q = false;
      while (j < n && (q || line[j] !== "]")) {
        if (line[j] === '"') q = !q;
        j++;
      }
      if (j >= n) return { toks, open, error: "Missing ]" };
      toks.push({ k: "props", v: "", props: parseProps(line.slice(i + 1, j)) });
      i = j + 1;
    } else if (c === ",") {
      toks.push({ k: "comma", v: "," });
      i++;
    } else if (c === "{") {
      open = true;
      i++;
    } else if (c === "}") {
      return { toks, open, error: "Unexpected }" };
    } else if (c === ":") {
      let rest = line.slice(i + 1).trim();
      const m = /\s*\[\s*[A-Za-z]+\s*:[^\]]*\]\s*(\{)?\s*$/.exec(rest);
      if (m && m.index >= 0) {
        const inner = /\[(.*)\]/.exec(m[0]);
        if (inner) labelProps = parseProps(inner[1] as string);
        if (m[1]) open = true;
        rest = rest.slice(0, m.index).trim();
      } else if (rest.endsWith("{")) {
        open = true;
        rest = rest.slice(0, -1).trim();
      }
      label = unquote(rest);
      break;
    } else if (c === ">" || c === "<" || c === "-") {
      let j = i;
      while (j < n && (line[j] === ">" || line[j] === "<" || line[j] === "-")) j++;
      const run = line.slice(i, j);
      const prevOk = i === 0 || line[i - 1] === " " || line[i - 1] === "\t" || line[i - 1] === '"' || line[i - 1] === "]";
      if (OPS.has(run) && (prevOk || run.includes(">") || run.includes("<"))) {
        toks.push({ k: "op", v: run });
        i = j;
      } else {
        // part of a word like "order-items"
        let k = i;
        while (k < n && !WORD_STOP.has(line[k] as string)) k++;
        if (k === i) k = i + 1;
        toks.push({ k: "word", v: line.slice(i, k) });
        i = k;
      }
    } else {
      let j = i;
      while (j < n) {
        const ch = line[j] as string;
        if (WORD_STOP.has(ch)) break;
        if (ch === "-" && (line[j + 1] === ">" || line[j + 1] === "-")) break;
        j++;
      }
      if (j === i) j = i + 1;
      toks.push({ k: "word", v: line.slice(i, j) });
      i = j;
    }
  }
  return { toks, open, label, labelProps };
}

const DIRS = new Set(["down", "up", "left", "right"]);

export function parse(code: string, type: DiagramType): Parsed {
  const P: Parsed = {
    type,
    globals: { direction: type === "erd" ? "right" : "down", colorMode: "pastel", styleMode: "shadow", typeface: "clean", autoNumber: false },
    nodes: new Map(),
    order: [],
    edges: [],
    seq: [],
    diagnostics: [],
  };
  const diag = (line: number, message: string, severity: "error" | "warning" = "error") => P.diagnostics.push({ line, message, severity });

  type Ctx = { kind: "group" | "entity"; name: string; line: number } | { kind: "block"; block: Extract<SeqItem, { t: "block" }>; items: SeqItem[]; line: number };
  const stack: Ctx[] = [];
  let lastClosed: Extract<SeqItem, { t: "block" }> | null = null;

  const curItems = (): SeqItem[] => {
    const t = stack[stack.length - 1];
    return t && t.kind === "block" ? t.items : P.seq;
  };
  const curGroup = (): string | null => {
    const t = stack[stack.length - 1];
    return t && t.kind === "group" ? t.name : null;
  };

  const ensure = (name: string, line: number): NodeDef => {
    let nd = P.nodes.get(name);
    if (!nd) {
      const parent = type === "sequence" || type === "erd" ? null : curGroup();
      nd = { name, label: name, props: {}, parent, isGroup: false, children: [], attrs: [], line, defined: false };
      P.nodes.set(name, nd);
      P.order.push(name);
      if (parent) P.nodes.get(parent)?.children.push(name);
    }
    return nd;
  };

  const declare = (name: string, props: Props, open: boolean, line: number) => {
    const existed = P.nodes.has(name);
    const nd = ensure(name, line);
    if (existed && nd.defined && (open || nd.isGroup)) diag(line, `"${name}" is defined more than once`, "warning");
    nd.defined = true;
    Object.assign(nd.props, props);
    nd.label = nd.props.label ?? name;
    nd.line = line;
    const g = type === "sequence" || type === "erd" ? null : curGroup();
    if (g && nd.parent !== g) {
      if (nd.parent) {
        const old = P.nodes.get(nd.parent);
        if (old) old.children = old.children.filter((c) => c !== name);
      }
      nd.parent = g;
      P.nodes.get(g)?.children.push(name);
    }
    if (open) {
      nd.isGroup = type === "flowchart" || type === "architecture";
    }
    return nd;
  };

  const lines = code.replace(/\r\n?/g, "\n").split("\n");
  for (let li = 0; li < lines.length; li++) {
    const ln = li + 1;
    let line = stripComment(lines[li] as string).trim();
    if (!line) continue;

    while (line.startsWith("}")) {
      const top = stack.pop();
      if (!top) {
        diag(ln, "Unmatched }");
      } else if (top.kind === "block") lastClosed = top.block;
      else lastClosed = null;
      line = line.slice(1).trim();
    }
    if (!line) continue;

    const tk = tokenize(line);
    if (tk.error) {
      diag(ln, tk.error);
      continue;
    }
    const { toks, open } = tk;
    if (toks.length === 0) {
      if (open) diag(ln, "Unexpected {");
      continue;
    }
    const t0 = toks[0] as Tok;
    const hasOp = toks.some((t) => t.k === "op");

    // --- else / and (sequence)
    if (type === "sequence" && (t0.v === "else" || t0.v === "and") && t0.k === "word" && open) {
      if (!lastClosed) {
        diag(ln, `"${t0.v}" without a matching block`);
        stack.push({ kind: "group", name: "", line: ln });
        continue;
      }
      const props = (toks[1]?.k === "props" ? toks[1].props : {}) as Props;
      const br: SeqBranch = { kind: t0.v, label: props.label, items: [] };
      lastClosed.branches.push(br);
      stack.push({ kind: "block", block: lastClosed, items: br.items, line: ln });
      lastClosed = null;
      continue;
    }
    lastClosed = null;

    // --- global statements (never inside an ERD entity: "title" can be a column)
    const inEntity = stack[stack.length - 1]?.kind === "entity";
    if (!hasOp && !open && !inEntity && t0.k === "word") {
      if (t0.v === "title") {
        const m = /^title\s+(.+)$/.exec(line);
        if (m) {
          P.globals.title = unquote(m[1] as string);
          continue;
        }
      }
      const arg = toks[1]?.v;
      if (toks.length === 2 && arg !== undefined) {
        if (t0.v === "direction") {
          if (DIRS.has(arg)) P.globals.direction = arg as Globals["direction"];
          else diag(ln, `Unknown direction "${arg}" (use down, up, left or right)`, "warning");
          continue;
        }
        if (t0.v === "colorMode") {
          if (arg === "pastel" || arg === "bold" || arg === "outline") P.globals.colorMode = arg;
          else diag(ln, `Unknown colorMode "${arg}"`, "warning");
          continue;
        }
        if (t0.v === "styleMode") {
          if (arg === "shadow" || arg === "plain") P.globals.styleMode = arg;
          else diag(ln, `Unknown styleMode "${arg}"`, "warning");
          continue;
        }
        if (t0.v === "typeface") {
          if (arg === "clean" || arg === "mono" || arg === "rough") P.globals.typeface = arg;
          else diag(ln, `Unknown typeface "${arg}"`, "warning");
          continue;
        }
        if (t0.v === "autoNumber") {
          P.globals.autoNumber = arg === "on" || arg === "true";
          continue;
        }
        if (type === "sequence" && (t0.v === "activate" || t0.v === "deactivate")) {
          ensure(arg, ln);
          curItems().push({ t: t0.v === "activate" ? "act" : "deact", name: arg });
          continue;
        }
      }
    }

    // --- sequence blocks
    if (type === "sequence" && t0.k === "word" && BLOCKS.has(t0.v) && open && (toks.length === 1 || (toks.length === 2 && toks[1]?.k === "props"))) {
      const props = (toks[1]?.props ?? {}) as Props;
      const blk: Extract<SeqItem, { t: "block" }> = { t: "block", kind: t0.v, branches: [{ kind: t0.v, label: props.label, items: [] }] };
      curItems().push(blk);
      stack.push({ kind: "block", block: blk, items: (blk.branches[0] as SeqBranch).items, line: ln });
      continue;
    }

    // --- inside an ERD entity: attribute lines
    const top = stack[stack.length - 1];
    if (top && top.kind === "entity" && !hasOp) {
      if (open) diag(ln, "Entities cannot be nested");
      const words = toks.filter((t) => t.k === "word" || t.k === "str");
      if (words.length === 0) {
        diag(ln, "Expected an attribute like: id string pk");
        continue;
      }
      const name = (words[0] as Tok).v;
      const rest = words.slice(1).map((w) => w.v);
      const flags = rest.filter((r) => FLAGS.has(r.toLowerCase())).map((r) => r.toLowerCase());
      const typeName = rest.find((r) => !FLAGS.has(r.toLowerCase()));
      P.nodes.get(top.name)?.attrs.push({ name, type: typeName, flags });
      continue;
    }

    // --- connections
    if (hasOp) {
      if (open) diag(ln, "A connection cannot open a block");
      const segs: Tok[][] = [[]];
      const ops: string[] = [];
      const trailing: Props = {};
      for (const t of toks) {
        if (t.k === "op") {
          ops.push(t.v);
          segs.push([]);
        } else (segs[segs.length - 1] as Tok[]).push(t);
      }
      let bad = false;
      const names: string[][] = segs.map((sg, si) => {
        const out: string[] = [];
        for (const t of sg) {
          if (t.k === "word" || t.k === "str") out.push(t.v);
          else if (t.k === "props" && si === segs.length - 1) Object.assign(trailing, t.props);
        }
        if (out.length === 0) bad = true;
        return out;
      });
      if (bad) {
        diag(ln, "Missing name next to a connection operator");
        continue;
      }
      const props = { ...trailing, ...(tk.labelProps ?? {}) };
      for (let oi = 0; oi < ops.length; oi++) {
        const rawOp = ops[oi] as string;
        for (const a0 of names[oi] as string[]) {
          for (const b0 of names[oi + 1] as string[]) {
            let a = a0;
            let b = b0;
            let aAttr: string | undefined;
            let bAttr: string | undefined;
            if (type === "erd") {
              const sa = a.indexOf(".");
              if (sa > 0) {
                aAttr = a.slice(sa + 1);
                a = a.slice(0, sa);
              }
              const sb = b.indexOf(".");
              if (sb > 0) {
                bAttr = b.slice(sb + 1);
                b = b.slice(0, sb);
              }
            }
            ensure(a, ln);
            ensure(b, ln);
            let op = rawOp;
            if (op === "<" && type !== "erd") {
              [a, b] = [b, a];
              [aAttr, bAttr] = [bAttr, aAttr];
              op = ">";
            }
            if (type === "sequence") {
              curItems().push({ t: "msg", from: a, to: b, op, label: tk.label ?? "", line: ln, props });
            } else {
              P.edges.push({ from: a, to: b, op, label: tk.label, props, line: ln, fromAttr: aAttr, toAttr: bAttr, rawOp });
            }
          }
        }
      }
      continue;
    }

    // --- declarations: Name [props] (, Name [props])* [{]
    const decls: { name: string; props: Props }[] = [];
    let ok = true;
    for (let i = 0; i < toks.length; ) {
      const t = toks[i] as Tok;
      if (t.k !== "word" && t.k !== "str") {
        ok = false;
        break;
      }
      let props: Props = {};
      let j = i + 1;
      if (toks[j]?.k === "props") {
        props = toks[j]?.props as Props;
        j++;
      }
      decls.push({ name: t.v, props });
      if (j < toks.length) {
        if (toks[j]?.k === "comma") j++;
        else {
          ok = false;
          break;
        }
      }
      i = j;
    }
    if (!ok || decls.length === 0) {
      diag(ln, `Could not understand: ${line.length > 50 ? line.slice(0, 50) + "…" : line}`);
      continue;
    }
    if (open && decls.length > 1) {
      diag(ln, "Only one name can open a block");
    }
    decls.forEach((d, idx) => {
      const isOpen = open && idx === decls.length - 1;
      const nd = declare(d.name, d.props, isOpen, ln);
      if (isOpen) {
        if (type === "erd") {
          nd.isGroup = false;
          stack.push({ kind: "entity", name: d.name, line: ln });
        } else if (type === "sequence") {
          diag(ln, "Blocks in sequence diagrams must be loop, alt, opt, par or break");
          stack.push({ kind: "group", name: "", line: ln });
        } else stack.push({ kind: "group", name: d.name, line: ln });
      }
    });
  }

  for (const s of stack) diag(s.line, "Missing closing }");

  // property validation
  for (const nd of P.nodes.values()) {
    const l = nd.line;
    if (nd.props.shape && !SHAPES.has(nd.props.shape)) diag(l, `Unknown shape "${nd.props.shape}"`, "warning");
    if (nd.props.color && !resolveColor(nd.props.color)) diag(l, `Unknown color "${nd.props.color}"`, "warning");
    if (nd.props.icon && !resolveIcon(nd.props.icon)) diag(l, `Unknown icon "${nd.props.icon}"`, "warning");
  }
  return P;
}
