// GitHub repo -> architecture diagram (public repositories only).
import type { AiResult } from "../../client/src/lib/types";
import { HttpError } from "../util";

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
}

const q = (name: string) => (/^[A-Za-z_][\w]*$/.test(name) ? name : `"${name.replace(/"/g, "'")}"`);

export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const m = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/.exec(url.trim());
  if (!m) throw new HttpError(400, "Enter a public GitHub repository URL like https://github.com/owner/repo");
  return { owner: m[1]!, repo: m[2]! };
}

const IGNORE = /(^|\/)(node_modules|dist|build|\.git|\.github|vendor|__pycache__|\.next|coverage|\.idea|\.vscode)(\/|$)/;

const ICON_BY_DIR: [RegExp, string][] = [
  [/^(client|web|frontend|app|ui|site|www)$/i, "browser"],
  [/^(server|backend|api|services?|src|cmd|core)$/i, "server"],
  [/^(db|database|migrations|prisma|schema|sql)$/i, "database"],
  [/^(infra|infrastructure|terraform|deploy|k8s|helm|ops)$/i, "cloud"],
  [/^(docs?|documentation)$/i, "file"],
  [/^(tests?|e2e|__tests__)$/i, "shield"],
  [/^(scripts?|tools?|bin|cli)$/i, "code"],
  [/^(mobile|ios|android)$/i, "mobile"],
  [/^(lib|packages?|shared|common|utils?)$/i, "folder"],
  [/^(workers?|jobs?)$/i, "gear"],
];

/** Pure function: file tree -> architecture DSL (exported for tests). */
export function treeToDsl(tree: TreeEntry[], repoName: string): string {
  const files = tree.filter((e) => e.type === "blob" && !IGNORE.test(e.path)).map((e) => e.path);
  const topDirs = new Map<string, string[]>();
  const rootFiles: string[] = [];
  for (const f of files) {
    const parts = f.split("/");
    if (parts.length === 1) rootFiles.push(f);
    else {
      const d = parts[0]!;
      if (!topDirs.has(d)) topDirs.set(d, []);
      topDirs.get(d)!.push(parts.slice(1).join("/"));
    }
  }
  const out: string[] = [`title "${repoName.slice(0, 48)}"`, "direction right", ""];
  const names = new Map<string, string>();
  const used = new Set<string>();
  const uniq = (n: string) => {
    let c = n;
    let i = 2;
    while (used.has(c.toLowerCase())) c = `${n} ${i++}`;
    used.add(c.toLowerCase());
    return c;
  };
  const dirs = [...topDirs.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  for (const [dir, inner] of dirs) {
    const gname = uniq(dir);
    names.set(dir, gname);
    const icon = ICON_BY_DIR.find(([re]) => re.test(dir))?.[1] ?? "folder";
    const children: string[] = [];
    const subdirs = new Map<string, number>();
    for (const f of inner) {
      const p = f.split("/");
      if (p.length > 1) subdirs.set(p[0]!, (subdirs.get(p[0]!) ?? 0) + 1);
    }
    for (const [sd] of [...subdirs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) children.push(uniq(`${dir}/${sd}`));
    const notable = inner.filter((f) => /(^|\/)(index|main|app|server|schema|package)\.[a-z]+$|(^|\/)(Dockerfile|docker-compose\.ya?ml)$|\.(tf|sql|prisma)$/i.test(f) && f.split("/").length <= 2).slice(0, 3);
    for (const f of notable) children.push(uniq(f.split("/").pop()!));
    if (children.length) {
      out.push(`${q(gname)} [icon: ${icon}] {`);
      for (const c of children) {
        const ic = /\.(sql|prisma)$/.test(c) ? "database" : /\.tf$/.test(c) ? "cloud" : /docker/i.test(c) ? "docker" : /\.(ts|js|py|go|rs|java)x?$/.test(c) ? "code" : "folder";
        out.push(`  ${q(c)} [icon: ${ic}]`);
      }
      out.push("}");
    } else out.push(`${q(gname)} [icon: ${icon}]`);
  }
  const rootNotable = rootFiles.filter((f) => /^(package\.json|Dockerfile|docker-compose\.ya?ml|Makefile|go\.mod|Cargo\.toml|pyproject\.toml|requirements\.txt|pom\.xml)$/i.test(f)).slice(0, 4);
  for (const f of rootNotable) {
    const n = uniq(f);
    out.push(`${q(n)} [icon: ${/docker/i.test(f) ? "docker" : "file"}]`);
  }
  out.push("");
  const web = [...names.keys()].find((d) => /^(client|web|frontend|app|ui|site|www)$/i.test(d));
  const api = [...names.keys()].find((d) => /^(server|backend|api|services?|cmd|core)$/i.test(d));
  const db = [...names.keys()].find((d) => /^(db|database|migrations|prisma|schema|sql)$/i.test(d));
  const infra = [...names.keys()].find((d) => /^(infra|infrastructure|terraform|deploy|k8s|helm|ops)$/i.test(d));
  if (web && api) out.push(`${q(names.get(web)!)} > ${q(names.get(api)!)}: calls`);
  if (api && db) out.push(`${q(names.get(api)!)} > ${q(names.get(db)!)}: reads/writes`);
  if (infra && api) out.push(`${q(names.get(infra)!)} > ${q(names.get(api)!)}: deploys`);
  const dk = rootNotable.find((f) => /docker/i.test(f));
  if (dk && api) out.push(`${q(dk)} > ${q(names.get(api)!)}: runs`);
  if (!web && !api) {
    const all = [...names.values()];
    for (let i = 0; i < all.length - 1 && i < 6; i++) out.push(`${q(all[i]!)} > ${q(all[i + 1]!)}`);
  }
  if (dirs.length === 0 && rootNotable.length === 0) out.push(`${q(repoName)} [icon: github]`);
  return out.join("\n") + "\n";
}

export async function repoDiagram(url: string): Promise<AiResult> {
  const { owner, repo } = parseRepoUrl(url);
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, {
      headers: { "User-Agent": "easydraw", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(502, "Could not reach GitHub from the server");
  }
  if (res.status === 404) throw new HttpError(404, "Repository not found (only public repositories are supported)");
  if (!res.ok) throw new HttpError(502, `GitHub responded with ${res.status}`);
  const j = (await res.json()) as { tree?: TreeEntry[]; truncated?: boolean };
  const code = treeToDsl(j.tree ?? [], repo);
  return {
    code,
    diagramType: "architecture",
    mode: "offline",
    explanation: `Built from the file tree of ${owner}/${repo}${j.truncated ? " (tree truncated by GitHub)" : ""}. Edit the code to refine it.`,
  };
}
