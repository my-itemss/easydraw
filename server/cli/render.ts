// Usage: bun cli/render.ts <files or globs> [--out dir] [--theme dark] [--type flowchart|architecture|sequence|erd]
// Renders .eraser / .dsl files to SVG. Type: `// type: sequence` first-line comment, `name.sequence.eraser`, or --type (default flowchart).
import { Glob } from "bun";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { renderDiagram } from "../../client/src/lib/engine";
import type { DiagramType } from "../../client/src/lib/types";

const args = process.argv.slice(2);
const inputs: string[] = [];
let out = "";
let theme: "light" | "dark" = "light";
let forced: DiagramType | null = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--out") out = args[++i] ?? "";
  else if (a === "--theme") theme = args[++i] === "dark" ? "dark" : "light";
  else if (a === "--type") forced = (args[++i] as DiagramType) ?? null;
  else inputs.push(a);
}
if (!inputs.length) {
  console.error("Usage: bun cli/render.ts <files or globs> [--out dir] [--theme dark] [--type flowchart|architecture|sequence|erd]");
  process.exit(2);
}

const TYPES = ["flowchart", "architecture", "sequence", "erd"];
const files = new Set<string>();
for (const pattern of inputs) for (const f of new Glob(pattern).scanSync({ dot: false })) files.add(f);
if (!files.size) {
  console.error("No files matched");
  process.exit(1);
}

let failed = 0;
for (const f of [...files].sort()) {
  const code = readFileSync(f, "utf8");
  const header = /^\s*\/\/\s*type:\s*(\w+)/.exec(code)?.[1];
  const fromName = /\.(flowchart|architecture|sequence|erd)\.(eraser|dsl)$/.exec(f)?.[1];
  const type = (forced ?? header ?? fromName ?? "flowchart") as DiagramType;
  if (!TYPES.includes(type)) {
    console.error(`${f}: unknown diagram type "${type}"`);
    failed++;
    continue;
  }
  const r = renderDiagram(code, type, { theme });
  const errs = r.diagnostics.filter((d) => d.severity === "error");
  const target = join(out || dirname(f), basename(f).replace(/(\.(flowchart|architecture|sequence|erd))?\.(eraser|dsl)$/, "") + ".svg");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, r.svg);
  console.log(`${f} -> ${target}${errs.length ? `  (${errs.length} error${errs.length > 1 ? "s" : ""}: line ${errs[0]!.line} ${errs[0]!.message})` : ""}`);
  if (errs.length) failed++;
}
process.exit(failed ? 1 : 0);
